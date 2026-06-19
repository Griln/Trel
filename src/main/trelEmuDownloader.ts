import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

/**
 * TrelEmu asset downloader.
 *
 * Идея: TrelEmu — это QEMU + Android-x86 ISO. Это необязательный компонент:
 * пользователь может скачать pack прямо из лаунчера, а portable-пользователь
 * может положить папку trel-emu рядом с Trel.exe. Bundled resourcesPath/trel-emu
 * остаётся совместимым fallback для старых/специальных сборок.
 *
 * Resume-стратегия:
 *   1) Перед скачиванием — HEAD-запрос, узнаём Content-Length и Accept-Ranges.
 *   2) Если уже есть .partial — читаем его размер N, шлём `Range: bytes=N-`.
 *   3) Сервер отвечает:
 *        206 + Content-Range → дописываем в .partial
 *        200                → сервер не поддерживает Range, начинаем с нуля
 *        416                → .partial уже >= сервера, проверяем SHA1 и завершаем
 *   4) Ссылка на .partial и его размер пишутся в .meta.json — это позволяет
 *      продолжить загрузку после полного перезапуска Trel.
 *   5) После успешного скачивания: верифицируем SHA1, атомарно переименовываем
 *      .partial → final. Если проверка не прошла — удаляем .partial.
 *
 * Откуда качаем:
 *   По умолчанию — GitHub Releases репозитория mkrlord1000-sketch/Trel.
 *   Файл `trel-emu-pack.zip` должен быть приложен к релизу.
 *   URL можно переопределить через env `TRELEMU_PACK_URL` (для тестов/зеркал).
 *
 * Куда кладём:
 *   Installed: %APPDATA%/Trel/trel-emu/
 *   Portable: <директория Trel.exe>/trel-emu/
 *
 * Скачивание — стримом (без буфера 1 ГБ в RAM).
 * Извлечение — через встроенный zip-парсер.
 * ZIP64 не используем (pack < 2 ГБ).
 * Сжатие выключено (deflate/raw, не zip64 — этого хватает для нашего пака).
 *
 * Прогресс шлём через EventEmitter. IPC-хендлер подписывается и пересылает
 * renderer'у через `webContents.send('trelEmu:downloadProgress', ...)`.
 */

export type DownloadState =
  | 'idle' | 'resuming' | 'downloading' | 'verifying'
  | 'extracting' | 'done' | 'error' | 'cancelled';

export interface DownloadProgress {
  state: DownloadState;
  /** Байт скачано (с учётом резюма). */
  downloaded: number;
  /** Полный размер (если сервер дал Content-Length). */
  total: number;
  /** 0..1. */
  ratio: number;
  /** Скорость в байт/сек (последние 5 сек). */
  speed: number;
  /** Текстовая подсказка для UI. */
  message: string;
  /** Если state === 'error' — описание ошибки. */
  error?: string;
  /** Сколько байт уже было скачано до resume (0 если скачиваем с нуля). */
  resumedFrom?: number;
}

interface DownloadMeta {
  url: string;
  expectedSha1: string | null;
  totalSize: number;
  etag: string | null;
  lastModified: string | null;
  acceptsRanges: boolean;
  /** Last write time — чтобы stale .meta.json не мешал новой загрузке. */
  startedAt: number;
}

const PROGRESS_THROTTLE_MS = 200;
const MAX_RESUME_AGE_MS = 7 * 24 * 60 * 60_000; // неделю — после этого resume не доверяем
const HEAD_TIMEOUT_MS = 15_000;
const CHUNK_TIMEOUT_MS = 30_000;

const DEFAULT_URL = 'https://github.com/mkrlord1000-sketch/Trel/releases/download/trel-emu-v0.3.0/trel-emu-pack.zip';
/** SHA1 эталон. Считается автоматически при упаковке и пишется в .sha1 файл рядом. */
const DEFAULT_SHA1 = '0000000000000000000000000000000000000000';

interface ManifestFile {
  name: string;
  size: number;
  compressedSize: number;
  offset: number;
  crc32: number;
  isDir: boolean;
}

export class TrelEmuDownloader extends EventEmitter {
  private state: DownloadState = 'idle';
  private currentAbort: AbortController | null = null;
  private lastProgressEmit = 0;
  private startTime = 0;
  private lastDownloaded = 0;
  private lastTime = 0;
  private measuredSpeed = 0;
  /** Сколько байт уже было скачано ДО текущей сессии (для UI "Возобновляем с X МБ"). */
  private resumeStartBytes = 0;

  /** Путь, куда распаковываем TrelEmu. */
  resolveTargetDir(): string {
    if (process.env.PORTABLE_EXECUTABLE_FILE) {
      return path.join(path.dirname(process.env.PORTABLE_EXECUTABLE_FILE), 'trel-emu');
    }
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || os.homedir(), 'Trel', 'trel-emu');
    }
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Trel', 'trel-emu');
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Trel', 'trel-emu');
  }

  /**
   * Возвращает массив директорий, где ищем TrelEmu.
   * TrelEmu теперь необязательный компонент: обычный release не обязан тащить
   * 1+ ГБ эмулятора. Поэтому сначала ищем пользовательский скачанный pack,
   * затем bundled resources как fallback для старых/специальных сборок, и только
   * в dev-режиме смотрим project-local resources/trel-emu.
   */
  getSearchDirs(): string[] {
    const dirs: string[] = [];
    const add = (p: string | undefined) => {
      if (!p) return;
      const normalized = path.normalize(p);
      if (!dirs.includes(normalized)) dirs.push(normalized);
    };

    if (process.env.PORTABLE_EXECUTABLE_FILE) {
      add(path.join(path.dirname(process.env.PORTABLE_EXECUTABLE_FILE), 'trel-emu'));
    }
    if (process.platform === 'win32') {
      add(path.join(process.env.APPDATA || os.homedir(), 'Trel', 'trel-emu'));
    } else if (process.platform === 'darwin') {
      add(path.join(os.homedir(), 'Library', 'Application Support', 'Trel', 'trel-emu'));
    } else {
      add(path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Trel', 'trel-emu'));
    }

    if (process.resourcesPath) {
      add(path.join(process.resourcesPath, 'trel-emu'));
    }

    // Dev fallback only. In packaged builds process.defaultApp is false, so a
    // random current working directory cannot accidentally shadow the user's pack.
    if (process.env.NODE_ENV !== 'test' && (process as any).defaultApp) {
      add(path.join(process.cwd(), 'resources', 'trel-emu'));
    }

    return dirs;
  }

  /** Директория для .partial и .meta.json (рядом с целевой папкой). */
  private getDownloadsDir(targetDir: string): string {
    return path.join(targetDir, 'downloads');
  }

  private getPartialPath(targetDir: string, baseName: string): string {
    return path.join(this.getDownloadsDir(targetDir), baseName + '.partial');
  }

  private getMetaPath(targetDir: string, baseName: string): string {
    return path.join(this.getDownloadsDir(targetDir), baseName + '.meta.json');
  }

  /**
   * Если .partial + .meta.json существуют, согласуются и не старше недели —
   * возвращает размер уже скачанного. Иначе 0.
   */
  async getResumableBytes(targetDir: string, baseName: string, url: string): Promise<number> {
    const metaPath = this.getMetaPath(targetDir, baseName);
    const partialPath = this.getPartialPath(targetDir, baseName);
    try {
      const [meta, stat] = await Promise.all([
        fsp.readFile(metaPath, 'utf-8').then(JSON.parse) as Promise<DownloadMeta>,
        fsp.stat(partialPath),
      ]);
      if (meta.url !== url) return 0;
      if (Date.now() - meta.startedAt > MAX_RESUME_AGE_MS) return 0;
      if (stat.size <= 0) return 0;
      if (meta.totalSize > 0 && stat.size > meta.totalSize) return 0;
      return stat.size;
    } catch { return 0; }
  }

  private async writeMeta(targetDir: string, baseName: string, meta: DownloadMeta): Promise<void> {
    await fsp.mkdir(this.getDownloadsDir(targetDir), { recursive: true });
    await fsp.writeFile(this.getMetaPath(targetDir, baseName), JSON.stringify(meta, null, 2));
  }

  private async clearMeta(targetDir: string, baseName: string): Promise<void> {
    try { await fsp.unlink(this.getMetaPath(targetDir, baseName)); } catch {}
  }

  getState(): DownloadState { return this.state; }

  isBusy(): boolean {
    return this.state === 'resuming' || this.state === 'downloading' ||
           this.state === 'verifying' || this.state === 'extracting';
  }

  cancel(): void {
    if (this.currentAbort) {
      this.currentAbort.abort();
    }
  }

  /**
   * Скачивает, верифицирует и распаковывает TrelEmu pack.
   *
   * Поддерживает resume через HTTP Range: если в targetDir/downloads/ уже
   * лежит .partial с .meta.json — продолжаем с того места, где остановились.
   * Переживает полный рестарт Trel.
   *
   * @param urlOverride опционально — URL пака.
   * @param sha1Override опционально — эталонный SHA1.
   */
  async downloadAndInstall(urlOverride?: string, sha1Override?: string): Promise<string> {
    if (this.isBusy()) {
      throw new Error('TrelEmu: загрузка уже выполняется');
    }
    this.currentAbort = new AbortController();
    const url = urlOverride || process.env.TRELEMU_PACK_URL || DEFAULT_URL;
    const targetDir = this.resolveTargetDir();
    const baseName = 'trel-emu-pack.zip';
    const partialPath = this.getPartialPath(targetDir, baseName);
    const tmpFinalPath = path.join(os.tmpdir(), `${baseName}-${Date.now()}-${process.pid}`);

    try {
      // 1) Узнаём, можно ли resume'ить и сколько байт уже есть.
      const resumedFrom = await this.getResumableBytes(targetDir, baseName, url);
      this.resumeStartBytes = resumedFrom;
      if (resumedFrom > 0) {
        this.setState('resuming', resumedFrom, 0, `Возобновляем с ${(resumedFrom / 1024 / 1024).toFixed(1)} МБ…`);
      }

      // 2) HEAD / Range: — узнаём Content-Length и поддержку Range.
      this.startTime = Date.now();
      this.lastTime = this.startTime;
      this.lastDownloaded = resumedFrom;
      this.measuredSpeed = 0;

      const headRes = await this.fetchHeadOrRange(url, resumedFrom, this.currentAbort.signal);
      const { contentLength, acceptsRanges, etag, lastModified, body } = headRes;
      if (contentLength <= 0) {
        throw new Error('Сервер не прислал Content-Length — невозможно верифицировать целостность');
      }
      if (resumedFrom > 0 && resumedFrom >= contentLength) {
        // .partial уже полный — сразу к проверке.
        const verified = await this.verifyPartialSha1(partialPath, sha1Override, url);
        if (!verified) {
          try { await fsp.unlink(partialPath); } catch {}
          await this.clearMeta(targetDir, baseName);
          throw new Error('.partial уже полный, но SHA1 не сошёлся — удалили, начни заново');
        }
        await this.finalizeFromPartial(partialPath, targetDir, contentLength, tmpFinalPath);
        return targetDir;
      }

      // 3) Сохраняем метаданные для будущих resume.
      const expectedSha1 = sha1Override || process.env.TRELEMU_PACK_SHA1 || await this.tryFetchSha1(url) || null;
      await this.writeMeta(targetDir, baseName, {
        url,
        expectedSha1,
        totalSize: contentLength,
        etag,
        lastModified,
        acceptsRanges,
        startedAt: Date.now(),
      });

      // 4) Качаем в .partial.
      this.setState('downloading', resumedFrom, contentLength,
        resumedFrom > 0
          ? `Возобновляем с ${(resumedFrom / 1024 / 1024).toFixed(1)} МБ…`
          : 'Скачиваем TrelEmu…');
      const { downloaded, sha1Computed } = await this.streamToFile(body, partialPath, resumedFrom, contentLength, acceptsRanges);
      this.lastDownloaded = downloaded;
      this.lastTime = Date.now();

      // 5) Верифицируем SHA1.
      this.setState('verifying', downloaded, contentLength, 'Проверяем целостность…');
      if (expectedSha1 && expectedSha1 !== DEFAULT_SHA1 && expectedSha1 !== sha1Computed) {
        // SHA1 не сошёлся — удаляем .partial чтобы при следующем запуске не resume'или мусор.
        try { await fsp.unlink(partialPath); } catch {}
        await this.clearMeta(targetDir, baseName);
        throw new Error(`SHA1 не совпадает: ожидалось ${expectedSha1}, получено ${sha1Computed}`);
      }

      // 6) Распаковываем .partial (он уже полный) в целевую папку.
      this.setState('extracting', downloaded, contentLength, 'Распаковываем…');
      await this.extractZip(partialPath, targetDir);

      // 7) Чистим .partial и .meta.json (распакованный архив больше не нужен).
      try { await fsp.unlink(partialPath); } catch {}
      await this.clearMeta(targetDir, baseName);

      this.setState('done', contentLength, contentLength, 'Готово');
      this.emit('progress', this.snapshot(contentLength, contentLength, 'Установка завершена'));
      return targetDir;
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        this.setState('cancelled', 0, 0, 'Отменено');
        throw new Error('Загрузка отменена');
      }
      this.setState('error', 0, 0, '', (e as Error).message);
      throw e;
    } finally {
      this.currentAbort = null;
      this.resumeStartBytes = 0;
    }
  }

  /**
   * Распаковка из уже-полного .partial. Если финальный файл не нужен —
   * распаковываем напрямую.
   */
  private async finalizeFromPartial(
    partialPath: string,
    targetDir: string,
    total: number,
    _tmpFinalPath: string,
  ): Promise<void> {
    this.setState('extracting', total, total, 'Распаковываем…');
    await this.extractZip(partialPath, targetDir);
    try { await fsp.unlink(partialPath); } catch {}
    this.setState('done', total, total, 'Готово');
    this.emit('progress', this.snapshot(total, total, 'Установка завершена'));
  }

  /** Считает SHA1 .partial. Возвращает true если совпал с эталоном (или эталона нет). */
  private async verifyPartialSha1(partialPath: string, sha1Override: string | undefined, url: string): Promise<boolean> {
    const expectedSha1 = sha1Override || process.env.TRELEMU_PACK_SHA1 || await this.tryFetchSha1(url);
    if (!expectedSha1 || expectedSha1 === DEFAULT_SHA1) return true;
    const computed = await this.sha1File(partialPath);
    return computed.toLowerCase() === expectedSha1.toLowerCase();
  }

  private async sha1File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha1');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private setState(state: DownloadState, downloaded: number, total: number, message: string, error?: string) {
    this.state = state;
    this.emit('progress', this.snapshot(downloaded, total, message, error));
  }

  private snapshot(downloaded: number, total: number, message: string, error?: string): DownloadProgress {
    return {
      state: this.state,
      downloaded,
      total,
      ratio: total > 0 ? Math.min(1, downloaded / total) : 0,
      speed: this.measuredSpeed,
      message,
      error,
      resumedFrom: this.resumeStartBytes > 0 ? this.resumeStartBytes : undefined,
    };
  }

  /**
   * Делает HEAD (или Range: bytes=0-0 если есть resume), чтобы узнать Content-Length
   * и поддержку Range. Возвращает body для дальнейшего чтения (если это был GET).
   */
  private async fetchHeadOrRange(
    url: string,
    resumedFrom: number,
    signal: AbortSignal,
  ): Promise<{
    contentLength: number;
    acceptsRanges: boolean;
    etag: string | null;
    lastModified: string | null;
    body: ReadableStream<Uint8Array> | null;
  }> {
    // Сначала пробуем Range: bytes=0-0 — заодно проверим поддержку и получим
    // Content-Length через Content-Range (если сервер вернёт 206).
    if (resumedFrom > 0) {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Range: `bytes=${resumedFrom}-` },
        signal,
      });
      if (res.status === 206) {
        const contentRange = res.headers.get('content-range') || '';
        const m = /\/(\d+)/.exec(contentRange);
        const total = m ? parseInt(m[1], 10) : 0;
        return {
          contentLength: total,
          acceptsRanges: true,
          etag: res.headers.get('etag'),
          lastModified: res.headers.get('last-modified'),
          body: res.body,
        };
      }
      if (res.status === 200) {
        // Сервер проигнорировал Range и шлёт с нуля. Отбрасываем .partial.
        try { await fsp.unlink(this.getPartialPath(this.resolveTargetDir(), 'trel-emu-pack.zip')); } catch {}
        const total = parseInt(res.headers.get('content-length') || '0', 10);
        return {
          contentLength: total,
          acceptsRanges: false,
          etag: res.headers.get('etag'),
          lastModified: res.headers.get('last-modified'),
          body: res.body,
        };
      }
      if (res.status === 416) {
        // .partial >= сервера. Считаем полным.
        const contentRange = res.headers.get('content-range') || '';
        const m = /\/(\d+)/.exec(contentRange);
        const total = m ? parseInt(m[1], 10) : 0;
        return { contentLength: total, acceptsRanges: true, etag: null, lastModified: null, body: null };
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} — не удалось скачать ${url}`);
    }

    // Первый старт: чистый GET.
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} — файл недоступен по URL ${url}`);
    }
    const total = parseInt(res.headers.get('content-length') || '0', 10);
    return {
      contentLength: total,
      acceptsRanges: res.headers.get('accept-ranges') === 'bytes',
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      body: res.body,
    };
  }

  private async streamToFile(
    body: ReadableStream<Uint8Array> | null,
    dest: string,
    startOffset: number,
    total: number,
    acceptsRanges: boolean,
  ): Promise<{ downloaded: number; sha1Computed: string }> {
    if (!body) {
      throw new Error('Сервер не прислал тело ответа (resume не возможен)');
    }
    const speedSamples: { time: number; bytes: number }[] = [];
    // Открываем файл в 'a' (append) если resume'им, иначе 'w' (перезапись).
    // Создаём директорию на всякий случай (она уже должна быть).
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest, {
      flags: startOffset > 0 ? 'a' : 'w',
      start: startOffset > 0 ? startOffset : 0,
    });
    const hash = crypto.createHash('sha1');
    let downloaded = startOffset;

    // Если resume'или, sha1 надо считать от начала файла, а не от startOffset —
    // чтобы проверить ВЕСЬ файл. Досчитываем хэш уже-скачанной части.
    if (startOffset > 0) {
      const readHashFromFile = () => new Promise<void>((resolve, reject) => {
        const r = fs.createReadStream(dest, { start: 0, end: startOffset - 1 });
        r.on('data', (chunk) => hash.update(chunk));
        r.on('end', resolve);
        r.on('error', reject);
      });
      await readHashFromFile();
    }

    try {
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        // Пишем в файл.
        if (!file.write(Buffer.from(value))) {
          await new Promise<void>((resolve) => file.once('drain', () => resolve()));
        }
        hash.update(value);
        downloaded += value.byteLength;
        // Throttled progress.
        const now = Date.now();
        speedSamples.push({ time: now, bytes: downloaded });
        while (speedSamples.length > 0 && now - speedSamples[0].time > 5000) speedSamples.shift();
        if (now - this.lastProgressEmit > PROGRESS_THROTTLE_MS) {
          this.lastProgressEmit = now;
          if (speedSamples.length >= 2) {
            const first = speedSamples[0];
            const dt = (now - first.time) / 1000;
            this.measuredSpeed = dt > 0 ? (downloaded - first.bytes) / dt : 0;
          } else {
            const dt = (now - this.startTime) / 1000;
            this.measuredSpeed = dt > 0 ? downloaded / dt : 0;
          }
          this.emit('progress', this.snapshot(downloaded, total, acceptsRanges
            ? `Скачиваем TrelEmu (resume с ${(startOffset / 1024 / 1024).toFixed(1)} МБ)…`
            : 'Скачиваем TrelEmu…'));
        }
      }
      // Если сервер не поддерживает Range и прислал с нуля — downloaded уже total,
      // и файл перезаписан с нуля (мы открыли 'w'). Тут всё ок.
      await new Promise<void>((resolve, reject) => {
        file.end((err: Error | null | undefined) => err ? reject(err) : resolve());
      });
    } catch (e) {
      try { file.destroy(); } catch {}
      throw e;
    }
    // Последняя проверка: если expected total и downloaded != total — ошибка.
    if (total > 0 && downloaded !== total && acceptsRanges) {
      throw new Error(`Скачано ${downloaded} байт, ожидалось ${total} (Range не сошёлся)`);
    }
    return { downloaded, sha1Computed: hash.digest('hex') };
  }

  /** Пытается скачать .sha1 рядом с .zip (часто кладут для верификации). */
  private async tryFetchSha1(url: string): Promise<string | null> {
    try {
      const sha1Url = url.replace(/\.zip$/i, '.zip.sha1');
      const res = await fetch(sha1Url, { signal: this.currentAbort?.signal });
      if (!res.ok) return null;
      const text = (await res.text()).trim().split(/\s+/)[0];
      return /^[0-9a-f]{40}$/i.test(text) ? text.toLowerCase() : null;
    } catch { return null; }
  }

  /**
   * Минимальный zip-экстрактор. Поддерживает STORE (метод 0) и DEFLATE (метод 8).
   * ZIP64 не используем (файлы маленькие, общий pack < 2 ГБ). Encryption тоже.
   */
  private async extractZip(zipPath: string, targetDir: string): Promise<void> {
    const data = await fsp.readFile(zipPath);
    const entries: ManifestFile[] = [];
    const eocd = this.findEocd(data);
    if (!eocd) throw new Error('Повреждённый zip: не найден EOCD');
    const cdSize = eocd[12] | (eocd[13] << 8) | (eocd[14] << 16) | (eocd[15] << 24);
    const cdOffset = eocd[16] | (eocd[17] << 8) | (eocd[18] << 16) | (eocd[19] << 24);
    const cdCount = eocd[10] | (eocd[11] << 8);

    let p = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      if (p >= data.length || data.readUInt32LE(p) !== 0x02014b50) {
        throw new Error('Повреждённый zip: bad CD entry');
      }
      const method = data.readUInt16LE(p + 10);
      const compSize = data.readUInt32LE(p + 20);
      const uncompSize = data.readUInt32LE(p + 24);
      const nameLen = data.readUInt16LE(p + 28);
      const extraLen = data.readUInt16LE(p + 30);
      const commentLen = data.readUInt16LE(p + 32);
      const localHdrOffset = data.readUInt32LE(p + 42);
      const name = data.slice(p + 46, p + 46 + nameLen).toString('utf-8');
      entries.push({
        name,
        size: uncompSize,
        compressedSize: compSize,
        offset: localHdrOffset,
        crc32: data.readUInt32LE(p + 16),
        isDir: name.endsWith('/'),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }

    await fsp.mkdir(targetDir, { recursive: true });
    for (const entry of entries) {
      if (entry.isDir) continue;
      const safeName = this.sanitizeName(entry.name);
      if (!safeName) {
        throw new Error(`zip slip: ${entry.name}`);
      }
      const outPath = path.join(targetDir, safeName);
      if (!outPath.startsWith(targetDir + path.sep) && outPath !== targetDir) {
        throw new Error(`zip slip: ${entry.name}`);
      }
      if (data.readUInt32LE(entry.offset) !== 0x04034b50) {
        throw new Error(`Повреждённый zip: local header для ${entry.name}`);
      }
      const localNameLen = data.readUInt16LE(entry.offset + 26);
      const localExtraLen = data.readUInt16LE(entry.offset + 28);
      const dataStart = entry.offset + 30 + localNameLen + localExtraLen;
      const method = data.readUInt16LE(entry.offset + 8);
      const compressed = data.slice(dataStart, dataStart + entry.compressedSize);
      let uncompressed: Buffer;
      if (method === 0) {
        uncompressed = compressed;
      } else if (method === 8) {
        uncompressed = await new Promise<Buffer>((resolve, reject) => {
          const out: Buffer[] = [];
          const inflator = zlib.createInflateRaw();
          Readable.from(compressed)
            .pipe(inflator)
            .on('data', (chunk: Buffer) => out.push(chunk))
            .on('end', () => resolve(Buffer.concat(out)))
            .on('error', reject);
        });
      } else {
        throw new Error(`Неизвестный метод сжатия: ${method}`);
      }
      await fsp.mkdir(path.dirname(outPath), { recursive: true });
      await fsp.writeFile(outPath, uncompressed);
    }
  }

  private findEocd(data: Buffer): Buffer | null {
    const max = Math.min(data.length, 65557);
    for (let i = data.length - 22; i >= data.length - max; i--) {
      if (i < 0) break;
      if (data.readUInt32LE(i) === 0x06054b50) {
        return data.slice(i, i + 22);
      }
    }
    return null;
  }

  private sanitizeName(name: string): string | null {
    if (!name) return null;
    if (name.includes('\\')) return null;
    const normalized = name.replace(/\//g, path.sep);
    if (path.isAbsolute(normalized)) return null;
    const parts = normalized.split(path.sep);
    for (const part of parts) {
      if (part === '..' || part === '.') return null;
    }
    return normalized;
  }
}

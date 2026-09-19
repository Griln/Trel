/**
 * Воркер сканирования источников импорта.
 *
 * detectSources() обходит десятки папок лаунчеров синхронными fs-вызовами и на
 * медленных/сетевых дисках занимает секунды. В main-процессе это замораживает
 * весь UI (Electron обрабатывает IPC и отрисовку в одном event loop), поэтому
 * скан вынесен в отдельный поток. Если поток не удалось запустить (например,
 * файл воркера не распакован из asar), вызывающая сторона молча откатывается
 * на синхронный путь — см. detectSourcesAsync в import.ts.
 *
 * Модуль import.ts не тянет electron, поэтому его можно грузить в воркере.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { detectSources } from './import';

const exclude = typeof (workerData as { excludeGameDir?: unknown } | null)?.excludeGameDir === 'string'
  ? (workerData as { excludeGameDir: string }).excludeGameDir
  : undefined;

try {
  parentPort?.postMessage({ ok: true, sources: detectSources(exclude) });
} catch (e) {
  parentPort?.postMessage({ ok: false, error: (e as Error).message });
}

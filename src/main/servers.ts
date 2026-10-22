import { BrowserWindow } from 'electron';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import axios from 'axios';
import { JavaService } from './java';
import { SkinServer } from './skin-server';
import { AuthlibInjector } from './authlib';
import { isUrlAllowed } from './installer';
import { MinecraftAccount, ServerStatus, ServerInstance, ServerProperties } from '../shared/types';

interface RuntimeState {
  status: ServerStatus;
  proc?: ChildProcessWithoutNullStreams;
  /** A ring buffer of the last lines — sent to a new listener on connect. */
  logBuffer: string[];
}

const LOG_BUFFER_LIMIT = 500;

function defaultProperties(): ServerProperties {
  return {
    motd: 'A Trel-launched server',
    serverPort: 25565,
    maxPlayers: 20,
    gamemode: 'survival',
    difficulty: 'easy',
    pvp: true,
    onlineMode: false,
    whiteList: false,
    spawnProtection: 16,
  };
}

export class ServerService {
  private root: string;
  private indexFile: string;
  private runtimes = new Map<string, RuntimeState>();

  constructor(
    private launcherDir: string,
    private gameDir: string,
    private java: JavaService,
    private skinServer: SkinServer,
    private authlib: AuthlibInjector,
    private getAccounts: () => MinecraftAccount[],
  ) {
    this.root = path.join(launcherDir, 'servers');
    this.indexFile = path.join(this.root, 'index.json');
    fs.mkdirSync(this.root, { recursive: true });
  }

  setGameDir(gameDir: string) {
    this.gameDir = gameDir;
  }

  // ─── Index/persistence ───────────────────────────────────────────────────

  list(): ServerInstance[] {
    try {
      if (!fs.existsSync(this.indexFile)) return [];
      const raw = JSON.parse(fs.readFileSync(this.indexFile, 'utf-8'));
      if (!Array.isArray(raw)) return [];
      // Broken records do not take down the whole list: we clean them one by one, dropping the junk.
      const out: ServerInstance[] = [];
      for (const inst of raw) {
        try { out.push(this.sanitize(inst)); } catch { /* bad entry dropped */ }
      }
      return out;
    } catch {
      return [];
    }
  }

  private save(list: ServerInstance[]): void {
    // Atomic: a crash in the middle of the write no longer leaves an empty index.json
    // (= the loss of ALL servers from the UI).
    const tmp = this.indexFile + '.trel_tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8');
    try { fs.renameSync(tmp, this.indexFile); }
    catch { fs.copyFileSync(tmp, this.indexFile); try { fs.unlinkSync(tmp); } catch {} }
  }

  /** Sanitizes a server record: id/port/motd/name from an untrusted index.json. */
  private sanitize(inst: ServerInstance): ServerInstance {
    return sanitizeServerInstance(inst as unknown as Record<string, unknown>);
  }

  private getOrThrow(id: string): ServerInstance {
    const it = this.list().find((s) => s.id === id);
    if (!it) throw new Error('Сервер не найден');
    return it;
  }

  serverDir(id: string): string {
    return path.join(this.root, id);
  }

  /** The current status (for one or for all — the UI requests it once on load). */
  status(id: string): ServerStatus {
    return this.runtimes.get(id)?.status ?? 'stopped';
  }

  statuses(): Record<string, ServerStatus> {
    const out: Record<string, ServerStatus> = {};
    for (const s of this.list()) out[s.id] = this.status(s.id);
    return out;
  }

  /** Returns the buffer of the last logs (for reopening the console in the UI). */
  logBuffer(id: string): string[] {
    return this.runtimes.get(id)?.logBuffer.slice() ?? [];
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Creates a new server: downloads server.jar for the given version (if
   * Mojang provides it — for very old versions it may be missing, then it's an error),
   * writes eula=true, server.properties with the defaults, adds it to index.json.
   */
  async create(input: {
    name: string;
    versionId: string;
    memoryMb: number;
    properties?: Partial<ServerProperties>;
    onProgress?: (p: { stage: string; percent: number }) => void;
  }): Promise<ServerInstance> {
    const id = crypto.randomBytes(6).toString('hex');
    const dir = path.join(this.root, id);
    fs.mkdirSync(dir, { recursive: true });

    input.onProgress?.({ stage: 'Чтение метаданных версии', percent: 5 });
    // We pull the version JSON through the installer's cache (gameDir/versions/<id>/<id>.json),
    // so that we don't duplicate the manifest logic. If the JSON is not downloaded yet — the installer
    // will load it into gameDir, without downloading client.jar/assets.
    const verJson = await this.fetchVersionJson(input.versionId);
    const serverDownload = verJson.downloads?.server;
    if (!serverDownload?.url) {
      // Remove the already created folder, we leave no junk behind
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      throw new Error(`У версии ${input.versionId} нет официального server.jar (Mojang его не предоставляет).`);
    }

    input.onProgress?.({ stage: 'Скачивание server.jar', percent: 15 });
    const jarPath = path.join(dir, 'server.jar');
    await this.download(serverDownload.url, jarPath, (loaded, total) => {
      const pct = total > 0 ? 15 + Math.round((loaded / total) * 70) : 50;
      input.onProgress?.({ stage: `Скачивание server.jar`, percent: Math.min(pct, 85) });
    });

    // Verify SHA-1 — mandatory for server.jar integrity
    if (typeof serverDownload.sha1 !== 'string' || !/^[a-f0-9]{40}$/i.test(serverDownload.sha1)) {
      try { fs.unlinkSync(jarPath); } catch {}
      throw new Error(`SHA-1 hash missing or invalid for server.jar — cannot verify download integrity`);
    }
    const actual = crypto.createHash('sha1').update(fs.readFileSync(jarPath)).digest('hex');
    if (actual.toLowerCase() !== serverDownload.sha1.toLowerCase()) {
      try { fs.unlinkSync(jarPath); } catch {}
      throw new Error(`SHA-1 mismatch for server.jar: expected ${serverDownload.sha1}, got ${actual}`);
    }

    // EULA — without it the server does not start. The launcher accepts it automatically,
    // because the user has already agreed by launching the client.
    fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n', 'utf-8');

    const props = { ...defaultProperties(), ...input.properties };
    fs.writeFileSync(path.join(dir, 'server.properties'), this.encodeProperties(props), 'utf-8');

    const memoryMb = Number.isFinite(input.memoryMb) ? Math.max(512, Math.min(input.memoryMb, 65536)) : 2048;
    const instance: ServerInstance = {
      id,
      name: input.name.trim() || `Server-${id.slice(0, 4)}`,
      versionId: input.versionId,
      createdAt: new Date().toISOString(),
      memoryMb,
      properties: props,
    };
    const list = this.list();
    list.push(instance);
    this.save(list);

    input.onProgress?.({ stage: 'Готово', percent: 100 });
    return instance;
  }

  delete(id: string): void {
    const inst = this.getOrThrow(id);
    if (this.status(id) !== 'stopped') {
      throw new Error('Сервер запущен — сначала остановите его');
    }
    const list = this.list().filter((s) => s.id !== id);
    this.save(list);
    try { fs.rmSync(this.serverDir(inst.id), { recursive: true, force: true }); } catch {}
    this.runtimes.delete(id);
  }

  setProperties(id: string, patch: Partial<ServerProperties>): ServerInstance {
    const list = this.list();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('Сервер не найден');
    // The patch is sanitized too: the port within the range, the motd without CRLF — otherwise
    // stored-XSS and a crashing port bind came in through the "trusted" call.
    const clean: Partial<ServerProperties> = { ...patch };
    if (clean.serverPort !== undefined) {
      const p = Number(clean.serverPort);
      clean.serverPort = Number.isInteger(p) && p >= 1 && p <= 65535 ? p : list[idx].properties.serverPort;
    }
    if (typeof (clean as Record<string, unknown>).motd === 'string') {
      (clean as Record<string, unknown>).motd = ((clean as Record<string, unknown>).motd as string).replace(/[\r\n]/g, ' ').slice(0, 128);
    }
    if (typeof (clean as Record<string, unknown>).maxPlayers === 'number') {
      const mp = Number((clean as Record<string, unknown>).maxPlayers);
      (clean as Record<string, unknown>).maxPlayers = Number.isInteger(mp) && mp >= 1 && mp <= 1000 ? mp : list[idx].properties.maxPlayers;
    }
    if ((clean as Record<string, unknown>).levelName !== undefined) {
      const ln = String((clean as Record<string, unknown>).levelName);
      if (!/^[a-zA-Z0-9а-яА-Я_\- ]{1,64}$/.test(ln) || ln.includes('..')) {
        throw new Error('Bad levelName');
      }
    }
    const updated: ServerInstance = {
      ...list[idx],
      properties: { ...list[idx].properties, ...clean },
    };
    list[idx] = updated;
    this.save(list);
    // We overwrite server.properties — the changes take effect on the next start.
    fs.writeFileSync(
      path.join(this.serverDir(id), 'server.properties'),
      this.encodeProperties(updated.properties),
      'utf-8',
    );
    return updated;
  }

  rename(id: string, name: string): ServerInstance {
    const list = this.list();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('Сервер не найден');
    // The name travels to the UI and index.json: we cut CRLF (stored-XSS) and the length.
    list[idx] = { ...list[idx], name: name.replace(/[\r\n]/g, ' ').trim().slice(0, 64) || list[idx].name };
    this.save(list);
    return list[idx];
  }

  setMemory(id: string, memoryMb: number): ServerInstance {
    const list = this.list();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('Сервер не найден');
    const val = Number.isFinite(memoryMb) ? Math.max(512, Math.min(memoryMb, 65536)) : 2048;
    list[idx] = { ...list[idx], memoryMb: val };
    this.save(list);
    return list[idx];
  }

  // ─── Run/stop ────────────────────────────────────────────────────────────

  async start(id: string, win: BrowserWindow): Promise<void> {
    const inst = this.getOrThrow(id);
    const cur = this.runtimes.get(id);
    if (cur && cur.proc && (cur.status === 'running' || cur.status === 'starting')) {
      return; // already running
    }

    const dir = this.serverDir(id);
    const jarPath = path.join(dir, 'server.jar');
    if (!fs.existsSync(jarPath)) throw new Error('server.jar не найден — пересоздайте сервер');

    // We overwrite server.properties from the current settings of the instance. This
    // pulls in the fresh edits of the launcher (server-ip=0.0.0.0, new keys)
    // even on servers created in older versions of Trel.
    fs.writeFileSync(
      path.join(dir, 'server.properties'),
      this.encodeProperties(inst.properties),
      'utf-8',
    );

    // We check that the port is free beforehand: otherwise the server will start and crash with
    // "Address already in use" and the user will only see the log afterwards.
    const portFree = await this.isPortFree(inst.properties.serverPort);
    if (!portFree) {
      throw new Error(
        `Порт ${inst.properties.serverPort} уже занят. ` +
        `Закройте программу которая его слушает или поменяйте порт в настройках сервера.`,
      );
    }

    // Java: the version requires the same major as the client. We take it from the version JSON.
    const verJson = await this.fetchVersionJson(inst.versionId);
    let major = verJson.javaVersion?.majorVersion ?? 8;
    const javaInfo = await this.java.findBest(major) ?? await this.java.ensure(major, win);
    const javaPath = javaInfo.path;

    // ─── authlib-injector for the server ───────────────────────────────────────
    // Without it an offline client with a UUID unknown to Mojang cannot pass
    // the server-side "hasJoined" check — the client sees "Failed to verify
    // username". We connect the same mock server as for the client —
    // it answers that the player is legit, and the server lets it in.
    const accounts = this.getAccounts();
    let authlibServerArgs: string[] = [];
    try {
      this.skinServer.setAccounts(accounts);
      const [apiUrl, agentPath] = await Promise.all([
        this.skinServer.start(),
        this.authlib.ensure(),
      ]);
      authlibServerArgs = [`-javaagent:${agentPath}=${apiUrl}`];
      this.broadcastLog(win, id, `[launcher] authlib-injector активен (${apiUrl})\n`);
    } catch (e) {
      this.broadcastLog(win, id, `[launcher] authlib-injector недоступен (${(e as Error).message}) — перевожу сервер в offline-mode на этот запуск\n`);
      // We force offline-mode only in server.properties for this launch,
      // we do NOT save it in index.json — so that on the next (successful) launch
      // the user is not surprised that onlineMode "reset itself".
      if (inst.properties.onlineMode) {
        fs.writeFileSync(path.join(dir, 'server.properties'), this.encodeProperties({ ...inst.properties, onlineMode: false }), 'utf-8');
      }
    }

    const args = [
      `-Xms${Math.max(256, Math.floor(inst.memoryMb / 2))}M`,
      `-Xmx${inst.memoryMb}M`,
      '-Dfile.encoding=UTF-8',
      // We force IPv4: otherwise on some Windows configs the socket binds
      // to IPv6, and the IPv4 client (including 127.0.0.1) does not reach it.
      '-Djava.net.preferIPv4Stack=true',
      ...authlibServerArgs,
      '-jar', jarPath,
      'nogui',
    ];

    const state: RuntimeState = { status: 'starting', logBuffer: [] };
    this.runtimes.set(id, state);
    this.broadcastStatus(win, id, 'starting');
    this.broadcastLog(win, id, `[launcher] Запуск сервера: ${javaPath} ${args.join(' ')}\n`);

    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = spawn(javaPath, args, {
        cwd: dir,
        windowsHide: true,
      });
    } catch (e) {
      state.status = 'error';
      this.broadcastStatus(win, id, 'error');
      throw e;
    }
    state.proc = proc;

    // On Windows we try to open the port in the firewall in advance. Without this the first
    // launch shows a system dialog that the user may close without looking — after that
    // the server "works", but nobody from the LAN can connect.
    // netsh does not require UAC if the rule was already created by the user, or it will add
    // the rule to the profile of the current user. We silently ignore a failure.
    if (process.platform === 'win32') {
      this.tryAddFirewallRule(inst.properties.serverPort).catch(() => {});
    }

    proc.stdout.setEncoding('utf-8');
    proc.stderr.setEncoding('utf-8');

    const onChunk = (chunk: string) => {
      // The server writes logs in chunks — we convert them to lines for the buffer/UI.
      const lines = chunk.split(/(?<=\n)/);
      for (const line of lines) {
        if (!line) continue;
        state.logBuffer.push(line);
        if (state.logBuffer.length > LOG_BUFFER_LIMIT) state.logBuffer.shift();
        this.broadcastLog(win, id, line);
        // Fatal bind errors — turn into error status with clear message
        if (state.status === 'starting' && /FAILED TO BIND TO PORT|Address already in use|Perhaps a server is already running/i.test(line)) {
          state.status = 'error';
          this.broadcastStatus(win, id, 'error');
          this.broadcastLog(win, id, `[launcher] Port ${inst.properties.serverPort} занят другим процессом — сервер не смог стартовать.\n`);
        }

        // Heuristic: "Done (… For help…": the server has finished starting.
        if (state.status === 'starting' && /^\[.+?\] \[.+?\]: Done \(/m.test(line)) {
          state.status = 'running';
          this.broadcastStatus(win, id, 'running');
        }
      }
    };
    proc.stdout.on('data', onChunk);
    proc.stderr.on('data', onChunk);

    const cleanupListeners = () => {
      proc.stdout.off('data', onChunk);
      proc.stderr.off('data', onChunk);
    };

    proc.on('exit', (code, signal) => {
      cleanupListeners();
      this.broadcastLog(win, id, `[launcher] Сервер завершился (код ${code}, сигнал ${signal ?? '-'})
`);
      state.proc = undefined;
      state.status = 'stopped';
      this.broadcastStatus(win, id, 'stopped');
    });
    proc.on('error', (err) => {
      cleanupListeners();
      this.broadcastLog(win, id, `[launcher] Ошибка процесса: ${err.message}\n`);
      state.status = 'error';
      this.broadcastStatus(win, id, 'error');
    });
    proc.on('error', (err) => {
      this.broadcastLog(win, id, `[launcher] Ошибка процесса: ${err.message}\n`);
      state.status = 'error';
      this.broadcastStatus(win, id, 'error');
    });
  }

  /**
   * Gracefully stops the server: writes `stop` to stdin (this correctly
   * saves the world and closes the port). If the process does not respond within
   * 30 seconds — kill -9. On Windows we use taskkill /F /T to
   * kill the child JVM processes, otherwise the port may stay in TIME_WAIT.
   */
  async stop(id: string, win: BrowserWindow): Promise<void> {
    const state = this.runtimes.get(id);
    if (!state || !state.proc) return;
    if (state.status === 'stopped' || state.status === 'stopping') return;

    state.status = 'stopping';
    this.broadcastStatus(win, id, 'stopping');
    try { state.proc.stdin.write('stop\n'); } catch {}

    const proc = state.proc;
    // We keep the id of the timer to clear it in case of a normal exit —
    // otherwise the handle lives in the background for 30s and on a quick repeated start the timer
    // fires at the wrong process.
    const killTimer = setTimeout(async () => {
      if (proc.exitCode !== null || proc.killed) return;
      if (process.platform === 'win32') {
        // taskkill /F /T kills the process and all its descendants. SIGKILL on
        // Windows through node — is TerminateProcess of the root only, but the JVM
        // often spawns child processes.
        let killed = false;
        try {
          await new Promise<void>((resolve) => {
            const tk = spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { windowsHide: true });
            tk.on('exit', (code) => { killed = code === 0; resolve(); });
            tk.on('error', () => resolve());
            setTimeout(() => resolve(), 5000); // safety cap
          });
        } catch {}
        if (!killed) {
          try { proc.kill('SIGKILL'); } catch {}
        }
      } else {
        try { proc.kill('SIGKILL'); } catch {}
      }
    }, 30_000);
    proc.once('exit', () => {
      clearTimeout(killTimer);
      // Clean up runtime entry to prevent memory leak on repeated start/stop cycles
      this.runtimes.delete(id);
    });
  }

  /** Sends an arbitrary command to the server stdin (without the slash prefix). */
  sendCommand(id: string, command: string): void {
    const state = this.runtimes.get(id);
    if (!state?.proc) throw new Error('Сервер не запущен');
    if (!command.trim()) return;
    // Protection against command injection: we forbid the newline, \r and null-byte,
    // so that several commands cannot be injected in a single call.
    if (/[\n\r\0]/.test(command)) {
      throw new Error('Command contains forbidden characters (newline or null)');
    }
    // Length limit: a 10MB flood of a single string filled up the server stdin buffer (DoS).
    if (command.length > 512) throw new Error('Command too long (max 512 chars)');
    // Minecraft commands do not require a leading "/", stdin does not understand it —
    // we strip it if the user typed it.
    const trimmed = command.replace(/^\/+/, '').trimEnd();
    state.proc.stdin.write(trimmed + '\n');
  }

  /** Stops all the running servers — called when quitting the launcher.
   *  Returns a Promise that resolves when all the processes have finished
   *  or on timeout (so that before-quit does not hang forever).
   */
  async shutdownAll(): Promise<void> {
    const procs: { proc: ChildProcessWithoutNullStreams; id: string }[] = [];
    for (const [id, state] of this.runtimes.entries()) {
      if (state.proc && state.status !== 'stopped' && state.status !== 'stopping') {
        try { state.proc.stdin.write('stop\n'); } catch {}
        procs.push({ proc: state.proc, id });
      }
    }
    if (!procs.length) return;
    // We wait for all the processes to finish, but no longer than 8 seconds.
    await Promise.race([
      Promise.all(
        procs.map(
          ({ proc }) =>
            new Promise<void>((resolve) => {
              if (proc.exitCode !== null || proc.killed) { resolve(); return; }
              proc.once('exit', () => resolve());
            })
        )
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
    ]);
  }

  /**
   * Returns the list of available connection addresses for a server. Useful
   * to show the user in the UI: "127.0.0.1:25565" + the LAN IP for friends.
   *
   * We take only IPv4, not loopback, not link-local, not the virtual interfaces
   * of VirtualBox/VMware (they do not let the players really connect).
   *
   * We use exactly 127.0.0.1 and not "localhost": in Minecraft 1.21+ the name
   * "localhost" is resolved to IPv6 ::1 first, and with a difference in the
   * IPv4/IPv6 configuration of the server socket and the client this sometimes
   * results in "cannot connect". 127.0.0.1 is unambiguously IPv4.
   */
  connectAddresses(id: string): { label: string; host: string; port: number }[] {
    const inst = this.list().find((s) => s.id === id);
    if (!inst) return [];
    const port = inst.properties.serverPort;
    const out: { label: string; host: string; port: number }[] = [
      { label: 'Этот же компьютер', host: '127.0.0.1', port },
    ];
    const ifaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs) continue;
      // We skip the obvious VMs/tunnels — the players in the LAN do not see them.
      if (/virtualbox|vmware|hyper-?v|wsl|loopback|tap|tun/i.test(name)) continue;
      for (const a of addrs) {
        if (a.family !== 'IPv4') continue;
        if (a.internal) continue;
        // Link-local (169.254.x.x) — usually nobody connects to it.
        if (a.address.startsWith('169.254.')) continue;
        out.push({ label: `Локальная сеть (${name})`, host: a.address, port });
      }
    }
    return out;
  }

  /**
   * Checks: is the TCP port free. Returns true if it can be taken,
   * false if someone is already listening.
   */
  private async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.close(() => resolve(true));
        })
        .listen(port, '0.0.0.0');
    });
  }

  /**
   * On Windows: adds an inbound firewall rule for the given TCP port
   * (if it does not exist yet). Without this the first launch of the server shows a system
   * dialog "Allow access", and if the user ignores it — only the loopback
   * hears the port.
   *
   * Uses netsh advfirewall. Without admin rights a rule is created for the
   * current profile (Private) — that is enough for a home Wi-Fi network.
   */
  private async tryAddFirewallRule(port: number): Promise<void> {
    if (process.platform !== 'win32') return;
    const ruleName = `Trel Launcher MC ${port}`;
    return new Promise((resolve) => {
      const child = spawn('netsh', [
        'advfirewall', 'firewall', 'add', 'rule',
        `name="${ruleName}"`,
        'dir=in',
        'action=allow',
        'protocol=TCP',
        `localport=${port}`,
        'profile=private,domain',
      ], { windowsHide: true });
      // We don't wait long and ignore the exit code — netsh may return an error
      // if the rule already exists or if there are no rights.
      const t = setTimeout(() => { try { child.kill(); } catch {} ; resolve(); }, 3000);
      child.on('exit', () => { clearTimeout(t); resolve(); });
      child.on('error', () => { clearTimeout(t); resolve(); });
    });
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private broadcastStatus(win: BrowserWindow, id: string, status: ServerStatus): void {
    if (win.isDestroyed()) return;
    win.webContents.send('servers:status', id, status);
  }

  private broadcastLog(win: BrowserWindow, id: string, line: string): void {
    if (win.isDestroyed()) return;
    win.webContents.send('servers:log', id, line);
  }

  private encodeProperties(p: ServerProperties): string {
    // Only the basic keys — Mojang fills the rest with defaults on the first start.
    const lines = [
      `# Generated by Trel Launcher at ${new Date().toISOString()}`,
      `motd=${escapePropValue(p.motd)}`,
      // We explicitly bind to all IPv4 — otherwise on some systems the server
      // listens only on IPv6 ::, and the clients on a local IPv4 cannot reach it.
      `server-ip=0.0.0.0`,
      `server-port=${p.serverPort}`,
      `query.port=${p.serverPort}`,
      `max-players=${p.maxPlayers}`,
      `gamemode=${p.gamemode}`,
      `difficulty=${p.difficulty}`,
      `pvp=${p.pvp}`,
      `online-mode=${p.onlineMode}`,
      `white-list=${p.whiteList}`,
      `spawn-protection=${p.spawnProtection}`,
      // Direct output to the launcher console, without ANSI
      `enable-jmx-monitoring=false`,
      // 1.19+: enforce-secure-profile requires the client to have signed
      // certificates from Mojang. Offline accounts do not have them → the server
      // rejects the connection with "Failed to verify username".
      // We disable it — it is compatible with all clients (1.19+ simply does not
      // sign the chat, and 1.21+ works even without the signature).
      `enforce-secure-profile=false`,
      `prevent-proxy-connections=false`,
    ];
    if (p.levelName) lines.push(`level-name=${p.levelName}`);
    return lines.join('\n') + '\n';
  }

  /**
   * Publishing a single-player world as a server: next to server.jar we put a copy
   * of the world and the level-name in the properties. A copy, not a move — the world
   * stays playable in single-player too. session.lock and the other runtime files are not copied.
   */
  async publishWorld(worldDir: string, worldName: string, versionId: string, memoryMb: number): Promise<ServerInstance> {
    const safeWorld = worldName.replace(/[^a-zA-Z0-9а-яА-Я_\- ]/g, '_').trim().slice(0, 64);
    if (!safeWorld) throw new Error('Bad world name');
    const inst = await this.create({ name: safeWorld, versionId, memoryMb });
    try {
      const dest = path.join(this.serverDir(inst.id), safeWorld);
      fs.mkdirSync(dest, { recursive: true });
      const SKIP = new Set(['session.lock', 'session.lock.old']);
      const walk = (dir: string, rel: string) => {
        for (const name of fs.readdirSync(dir)) {
          if (SKIP.has(name)) continue;
          const full = path.join(dir, name);
          const st = fs.lstatSync(full);
          if (st.isSymbolicLink()) continue;
          if (st.isDirectory()) {
            fs.mkdirSync(path.join(dest, rel, name), { recursive: true });
            walk(full, rel ? `${rel}/${name}` : name);
          } else if (st.isFile()) {
            fs.copyFileSync(full, path.join(dest, rel, name));
          }
        }
      };
      walk(worldDir, '');
      const withLevel = await this.setProperties(inst.id, { levelName: safeWorld } as Partial<ServerProperties>);
      return withLevel;
    } catch (e) {
      // It did not work out — we drop the half-made server entirely, leaving no junk behind.
      try { fs.rmSync(this.serverDir(inst.id), { recursive: true, force: true }); } catch { /* ignore */ }
      const list = this.list().filter((x) => x.id !== inst.id);
      this.save(list);
      throw e;
    }
  }

  private async fetchVersionJson(versionId: string): Promise<any> {
    // We go to gameDir/versions/<id>/<id>.json (if it is already there from the client install),
    // otherwise we pull it directly from the manifest and save it there as well.
    const jsonPath = path.join(this.gameDir, 'versions', versionId, versionId + '.json');
    if (fs.existsSync(jsonPath)) {
      const j = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      // The server.jar URL for the loader profiles is taken from the parent (inheritsFrom)
      if (j.inheritsFrom && !j.downloads?.server) {
        const parentPath = path.join(this.gameDir, 'versions', j.inheritsFrom, j.inheritsFrom + '.json');
        if (fs.existsSync(parentPath)) {
          const parent = JSON.parse(fs.readFileSync(parentPath, 'utf-8'));
          return { ...parent, ...j, downloads: { ...(parent.downloads ?? {}), ...(j.downloads ?? {}) } };
        }
      }
      return j;
    }
    // Not on disk — we pull it
    const { data: manifest } = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 15000 });
    const entry = (manifest.versions as any[]).find((v) => v.id === versionId);
    if (!entry) throw new Error(`Версия ${versionId} не найдена в манифесте Mojang`);
    const { data: vj } = await axios.get(entry.url, { timeout: 15000 });
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(vj, null, 2), 'utf-8');
    return vj;
  }

  private async download(url: string, dest: string, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (!isUrlAllowed(url)) {
      throw new Error(`Blocked download from untrusted or non-HTTPS host: ${url}`);
    }
    const resp = await axios.get(url, {
      responseType: 'stream',
      timeout: 120_000,
      maxRedirects: 5,
    });
    const totalRaw = resp.headers['content-length'];
    const total = typeof totalRaw === 'string' ? parseInt(totalRaw, 10) || 0 : 0;
    let loaded = 0;
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      resp.data.on('data', (chunk: Buffer) => {
        loaded += chunk.length;
        onProgress?.(loaded, total);
      });
      resp.data.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      resp.data.pipe(out);
    });
  }
}

function escapePropValue(v: string): string {
  // server.properties — Java properties: backslash, =, : have to be escaped.
  return v
    .replace(/\\/g, '\\\\')
    .replace(/=/g, '\\=')
    .replace(/:/g, '\\:')
    .replace(/\n/g, '\\n');
}

/** Sanitizes a server record from an untrusted index.json (exported for tests). */
export function sanitizeServerInstance(inst: Record<string, unknown>): ServerInstance {
  const id = typeof inst.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(inst.id) ? inst.id : null;
  if (!id) throw new Error('Bad server id in index.json');
  const props = (inst.properties ?? {}) as Record<string, unknown>;
  const port = Number(props.serverPort);
  const serverPort = Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 25565;
  const str = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\r\n]/g, ' ').slice(0, max) : '';
  const mp = Number(props.maxPlayers);
  return {
    ...(inst as object),
    id,
    name: str(inst.name, 64) || id,
    properties: { ...props, serverPort, maxPlayers: Number.isInteger(mp) && mp >= 1 && mp <= 1000 ? mp : 20, motd: str(props.motd, 128) || 'Trel Server' },
    memoryMb: Number.isFinite(inst.memoryMb as number) ? Math.max(512, Math.min(inst.memoryMb as number, 65536)) : 2048,
  } as ServerInstance;
}

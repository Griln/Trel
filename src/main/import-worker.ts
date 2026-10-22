/**
 * Worker that scans the import sources.
 *
 * detectSources() walks dozens of launcher folders with synchronous fs calls and
 * takes seconds on slow/network disks. In the main process that freezes the
 * whole UI (Electron handles IPC and rendering in a single event loop), so the
 * scan was moved into a separate thread. If the thread cannot be started (for
 * example, the worker file was not unpacked from asar), the caller silently
 * falls back to the synchronous path — see detectSourcesAsync in import.ts.
 *
 * The import.ts module does not pull in electron, so it can be loaded in the worker.
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

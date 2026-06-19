import type { DownloadProgress } from '../../shared/types';

type Translator = (key: string, params?: Record<string, string | number>) => string;

export function fmtBytes(bytes: number, t: Translator): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 ' + t('size.b');
  if (bytes < 1024) return Math.round(bytes) + ' ' + t('size.b');
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' ' + t('size.kb');
  if (bytes < 1024 ** 3) return (bytes / (1024 * 1024)).toFixed(1) + ' ' + t('size.mb');
  return (bytes / (1024 ** 3)).toFixed(2) + ' ' + t('size.gb');
}



export function formatProgressBytes(p: DownloadProgress, t: Translator): string {
  const total = Math.max(0, p.bytesTotal ?? 0);
  const done = Math.max(0, p.bytesDownloaded ?? 0);

  // Pick the unit for each value independently, so that small `done` values
  // don't round to "0.0 МБ" when `total` is large (e.g. 30 КБ / 185 МБ → 0.0).
  const pickUnit = (b: number): { div: number; key: string; digits: number } => {
    if (b < 1024) return { div: 1, key: 'size.b', digits: 0 };
    if (b < 1024 * 1024) return { div: 1024, key: 'size.kb', digits: 1 };
    if (b < 1024 ** 3) return { div: 1024 * 1024, key: 'size.mb', digits: 1 };
    return { div: 1024 ** 3, key: 'size.gb', digits: 2 };
  };

  if (total <= 0) {
    // total unknown — show just the done value in its natural unit
    const u = pickUnit(done > 0 ? done : 500 * 1024 * 1024);
    return `${(done / u.div).toFixed(u.digits)} ${t(u.key)} · `;
  }

  const lu = pickUnit(done);
  const ru = pickUnit(total);
  const left = (done / lu.div).toFixed(lu.digits);
  const right = (total / ru.div).toFixed(ru.digits);
  return `${left} ${t(lu.key)} / ${right} ${t(ru.key)} · `;
}

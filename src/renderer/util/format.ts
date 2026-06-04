import type { DownloadProgress } from '../../shared/types';

/** Минимальный интерфейс t-функции из i18n — без зависимости от React-контекста. */
type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * Форматирует объём в байтах в человекочитаемый размер: КБ/МБ/ГБ.
 * Для прогресса всегда показываем хотя бы один знак после запятой,
 * чтобы при долгой загрузке пользователь видел что счётчик движется.
 */
export function fmtBytes(bytes: number, t: Translator): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 ' + t('size.b');
  if (bytes < 1024) return Math.round(bytes) + ' ' + t('size.b');
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' ' + t('size.kb');
  if (bytes < 1024 ** 3) return (bytes / (1024 * 1024)).toFixed(1) + ' ' + t('size.mb');
  return (bytes / (1024 ** 3)).toFixed(2) + ' ' + t('size.gb');
}

/**
 * Возвращает строку «56.4 / 312 МБ · » для отображения рядом с процентом
 * прогресса. Если в `progress` нет данных по байтам (например, ранние
 * этапы вроде «Чтение метаданных»), вернёт пустую строку — UI просто
 * покажет один процент.
 *
 * Префикс/суффикс единицы выбирается по `bytesTotal`: если total = 1.2 ГБ,
 * то и downloaded форматируется как ГБ, чтобы не было «1234.5 / 1.20 ГБ».
 */
export function formatProgressBytes(p: DownloadProgress, t: Translator): string {
  const total = p.bytesTotal ?? 0;
  const done = p.bytesDownloaded ?? 0;
  if (total <= 0) return '';

  // Выбираем единицу по total чтобы оба числа были в одной шкале.
  const pickUnit = (b: number): { div: number; key: string; digits: number } => {
    if (b < 1024 * 1024) return { div: 1024, key: 'size.kb', digits: 1 };
    if (b < 1024 ** 3) return { div: 1024 * 1024, key: 'size.mb', digits: 1 };
    return { div: 1024 ** 3, key: 'size.gb', digits: 2 };
  };
  const u = pickUnit(total);
  const left = (done / u.div).toFixed(u.digits);
  const right = (total / u.div).toFixed(u.digits);
  return `${left} / ${right} ${t(u.key)} · `;
}

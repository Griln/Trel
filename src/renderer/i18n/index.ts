import { createContext, useContext } from 'react';
import ru from './ru';
import en from './en';
import zh from './zh';
import es from './es';
import de from './de';

type Locale = 'ru' | 'en' | 'zh' | 'es' | 'de';

const dictionaries: Record<Locale, Record<string, string>> = { ru, en, zh, es, de };

const LocaleContext = createContext<Locale>('ru');

export const LocaleProvider = LocaleContext.Provider;

/**
 * Платформенная подмена путей в i18n-строках.
 *
 * Строки хранятся с Windows-формой (`%APPDATA%\Trel`, `java.exe`, `Trel.exe`),
 * т.к. изначально лаунчер был Windows-only. На Linux/macOS подставляем
 * эквивалент из POSIX-мира, не трогая словари — иначе пришлось бы дублировать
 * каждую строку в ru/en/es/zh/de.
 *
 * Замены осознанно консервативны: `%APPDATA%\Trel` → `~/.config/Trel` (это
 * userData-папка Trel на Linux; на macOS — ~/Library/Application Support/Trel,
 * но мы пока поддерживаем только Linux), а `java.exe` → `java`, `Trel.exe`
 * → `Trel`. Если на Linux/macOS встречается `C:\...`, оставляем как есть —
 * это уже осмысленный «пример Windows-пути» в контексте.
 */
const isLinux = typeof window !== 'undefined' && window.api?.platform === 'linux';
const isMac = typeof window !== 'undefined' && window.api?.platform === 'darwin';
const isPosix = isLinux || isMac;

function applyPlatformSubst(s: string): string {
  if (!isPosix || typeof s !== 'string') return s;
  // %APPDATA%\Trel — это userData-папка Trel. На Linux это ~/.config/Trel,
  // на macOS — ~/Library/Application Support/Trel.
  const trelHome = isMac ? '~/Library/Application Support/Trel' : '~/.config/Trel';
  let out = s.replace(/%APPDATA%\\Trel/g, trelHome)
             .replace(/%APPDATA%\\\\Trel/g, trelHome);
  // %APPDATA%\.minecraft — стандартное расположение Mojang-лаунчера. На Linux
  // Mojang кладёт не в ~/.config, а прямо в ~/ (как и ~/.minecraft), поэтому
  // подставляем именно такой путь.
  const mcHome = isMac ? '~/Library/Application Support/minecraft' : '~/.minecraft';
  out = out.replace(/%APPDATA%\\\.minecraft/g, mcHome)
           .replace(/%APPDATA%\\\\\.minecraft/g, mcHome);
  // Java-исполняемый: на Unix это просто `java`, без .exe.
  out = out.replace(/\bjava\.exe\b/gi, 'java')
           .replace(/\bjavaw\.exe\b/gi, 'java');
  // Trel.exe как имя бинаря — на Unix просто `Trel`.
  out = out.replace(/\bTrel\.exe\b/g, 'Trel');
  return out;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function useT() {
  const locale = useContext(LocaleContext);
  const dict = dictionaries[locale] ?? dictionaries.ru;

  function t(key: string, params?: Record<string, string | number>): string {
    const raw = dict[key] ?? dictionaries.ru[key] ?? key;
    return interpolate(applyPlatformSubst(raw), params);
  }

  t.plural = (count: number, ...forms: string[]): string => {
    if (locale === 'en') {
      return count === 1 ? forms[0] : (forms[1] ?? forms[0]);
    }
    // Russian 3-form
    const abs = Math.abs(count);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1] ?? forms[0];
    return forms[2] ?? forms[1] ?? forms[0];
  };

  t.locale = locale;

  return t;
}

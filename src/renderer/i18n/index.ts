import { createContext, useContext } from 'react';
import ru from './ru';
import en from './en';

type Locale = 'ru' | 'en';

const dictionaries: Record<Locale, Record<string, string>> = { ru, en };

const LocaleContext = createContext<Locale>('ru');

export const LocaleProvider = LocaleContext.Provider;

/**
 * Platform-specific path substitution in i18n strings.
 *
 * The strings are stored in the Windows form (`%APPDATA%\Trel`, `java.exe`, `Trel.exe`),
 * because the launcher was originally Windows-only. On Linux/macOS we substitute
 * the POSIX equivalent without touching the dictionaries — otherwise every single
 * string would have to be duplicated in ru/en.
 *
 * The substitutions are deliberately conservative: `%APPDATA%\Trel` → `~/.config/Trel` (that is
 * the Trel userData folder on Linux; on macOS it is ~/Library/Application Support/Trel,
 * but we only support Linux for now), and `java.exe` → `java`, `Trel.exe`
 * → `Trel`. If a `C:\...` path shows up on Linux/macOS, we leave it as is —
 * in that context it is already a meaningful “Windows path example”.
 */
const isLinux = typeof window !== 'undefined' && window.api?.platform === 'linux';
const isMac = typeof window !== 'undefined' && window.api?.platform === 'darwin';
const isPosix = isLinux || isMac;

function applyPlatformSubst(s: string): string {
  if (!isPosix || typeof s !== 'string') return s;
  // %APPDATA%\Trel — this is the Trel userData folder. On Linux it is ~/.config/Trel,
  // on macOS — ~/Library/Application Support/Trel.
  const trelHome = isMac ? '~/Library/Application Support/Trel' : '~/.config/Trel';
  let out = s.replace(/%APPDATA%\\Trel/g, trelHome)
             .replace(/%APPDATA%\\\\Trel/g, trelHome);
  // %APPDATA%\.minecraft — the standard location of the Mojang launcher. On Linux
  // Mojang does not put it into ~/.config but straight into ~/ (just like ~/.minecraft), so
  // we substitute exactly that path.
  const mcHome = isMac ? '~/Library/Application Support/minecraft' : '~/.minecraft';
  out = out.replace(/%APPDATA%\\\.minecraft/g, mcHome)
           .replace(/%APPDATA%\\\\\.minecraft/g, mcHome);
  // Java executable: on Unix it is simply `java`, without .exe.
  out = out.replace(/\bjava\.exe\b/gi, 'java')
           .replace(/\bjavaw\.exe\b/gi, 'java');
  // Trel.exe as the binary name — on Unix it is simply `Trel`.
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
    // A missing key must never surface as implementation text (for example,
    // "settings.unknownOption") in the UI.
    const raw = dict[key] ?? dictionaries.ru[key] ?? dictionaries.en[key] ?? 'Translation unavailable';
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

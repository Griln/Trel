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

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function useT() {
  const locale = useContext(LocaleContext);
  const dict = dictionaries[locale] ?? dictionaries.ru;

  function t(key: string, params?: Record<string, string | number>): string {
    return interpolate(dict[key] ?? dictionaries.ru[key] ?? key, params);
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

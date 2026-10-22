import { describe, it, expect } from 'vitest';
import ru from './ru';
import en from './en';

const CYRILLIC = /[Ѐ-ӿ]/;

const DICT_RU = ru as Record<string, string>;
const DICT_EN = en as Record<string, string>;

describe('переводы интерфейса', () => {
  it('наборы ключей в русском и английском словарях совпадают', () => {
    const ru = Object.keys(DICT_RU).sort();
    const en = Object.keys(DICT_EN).sort();
    const onlyRu = ru.filter((k) => !(k in DICT_EN));
    const onlyEn = en.filter((k) => !(k in DICT_RU));
    expect(onlyRu, `нет перевода в en.ts: ${onlyRu.join(', ')}`).toEqual([]);
    expect(onlyEn, `нет перевода в ru.ts: ${onlyEn.join(', ')}`).toEqual([]);
  });

  it('в английском словаре нет русских слов', () => {
    const bad = Object.entries(DICT_EN)
      .filter(([, v]) => CYRILLIC.test(v))
      .map(([k, v]) => `${k}: ${v}`);
    expect(bad, `русский текст в en.ts:\n${bad.join('\n')}`).toEqual([]);
  });

  it('в русском словаре нет битой кодировки', () => {
    // Mojibake: UTF-8 decoded as CP1251/CP1252 turns '→', '·', '×' and '~'
    // into sequences of Cyrillic/Latin-1 glyphs. The exact set of glyphs
    // that counts as broken is spelled out in the regex below.
    const mojibake = /[вВ][Ђ†€‰][”‘™°·—–]/;
    const bad = Object.entries(DICT_RU)
      .filter(([, v]) => mojibake.test(v))
      .map(([k, v]) => `${k}: ${v}`);
    expect(bad, `битая кодировка в ru.ts:\n${bad.join('\n')}`).toEqual([]);
  });

  it('в английском словаре нет битой кодировки', () => {
    // Same mojibake pattern as in the Russian dictionary check above.
    const mojibake = /[вВ][Ђ†€‰][”‘™°·—–]/;
    const bad = Object.entries(DICT_EN)
      .filter(([, v]) => mojibake.test(v))
      .map(([k, v]) => `${k}: ${v}`);
    expect(bad, `битая кодировка в en.ts:\n${bad.join('\n')}`).toEqual([]);
  });

  it('значения не пустые', () => {
    const empty = [
      ...Object.entries(DICT_RU).filter(([, v]) => !v.trim()).map(([k]) => `ru:${k}`),
      ...Object.entries(DICT_EN).filter(([, v]) => !v.trim()).map(([k]) => `en:${k}`),
    ];
    expect(empty, `пустые значения:\n${empty.join('\n')}`).toEqual([]);
  });
});

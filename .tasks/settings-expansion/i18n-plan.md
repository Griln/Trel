# i18n Implementation Plan

## Architecture
- Simple key-value approach: `src/renderer/i18n/ru.ts` and `src/renderer/i18n/en.ts`
- `src/renderer/i18n/index.ts` — exports `useT()` hook that returns `t(key)` function
- Hook reads `settings.locale` from React context or prop
- Support interpolation: `t('key', { name: 'value' })` → replaces `{name}` in string
- Support pluralization: `t.plural(count, 'file', 'files')` for English, 3-form for Russian

## Context Provider
- Create `LocaleContext` in i18n/index.ts
- App.tsx wraps everything in `<LocaleProvider locale={settings.locale ?? 'ru'}>`
- All pages call `const t = useT()` at top

## File structure
```
src/renderer/i18n/
  ru.ts    — all Russian strings as flat key-value object
  en.ts    — all English strings  
  index.ts — useT hook, LocaleProvider, types
```

## Approach for each page
For each TSX file, replace every Russian string with `t('page.key')` call.
Keys follow: `section.subsection.key` pattern.

## Implementation order
1. Create i18n infrastructure (3 files)
2. Wire into App.tsx (LocaleProvider)
3. Convert each page one-by-one (can batch related ones)
4. Split SettingsPage into tabs (separate task after i18n)

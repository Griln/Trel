# Релиз 0.5.0

Публикация сейчас только вручную. CI ничего сам не заливает на GitHub.

## Что реально делает CI

`.github/workflows/release.yml` на пуше в `main` и на PR только ставит зависимости и собирает проект:

```bash
npm ci
npm run icon
npm run build
```

Никакого автобампа версии и автопубликации релиза там нет.

## Подготовка версии

Версия берётся из `package.json`. Для 0.5.0 также синхронизированы:

- `package.json`
- корневая версия в `package-lock.json`
- `TrelLauncher/0.5.0` в `src/main/modpacks.ts`

Имена артефактов подставляют `${version}` автоматически.

## Сборка

```bash
npm run build        # проверка сборки без упаковки
npm run dist         # Windows: NSIS-установщик + portable
npm run dist:linux   # Linux: AppImage + deb + rpm
```

Для RPM нужен `rpmbuild`; версия для RPM тоже читается из `package.json`.

## Публикация вручную

1. `build.publish` в `package.json` и remote репозитория смотрят на `Griln/Trel` — перед публикацией убедиться, что это тот репозиторий.
2. Создать релиз на GitHub вручную.
3. Загрузить артефакты из `release/` вместе с `latest.yml`, `latest-linux.yml` и blockmap-файлами.
4. Либо Windows-публикацию через токен из окружения:

```bash
GH_TOKEN=... npm run dist:publish
```

Токены в репозиторий не коммитить.

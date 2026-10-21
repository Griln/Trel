# Contributing to Trel

Спасибо, что хочешь помочь. Trel — лаунчер Minecraft, и любой вклад полезен:
баг-репорт, новый перевод, поддержка нового модлоадера, улучшение интерфейса.

## Быстрый старт

```bash
git clone https://github.com/Griln/Trel.git
cd Trel
npm ci
npm run dev        # Vite + Electron в dev-режиме
```

## Что нужно перед PR

```bash
npm test           # vitest — все тесты
npx tsc --noEmit   # проверка типов
npm run build      # renderer + electron
```

Если что-то не собралось — приложи вывод в PR, это сильно ускорит разбор.

## Структура

| Путь | Что внутри |
|------|-----------|
| `src/main/` | Electron main-процесс: файловая система, запуск игры, автообновление, TrelEmu |
| `src/preload/` | Мост main ↔ renderer через `contextBridge` |
| `src/renderer/` | React-интерфейс: страницы, компоненты, стили, i18n |
| `src/shared/` | Общие типы и константы для main и renderer |
| `resources/` | Статические ресурсы: скины, legacy-данные, platform-tools |
| `scripts/` | Сборка: иконка, RPM, TrelEmu-пак, публикация |
| `previews/` | HTML-превью интерфейса (дизайн-концепты) |

## Правила оформления

- Коммиты — на английском, в стиле Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- Один коммит — одна логичная change
- Код и комментарии — на английском, пользовательский интерфейс — на русском и английском (см. `src/renderer/i18n/`)
- Все пользовательские строки обязаны быть в обоих языках: `ru.ts` и `en.ts`

## Локализация

Добавил новую строку в интерфейсе? Добавь её в оба файла:

```
src/renderer/i18n/ru.ts
src/renderer/i18n/en.ts
```

Ключи должны совпадать один в один. Тест `src/renderer/i18n.test.ts` проверяет это.

## Безопасность

Любая загрузка с внешнего сервера обязана идти по `https` и проверяться по хешу,
если хеш известен. Не отключай проверку целостности и не добавляй `eval`-подобные
конструкции. Подробнее — в [SECURITY.md](SECURITY.md).

## Pull request

1. Создай ветку от `main`: `git checkout -b feat/my-thing`
2. Внеси изменения, запушь
3. Открой PR, опиши **что** изменилось и **зачем**
4. Дождись зелёного CI

Не тащи в PR сгенерированные артефакты: `dist/`, `release/`, `node_modules/`,
`build-trel-emu-cache/` — они в `.gitignore` и не должны попадать в репозиторий.

## Релизы

Релизы публикуются автоматически из CI при пуше тега:

```bash
git tag v0.6.0
git push origin v0.6.0
```

Сборка соберёт Windows и Linux-пакеты и прикрепит их к релизу.

## Код conduct

Участие в проекте подразумевает согласие с [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

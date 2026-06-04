# Автообновления через GitHub Actions

Пушишь код — GitHub автоматически собирает, публикует релиз и раздаёт обновление пользователям. С твоей стороны — только `git push`.

## Одноразовая настройка (10 минут)

### 1. Создать репозиторий

1. Зайди на https://github.com и войди в аккаунт.
2. Нажми `+` вверху справа → **New repository**.
3. Имя: `aurora-launcher` (или любое, главное — запомни).
4. Выбери **Public** (для приватного репо electron-updater всё равно работает, но публичный проще).
5. Ничего больше не добавляй (галочки README, gitignore, license оставь пустыми).
6. Нажми **Create repository**.

### 2. Подставить свой ник в package.json

Открой `package.json` и найди блок:

```json
"publish": [
  {
    "provider": "github",
    "owner": "YOUR_GITHUB_USERNAME",
    "repo": "aurora-launcher",
    "releaseType": "release"
  }
]
```

Замени `YOUR_GITHUB_USERNAME` на твой ник на GitHub. Если репо назвал иначе — поменяй и `repo`.

### 3. Запушить проект

В PowerShell из папки `d:\lauin`:

```powershell
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ТВОЙ-НИК/aurora-launcher.git
git push -u origin main
```

Git в первый раз спросит логин/пароль. Введи username и Personal Access Token (не пароль аккаунта!):

- https://github.com/settings/tokens → **Generate new token (classic)**
- Scopes: `repo` (полностью)
- Скопируй токен и вставь его вместо пароля.
- Windows запомнит credentials — больше спрашивать не будет.

### 4. Проверить, что Actions работают

1. После `git push` зайди на страницу репозитория → вкладка **Actions**.
2. Там должен появиться запущенный workflow `release`.
3. Он соберёт лаунчер, поднимет версию (`1.0.0` → `1.0.1`) и опубликует релиз.
4. Через 3-5 минут проверь вкладку **Releases** — там появится `v1.0.1` с `.exe`, `latest.yml`, `.blockmap`.

**Готово.** С этой минуты любой `git push` в `main` запускает новый релиз.

## Как выпускать обновления

Просто пишешь код → коммитишь → пушишь:

```powershell
git add -A
git commit -m "Исправил баг с загрузкой"
git push
```

GitHub Actions **сам** сделает:
1. Увеличит версию в `package.json` на `+1` patch (1.0.1 → 1.0.2)
2. Создаст git-тег `v1.0.2`
3. Соберёт NSIS-инсталлятор + portable + `latest.yml` + blockmap
4. Опубликует Release `v1.0.2` с этими файлами
5. Закоммитит новую версию обратно в репозиторий

Пользователи в течение 5 секунд после следующего запуска (или каждый час если запущены) увидят обновление и скачают differential-патч.

## Если нужна специфическая версия

Хочешь выпустить минорный релиз (1.0.x → 1.1.0) или мажорный (1.x.x → 2.0.0)?

1. Измени версию вручную в `package.json`.
2. Коммит с сообщением, начинающимся с `release`:
   ```powershell
   git commit -am "release 1.1.0"
   git push
   ```
3. Actions не будут поднимать версию (они распознают префикс `release`), просто соберут и опубликуют с тем номером, что ты поставил.

## Откат релиза

1. GitHub → Releases → найди плохой релиз → удали.
2. Тег удали: `git push --delete origin v1.0.2 && git tag -d v1.0.2`
3. Следующим коммитом версия снова поднимется от актуального тега.

## Локальный тест без публикации

```powershell
npm run dist
```

Соберёт всё в `release/` локально, ничего не зальёт.

## Секретные ключи

Никаких внешних токенов не нужно. GitHub Actions использует встроенный `GITHUB_TOKEN`, у него автоматически есть права писать в свой же репозиторий.

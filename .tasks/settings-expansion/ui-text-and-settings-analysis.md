# Full UI Text Inventory & Settings Structure Analysis

## Part 1: Complete Russian Text Inventory by File

All hardcoded Russian strings that need i18n. Organized by file.

---

### `src/renderer/App.tsx` (205 lines)
| Line | Text | Context |
|------|------|---------|
| 120 | `Загрузка...` | Loading placeholder while settings/accounts load |

---

### `src/renderer/components/TitleBar.tsx` (28 lines)
| Line | Text | Context |
|------|------|---------|
| 15 | `Свернуть` | Window minimize button title |
| 18 | `Развернуть` | Window maximize button title |
| 21 | `Закрыть` | Window close button title |

---

### `src/renderer/components/UpdateIndicator.tsx` (52 lines)
| Line | Text | Context |
|------|------|---------|
| 18 | `` `Готово к установке версии ${s.latest}. Перезапустить лаунчер сейчас?` `` | confirm() prompt |
| 28 | `` `Загрузка обновления v${s.latest}...` `` | title on downloading state |
| 30 | `обновление` + percent | downloading label |
| 35 | `Нажмите, чтобы установить` | title on downloaded state |
| 37 | `обновление готово` | downloaded label |
| 42 | `Ошибка обновления` | fallback error title |
| 43 | `ошибка` | error label |

---

### `src/renderer/components/Sidebar.tsx` (125 lines)
| Line | Text | Context |
|------|------|---------|
| 46 | `Играть` | nav group label |
| 49 | `Главная` | nav item label |
| 50 | `Каталог` | nav item label |
| 51 | `Установленные` | nav item label |
| 53 | `Серверы` | nav item label |
| 57 | `Данные` | nav group label |
| 59 | `Миры` | nav item label |
| 60 | `Контент` | nav item label |
| 63 | `Профиль` | nav group label |
| 65 | `Аккаунты` | nav item label |
| 66 | `Скин` | nav item label |
| 67 | `Настройки` | nav item label |
| 82 | `Доступно обновление` | dot tooltip for settings |
| 82 | `Сервер запущен` | dot tooltip for servers |
| 112 | `Открыть аккаунты` | account chip button title |
| 118 | `Гость` | role label in account chip |

---

### `src/renderer/components/LoaderInstallDialog.tsx` (127 lines)
| Line | Text | Context |
|------|------|---------|
| 13 | `Лёгкий, быстрый, самый популярный для свежих версий` | Fabric hint |
| 14 | `Форк Fabric с расширенным API` | Quilt hint |
| 15 | `Форк Forge для современных версий (1.20.1+)` | NeoForge hint |
| 16 | `Классический мод-загрузчик, нужен для старых модпаков` | Forge hint |
| 68 | `` `Установить мод-загрузчик для ${mcVersion}` `` | dialog title |
| 82 | `Версия загрузчика` | field label |
| 84 | `Загрузка списка...` | loading state |
| 87 | `` `Нет доступных версий ${...} для ${mcVersion}` `` | empty state |
| 96 | `стабильная` | version option suffix |
| 103 | `Отмена` | cancel button |
| 108 | `Установка...` | installing state |
| 108 | `Установить` | install button |

---

### `src/renderer/components/Dialog.tsx` (97 lines)
No hardcoded Russian text — all text comes from callers via `DialogOptions`.

---

### `src/renderer/components/SkinPreview.tsx` (172 lines)
No user-visible Russian text.

---

### `src/renderer/pages/WelcomePage.tsx` (67 lines)
| Line | Text | Context |
|------|------|---------|
| 33 | `Добро пожаловать` | page title |
| 34 | `Выберите никнейм, чтобы начать. Он сохранится и будет использоваться при следующих запусках.` | subtitle |
| 38 | `Никнейм` | field label |
| 47 | `1–16 символов: латинские буквы, цифры, подчёркивание` | hint |
| 57 | `Сохранение...` | loading button |
| 57 | `Продолжить` | button label |
| 60 | `` Хранится локально в `%APPDATA%\Trel` `` | hint |

---

### `src/renderer/pages/HomePage.tsx` (327 lines)
| Line | Text | Context |
|------|------|---------|
| 23 | `релиз`, `снапшот` | typeLabel record |
| 54 | `` `Игра завершилась (код ${code})` `` | exit status |
| 113 | `Скачивание ` + lastId | status during download |
| 121 | `Запуск Minecraft` | status |
| 125 | `Minecraft запущен` | status |
| 127 | `Ошибка: ` + message | error status |
| 144 | `Готово к запуску` | hero empty title |
| 146 | `Выберите версию Minecraft, чтобы начать. После первого запуска она появится здесь как «продолжить».` | hero empty subtitle |
| 150 | `Сначала добавьте аккаунт` | button |
| 155 | `Открыть каталог версий` | button |
| 168 | `Нет активного аккаунта` | banner title |
| 169 | `Добавьте профиль, чтобы начать игру` | banner hint |
| 171 | `В аккаунты` | banner button |
| 177 | `Продолжить` | hero eyebrow when installed |
| 177 | `Последняя сессия` | hero eyebrow when not installed |
| 198-199 | `найдена`, `скачается` | Java plan chips |
| 202 | `установлено` | chip label |
| 202 | `будет скачано` | chip label |
| 214 | `Запуск...`, `Скачивание...`, `Играть` | play button labels |
| 239 | `Папка игры` | quick action |
| 246 | `Папка версии` | quick action |
| 251 | `Все версии` | quick action |
| 257 | `Другие установленные` | section heading |
| 258 | `Все` | button |
| 261 | `Кликните чтобы сделать активной — она появится в hero-карточке выше.` | hint |
| 271 | `` `Сделать активной: ${v.id}` `` | card title |
| 296 | `Лог последнего запуска` | card heading |
| 296 | `строк` | chip label |
| 300 | `Скрыть`, `Показать` | toggle button |
| 301 | `Очистить` | button |

---

### `src/renderer/pages/BrowsePage.tsx` (634 lines)
| Line | Text | Context |
|------|------|---------|
| 47-50 | `релиз`, `снапшот` | typeLabel |
| 100-102 | `Не удалось загрузить список версий: ` + message | error status |
| 104 | `` `Игра завершилась (код ${code})` `` | exit status |
| 192 | `Скачивание ` + selected | status |
| 194 | `Установлено: ` + selected | status |
| 201 | `Запуск Minecraft` | status |
| 207 | `Minecraft запущен` | status |
| 209 | `Ошибка: ` + message | status |
| 221-235 | `Вернуть ${selected} к ванили?` + dialog content (Russian text in message/buttons) | dialog |
| 247 | `Удалены лоадеры: ...` / `Лоадеров для этой версии не было.` | status |
| 262 | `Скачивание ` + selected | status |
| 267 | `Установлено: ` + selected | status |
| 270 | `Ошибка: ` + message | status |
| 285-289 | `Релизы`, `Снапшоты` | filter tab labels |
| 297-299 | `Запуск...`, `Скачивание...`, `Играть`, `Скачать и играть` | play button labels |
| 312 | `Каталог версий` | page title |
| 313 | `Найдите и установите любую версию Minecraft` | subtitle |
| 317 | `доступно` | chip label |
| 319 | `установлено` | chip label |
| 327 | `Поиск версий` | input placeholder |
| 356 | `Ничего не найдено` | empty state |
| 365 | `играли` | pill label |
| 393 | `Установлено` / `Не установлено` | dot title |
| 414 | `Выберите версию` | empty detail title |
| 416-418 | `Найдите релиз, снапшот или олдовую beta-версию слева, чтобы увидеть детали и запустить игру.` | empty detail text |
| 422 | `Нет активного аккаунта` | banner |
| 425 | `Добавьте профиль, чтобы начать игру` | banner hint |
| 428 | `В аккаунты` | button |
| 434 | `Готово к игре` | eyebrow installed |
| 437 | `Не установлено` | eyebrow not installed |
| 467 | `найдена`, `скачается`, `своя` | Java plan chip labels |
| 475 | `без скинов` | chip label |
| 565 | `Только скачать` | button |
| 573 | `Папка версии` | button |
| 582 | `Мод-загрузчик` | button |
| 590 | `Вернуть к ванили` | button |
| 598 | `О версии` | about card label |

---

### `src/renderer/pages/InstalledPage.tsx` (312 lines)
| Line | Text | Context |
|------|------|---------|
| 17 | `релиз`, `снапшот` | typeLabel |
| 78 | `Запуск ` + id | status |
| 81 | `Minecraft запущен` | status |
| 83 | `Ошибка: ` + message | status |
| 87-96 | `` `Удалить версию ${id}?` `` + dialog (Полностью, Только версию, Отмена) | dialog |
| 109 | `Удалено: ` + id | status |
| 114-127 | `` `Вернуть ${baseMc} к ванили?` `` + dialog | dialog |
| 131 | `` `Удалено: ${result.removed.join(', ')}` `` | status |
| 132 | `Лоадеров не было.` | status |
| 147 | `` `Удалить все установленные версии (${details.length})?` `` | dialog title |
| 148 | `Все файлы версий будут удалены. Сохранения и аккаунты останутся.` | dialog message |
| 150 | `Отмена`, `Удалить все` | dialog buttons |
| 157 | `` `Удалено: ${ids.length} версий` `` | status |
| 164 | `Установленные` | page title |
| 165 | `Версии, готовые к запуску` | subtitle |
| 174 | `Пока нет установленных версий` | empty title |
| 176 | `Откройте каталог и выберите версию, чтобы скачать её.` | empty text |
| 178 | `Открыть каталог` | button |
| 183 | `версия`/`версии`/`версий` | pluralized count |
| 186 | `+ Добавить` | button |
| 188 | `Удалить все` | button |
| 199 | `последняя` | pill label |
| 216 | `без скинов` | chip label |
| 220 | `Играть`, `Запуск...` | button labels |
| 228 | `Установить мод-загрузчик (Fabric, Forge, NeoForge, Quilt)` | button title |
| 235 | `` `Вернуться к ванили (${it.baseMc})` `` | button title |
| 241 | `Открыть папку версии` | button title |
| 246 | `Удалить` | button title |

---

### `src/renderer/pages/AccountsPage.tsx` (111 lines)
| Line | Text | Context |
|------|------|---------|
| 43 | `Аккаунты` | page title |
| 44 | `Гостевые профили, сохранённые на этом компьютере` | subtitle |
| 48 | `Добавить гостя` | card heading |
| 60 | `Добавить` | button |
| 63 | `` Работает в одиночной игре и на серверах с `online-mode=false`. `` | hint |
| 73 | `Сохранённые аккаунты` | card heading |
| 77 | `Пока нет аккаунтов` | empty state |
| 94 | `Гость` + ` · активный` | role labels |
| 99 | `Скин` | button title |
| 104 | `Удалить` | button title |

---

### `src/renderer/pages/SkinPage.tsx` (357 lines)
| Line | Text | Context |
|------|------|---------|
| 24 | `Нужен PNG-файл` | error |
| 26 | `Не удалось прочитать файл` | error |
| 30 | `Файл не является корректной картинкой` | error |
| 32 | `` `Скин должен быть 64×64 или 64×32, а у тебя ${w}×${h}` `` | error |
| 45 | `Файл не является корректной картинкой` | error |
| 48 | `` `Скин должен быть 64×64 или 64×32, а у тебя ${w}×${h}` `` | error |
| 153 | `Скин` | page title |
| 154 | `Кастомный скин для активного аккаунта` | subtitle |
| 157 | `Сначала добавь аккаунт` | empty state title |
| 159 | `Скин привязывается к конкретному гостевому профилю.` | empty state text |
| 161 | `В аккаунты` | button |
| 167 | `Скин` | page title (repeated) |
| 168 | `Кастомный скин для активного аккаунта` | subtitle (repeated) |
| 173 | `Аккаунт` | card heading |
| 210 | `Скин не загружен` | empty skin text |
| 211 | `Перетащи PNG сюда` | empty skin hint |
| 215 | `Файл скина` | section title |
| 217 | `PNG 64×64 (современный) или 64×32 (legacy). Можно перетащить файл прямо на превью.` | tip |
| 220 | `Выбрать файл` | button |
| 223 | `Сбросить` | button |
| 228 | `Модель` | section title |
| 233 | `classic · руки 4px` | model sub |
| 239 | `slim · руки 3px` | model sub |
| 246 | description hint about authlib-injector (multi-line) | info text |
| 281 | `Пресеты` | card heading |
| 287 | `Все`, `Муж`, `Жен`, `Без пола` | preset category buttons |
| 313 | `мужской`, `женский`, `без пола` | preset card categories |
| 323 | `Без поддержки скинов` | card heading |
| 328-334 | Long hint about pre-1.6 version skin incompatibility | hint text |

---

### `src/renderer/pages/WorldsPage.tsx` (199 lines)
| Line | Text | Context |
|------|------|---------|
| 7 | `хардкор` | mode label |
| 9 | `выживание` | mode label |
| 10 | `креатив` | mode label |
| 11 | `приключение` | mode label |
| 12 | `наблюдатель` | mode label |
| 28-31 | `Б`, `КБ`, `МБ`, `ГБ` | size units |
| 37 | locale `ru-RU` | date formatting |
| 116 | `Миры` | page title |
| 117 | `` `Каталог ваших сохранений · ${list.length} миров · ${fmtSize(totalSize)} на диске` `` | subtitle |
| 124 | `Поиск мира` | placeholder |
| 129 | `Обновить` | button |
| 132 | `Папка saves` | button |
| 139 | `Загрузка миров...` | loading state |
| 143 | `Нет ни одного мира. Создайте новый в Minecraft — он появится здесь.` | empty state |
| 144 | `Ни один мир не соответствует поисковому запросу.` | search empty state |
| 71-88 | `` `Удалить мир «${w.displayName}»?` `` + dialog content (Отмена, Только мир, Удалить полностью) | dialog |
| 93 | `` `«${w.displayName}» удалён, бэкапов удалено: ${r.backupsRemoved}` `` | status |
| 96 | `` `Мир «${w.displayName}» удалён (бэкапы сохранены)` `` | status |
| 104 | `` `Создание бэкапа «${w.displayName}»...` `` | status |
| 107 | `` `Бэкап сохранён: ${out}` `` | status |
| 109 | `Ошибка бэкапа: ` + message | status |
| 163 | `Последний запуск: ` + date | world detail |
| 157 | `Открыть папку` | button title |
| 160 | `Создать .zip бэкап` | button title |
| 163 | `Удалить мир` | button title |

---

### `src/renderer/pages/ContentPage.tsx` (334 lines)
| Line | Text | Context |
|------|------|---------|
| 14 | `Моды` | tab label |
| 15 | `Шейдеры` | tab label |
| 16 | `Ресурс-паки` | tab label |
| 17 | `Текстур-паки` | tab label |
| 25-28 | `Б`, `КБ`, `МБ`, `ГБ` | size units |
| 113 | `` `Добавлено: ${res.copied} ${pluralize(…, 'файл', 'файла', 'файлов')}` `` | status |
| 115 | `Ошибки: ` + errors | status |
| 125 | `` `Удалить «${it.displayName}»?` `` | dialog title |
| 127 | `Файл будет удалён без возможности восстановления.` | dialog message |
| 129 | `Отмена` | button |
| 130 | `Удалить` | button |
| 137 | `` `Удалено: ${it.displayName}` `` | status |
| 145 | `` `Отключено: ${it.displayName}` `` / `` `Включено: ${it.displayName}` `` | status |
| 156-159 | Placeholder hints (`Брось .jar файл сюда...`, etc.) | empty state hints |
| 165 | `Контент` | page title |
| 166 | `Моды, шейдеры, ресурс-паки и текстур-паки — у каждой версии свои` | subtitle |
| 171 | `Версия:` | label |
| 181 | `— ничего не установлено —` | empty option |
| 189 | `` `папка: versions/${currentDetail.id}` `` | chip label |
| 210 | `Нужен шейдер-загрузчик` + long explanation | banner |
| 218-222 | `Только для версий до 1.6` + explanation | banner |
| 226-230 | `Моды требуют загрузчик` + explanation | banner |
| 234 | `Версия не выбрана` | empty title |
| 235 | `Установи хотя бы одну версию Minecraft через каталог, чтобы начать добавлять контент.` | empty text |
| 240 | `+ Добавить файлы` | button |
| 243 | `Открыть папку` | button |
| 246 | `Обновить` | button |
| 250 | `` `${items.length} файл/файла/файлов` `` | count with pluralize |
| 255 | `Загрузка...` | loading |
| 258 | `Пока пусто` | empty title |
| 259 | `` `В папке ... ничего нет.` `` + placeholder hint | empty text |
| 269 | `папка` | chip |
| 270 | `отключён` | chip |
| 277 | `Отключить` / `Включить` | button titles |
| 284 | `Удалить` | button title |

---

### `src/renderer/pages/ServersPage.tsx` (644 lines)
| Line | Text | Context |
|------|------|---------|
| 13-17 | `Остановлен`, `Запускается`, `Работает`, `Останавливается`, `Ошибка` | statusLabel |
| 87 | `Запуск сервера...` | status |
| 92 | `Ошибка: ` + message | status |
| 95 | `Остановка сервера...` | status |
| 100 | `Ошибка: ` + message | status |
| 103 | `` `Удалить сервер «${s.name}»?` `` | dialog title |
| 104 | `Папка сервера со всеми мирами и настройками будет удалена с диска.` | dialog message |
| 106 | `Отмена` / `Удалить` | buttons |
| 114 | `Ошибка: ` + message | status |
| 120 | `Серверы` | page title |
| 121 | `Локальные Minecraft-серверы прямо в лаунчере` | subtitle |
| 127 | `сервер`/`сервера`/`серверов` | pluralized count |
| 128 | `Создать` | button |
| 142 | `Нет серверов` | empty heading |
| 144 | `Нажмите «Создать» в шапке, чтобы поднять первый локальный сервер.` | empty text |
| 173 | `Выберите сервер` | empty detail heading |
| 174 | `Слева — список ваших серверов. Можно создать новый или открыть существующий.` | empty detail text |
| 243 | `Кликни чтобы переименовать` | title |
| 248 | `порт`, `МБ ОЗУ`, `создан` | hero meta labels |
| 254 | `Остановить` | button |
| 258 | `Запустить` | button |
| 261 | `Открыть папку` | button title |
| 263 | `Удалить сервер` | button title |
| 269 | `Как подключиться` | card heading |
| 271 | `сервер готов` | chip |
| 273 | `подождите, сервер ещё стартует...` | chip |
| 275 | `сервер не запущен` | chip |
| 278-280 | Connection instructions (Сетевая игра, По адресу, Direct Connect, Подключиться к серверу) | ol steps |
| 290 | `Скопировано` / `Копировать` | button |
| 295 | `Других сетевых интерфейсов не нашлось — друзья из локальной сети не смогут зайти.` + hint | hint |
| 300-306 | Long LAN/firewall instructions | hint |
| 312 | `Консоль` | card heading |
| 313 | `строк` | chip label |
| 316-317 | `Ждём первого вывода сервера...` / `Запустите сервер чтобы увидеть консоль.` | empty console |
| 324 | `команда (op, say, stop, ...)` / `Сервер не запущен` | input placeholder |
| 330 | `Отправить` | button |
| 336 | `Настройки` | card heading |
| 338 | `изменения применятся при следующем запуске` | hint |
| 356-361 | `MOTD`, `Порт`, `Макс. игроков`, `Память (МБ)`, `Режим игры`, `Сложность`, `Защита спавна (блоки)` | field labels |
| 363-370 | `Выживание`, `Творческий`, `Приключение`, `Наблюдатель` | gamemode options |
| 373-378 | `Мирная`, `Лёгкая`, `Нормальная`, `Сложная` | difficulty options |
| 504 | `Изменили порт? Нажмите «Остановить» и «Запустить» снова — новые настройки применятся.` | hint |
| 570 | `Новый сервер` | card heading |
| 575 | `Название` | field label |
| 579 | `Мой сервер` | placeholder |
| 583 | `Версия Minecraft` | field label |
| 592 | `Память (МБ)` | field label |
| 600 | `Скачается server.jar c серверов Mojang (~30 МБ для современных версий)` + EULA note | hint |
| 556 | `Выберите версию` | error |
| 620 | `Отмена` | button |
| 621 | `Создаём...` / `Создать` | button |

---

### `src/renderer/pages/SettingsPage.tsx` (519 lines)
| Line | Text | Context |
|------|------|---------|
| 17 | `Чёрный с белым акцентом, без декора` | Mono theme description |
| 22 | `Светлая дневная, графитовый акцент` | Eclipse theme description |
| 27 | `Изумруд и золото, в духе Minecraft` | Voxel theme description |
| 82 | `Проверка...` | updater status |
| 83 | `` `Доступна версия ${s.latest}` `` | updater status |
| 84 | `` `Загрузка... ${s.percent ?? 0}%` `` | updater status |
| 85 | `` `Готово к установке: v${s.latest}` `` | updater status |
| 86 | `Установлена последняя версия` | updater status |
| 87 | `Ошибка: ` + error / `неизвестно` | updater status |
| 88 | `Автообновление отключено (dev-режим)` | updater status |
| 94 | `Сбросить лаунчер?` | dialog title |
| 96-100 | Dialog content about reset | dialog |
| 102 | `Отмена` | button |
| 103 | `Сохранить мои данные` | button |
| 104 | `Удалить всё полностью` | button |
| 112 | `Точно удалить ВСЁ?` / `Подтвердить сброс` | dialog titles |
| 114-119 | Dialog messages for step 2 | dialog |
| 122 | `Отмена` | button |
| 123 | `Удалить всё и перезапустить` / `Сбросить и перезапустить` | button |
| 131 | `Удалить лаунчер с компьютера?` | dialog title |
| 133-136 | Dialog content about uninstall | dialog |
| 138-140 | `Отмена`, `Сохранить мои данные`, `Удалить всё полностью` | buttons |
| 147 | `Подтвердить удаление` | dialog title |
| 149 | `Лаунчер и все данные будут удалены. Это действие необратимо.` | message |
| 150 | `Лаунчер будет удалён, личные данные останутся в %APPDATA%\\Trel.` | message |
| 152-153 | `Отмена`, `Удалить лаунчер` | buttons |
| 159 | `Не удалось запустить uninstaller` | dialog title |
| 161 | `Удалите лаунчер вручную через «Параметры → Приложения».` | fallback message |
| 162 | `Понятно` | button |
| 168 | `Настройки` | page title |
| 169 | `Память, Java и расположение данных` | subtitle |
| 172 | `Обновление лаунчера` | card heading |
| 178 | `Проверить` | button |
| 186 | `Установить и перезапустить` | button |
| 193 | `Обновления загружаются в фоне. Список версий Minecraft обновляется автоматически каждые 30 минут.` | hint |
| 197 | `Тема оформления` | card heading |
| 271 | `Язык / Language` | card heading |
| 278 | `Русский` / `English` | language options |
| 284 | `Память JVM` | card heading |
| 285 | `ГБ` | unit label |
| 295 | `1 ГБ`, `16 ГБ` | range labels |
| 300 | `JVM аргументы` | card heading |
| 302 | `Дополнительные флаги JVM, например` ... | hint |
| 309 | `Окно игры` | card heading |
| 312 | `Ширина` | field label |
| 319 | `Высота` | field label |
| 328 | `Полноэкранный режим` | toggle label |
| 334 | `Поведение лаунчера` | card heading |
| 340 | `Скрывать лаунчер при запуске игры` | toggle |
| 347 | `Показывать консоль логов при запуске` | toggle |
| 352 | `Версии` | card heading |
| 358 | `Показывать снапшоты и старые версии` | toggle |
| 363 | `Команды запуска` | card heading |
| 365 | `Выполняются до и после запуска игры` | hint |
| 367 | `Перед запуском` | label |
| 373 | `После завершения` | label |
| 381 | `Папка игры` | card heading |
| 383 | `Открыть` | button |
| 389 | `Выбрать` | button |
| 393 | `Java` | card heading |
| 395 | `Поиск...` / `Обновить` | button |
| 400 | `Обнаруженные среды` | label |
| 403 | `Java не найдена. Подходящая JRE скачается автоматически при первом запуске.` | empty state |
| 419 | `встроенная` | chip label |
| 425 | `выбрано` | chip label |
| 431 | `Свой путь (перекрывает авто-выбор)` | label |
| 434 | `Оставьте пустым для автоматического выбора` | placeholder |
| 437 | `Сбросить` | button |
| 440 | `Несовместимые версии игнорируются автоматически — например, Java 21 для мира 1.16.` | hint |
| 445 | `Опасная зона` | card heading |
| 449 | `Сброс лаунчера` | title |
| 451 | `Удалит скачанные версии, библиотеки и кеш. Можно сохранить личные данные или стереть всё подчистую.` | description |
| 454 | `Сбросить лаунчер` | button |
| 459 | `Удалить лаунчер` | title |
| 461 | `Запустит штатный uninstaller Windows. Можно сохранить миры и аккаунты или стереть всё.` | description |
| 464 | `Удалить лаунчер` | button |

---

### `src/renderer/data/versions.ts` (995 lines)
This file contains ~900+ Russian descriptions for Minecraft versions. Every line in the `DICT` record is a Russian string.
Example: `'1.21.11': 'Патч 1.21.11 (09.12.2025) — финальные фиксы ветки 1.21 перед переходом к 26.x.'`

**This is the single largest source of Russian text and will need a separate i18n strategy** (likely a per-version description dictionary per locale, or keep Russian-only since version descriptions are highly specific).

---

## Part 2: SettingsPage Structure Analysis

### Current Sections (in order of appearance)

SettingsPage is a single-scroll page rendered as a flat component. It has these `<div className="card">` sections:

1. **Обновление лаунчера** (Launcher Update) — current version chip, check button, install button, progress bar, hint about auto-update
2. **Тема оформления** (Theme) — grid of 3 theme cards (Mono, Eclipse, Voxel) with swatches
3. **Язык / Language** — 2-button grid (Русский, English)
4. **Память JVM** (JVM Memory) — range slider 1-16 GB with chip showing current value
5. **JVM аргументы** (JVM Arguments) — text input for flags
6. **Окно игры** (Game Window) — width/height number inputs + fullscreen toggle
7. **Поведение лаунчера** (Launcher Behavior) — 2 toggles: close on launch, show console
8. **Версии** (Versions) — 1 toggle: show snapshots
9. **Команды запуска** (Launch Commands) — pre/post command inputs
10. **Папка игры** (Game Directory) — readonly path input + choose/open buttons
11. **Java** — scan/refresh, list of detected JREs, custom path input
12. **Опасная зона** (Danger Zone) — Reset launcher + Uninstall launcher buttons with descriptions

### Routing / Rendering Mechanism

- **NOT a router-based route**. The app uses a simple state-based page switching in `App.tsx` (line 21): `type Page = 'home' | 'browse' | ... | 'settings'`
- `page` state is controlled by `useState<Page>('home')` and toggled via `Sidebar.onChange`
- SettingsPage renders when `page === 'settings'` (App.tsx line 196): `<SettingsPage settings={settings} onChange={updateSettings} />`
- Props: `settings: LauncherSettings` and `onChange: (s: LauncherSettings) => void`
- Settings changes are applied immediately via `apply()` function that merges partial and calls `onChange(merged)`

### Proposed Tab Groupings

Based on the current sections, here's a logical grouping into sub-tabs/screens:

#### Tab 1: **Общие** (General)
- Тема оформления (Theme)
- Язык / Language
- Обновление лаунчера (Update)

*Rationale: Appearance + localization + app-level update — things every user touches first.*

#### Tab 2: **Игра** (Game)
- Память JVM (Memory slider)
- JVM аргументы (JVM args)
- Окно игры (Window size + fullscreen)
- Java (Detected JREs + custom path)
- Версии (Show snapshots toggle)
- Команды запуска (Pre/post launch commands)

*Rationale: Everything related to how Minecraft actually launches and runs.*

#### Tab 3: **Лаунчер** (Launcher Behavior)
- Поведение лаунчера (Close on launch, Show console)
- Папка игры (Game directory)

*Rationale: How the launcher itself behaves — fewer items, could also fold into General.*

#### Tab 4: **Опасная зона** (Danger Zone)
- Сброс лаунчера (Reset)
- Удалить лаунчер (Uninstall)

*Rationale: Destructive actions separated for safety.*

### Alternative 3-tab Approach (Recommended)

If 4 tabs feels like too many:

| Tab | Sections |
|-----|----------|
| **Общие** (General) | Theme, Language, Update, Launcher behavior (close/console), Game directory |
| **Игра** (Game) | Memory, JVM args, Game window, Java, Versions, Commands |
| **Опасная зона** (Danger) | Reset, Uninstall |

### Implementation Notes

1. The current `SettingsPage` component manages its own local state (`local`) plus Java list and updater state. For tabs, you can either:
   - Keep a single component with a tab state variable
   - Split into sub-components (`SettingsGeneral`, `SettingsGame`, `SettingsDanger`) sharing the same `apply()` logic via props or context

2. The `settings` prop flow is clean: `App.tsx` holds canonical state → passes to SettingsPage → SettingsPage calls `onChange(merged)` which calls `window.api.settings.set()`. This doesn't need to change for tabs.

3. Java list scanning and updater subscriptions would need to be lifted up or conditionally loaded only when the "Game" tab is active.

## Summary Statistics

| File | Russian strings (approx) |
|------|-------------------------|
| App.tsx | 1 |
| TitleBar.tsx | 3 |
| UpdateIndicator.tsx | 7 |
| Sidebar.tsx | 16 |
| LoaderInstallDialog.tsx | 12 |
| Dialog.tsx | 0 (text from callers) |
| SkinPreview.tsx | 0 |
| WelcomePage.tsx | 7 |
| HomePage.tsx | ~30 |
| BrowsePage.tsx | ~40 |
| InstalledPage.tsx | ~25 |
| AccountsPage.tsx | 10 |
| SkinPage.tsx | ~25 |
| WorldsPage.tsx | ~20 |
| ContentPage.tsx | ~30 |
| ServersPage.tsx | ~50 |
| SettingsPage.tsx | ~60 |
| data/versions.ts | ~900+ (version descriptions) |
| **Total** | **~1,240+** |

### Patterns to Note for i18n

1. **`pluralize()` function** — used in 4 files (HomePage, InstalledPage, ContentPage, ServersPage). Russian pluralization has 3 forms; English has 2. i18n library must handle this (e.g., `i18next` with `count` interpolation).

2. **Template literals with variables** — many strings use `${variable}` interpolation. i18n library needs interpolation support: `t('status.downloading', { id })`.

3. **JSX in dialog messages** — some dialog messages contain `<b>`, `<br/>`, `<code>` elements. These need either:
   - `Trans` component (i18next-react)
   - Split into segments with i18n keys

4. **`ru-RU` locale in `toLocaleDateString`** and `toLocaleString` — these need to be dynamic based on selected language.

5. **Size units** (`Б`, `КБ`, `МБ`, `ГБ`) — used in multiple files. Should be centralized into a shared i18n-aware format function.

6. **`data/versions.ts`** — 900+ version descriptions are entirely in Russian. Strategy options:
   - Keep as Russian-only (low value in translating historical Minecraft version notes)
   - Create a parallel `versions.en.ts` (large effort)
   - Show in both languages simultaneously
   - Mark as untranslated with a language indicator

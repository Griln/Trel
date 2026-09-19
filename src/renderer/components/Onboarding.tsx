import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Page } from "../../shared/types";
import {
  IconAlert, IconArchive, IconArrow, IconCamera, IconChart, IconCheck, IconClose,
  IconCube, IconGlobe, IconImport, IconPlay, IconSearch, IconServer, IconSettings,
  IconSkin, IconSpark, IconUser,
} from "./icons";
import { useT } from "../i18n";

/**
 * Onboarding v5 — интерактивное обучение по живому интерфейсу Trel Launcher.
 *
 * Особенности и исправления v5:
 * - Аппаратный SVG-спотлайт с маской: идеальные скруглённые углы (rx/ry),
 *   отсутствие пиксельных градиентов, швов и ступеней на любых мониторах.
 * - Полная синхронизация анимации: вырез в маске и светящаяся рамка (.onb-ring)
 *   плавно скользят между элементами по единой кривой cubic-bezier(0.16, 1, 0.3, 1).
 * - Никаких чёрных вспышек при смене шагов: предыдущая подсветка плавно перетекает
 *   в новую цель без сброса в темноту.
 * - Умное позиционирование карточки (.onb-tip): исключает перекрытие цели,
 *   не загораживает боковую панель, адаптируется под свободное пространство
 *   и плавно скользит на новое место.
 * - 100% надёжные цели на ВСЕХ 18 шагах: учитывают как пустое состояние на новом
 *   профиле (отсутствие версий/миров/скриншотов/серверов), так и наполненное.
 * - Чёткое разграничение кликов: на информационных шагах случайные клики по
 *   приложению блокируются защитным экраном; на шагах с заданием интерактивна
 *   только целевая зона.
 * - Мгновенная реакция на ресайз, прокрутку и появление DOM-элементов через
 *   ResizeObserver, MutationObserver и синхронизированные RAF-кадры.
 */

export const ONBOARDING_SEEN_KEY = "trel:onboarding-seen:v5";

type Task =
  | { kind: "click"; targets: string[] }
  | { kind: "input"; targets: string[] };

type Step = {
  id: string;
  page: Page;
  Icon: React.FC<any>;
  rgb: string;
  /** Селекторы цели по приоритету — берётся первый, у которого есть видимые элементы. */
  targets: string[];
  nav: { ru: string; en: string };
  title: { ru: string; en: string };
  lead: { ru: string; en: string };
  bullets: { ru: string[]; en: string[] };
  task?: Task;
  taskLabel?: { ru: string; en: string };
  /** Если шаг требует конкретную вкладку настроек — тур сам её включит. */
  settingsTab?: "general" | "game" | "storage" | "danger";
};

const STEPS: Step[] = [
  {
    id: "sidebar",
    page: "home",
    Icon: IconSpark,
    rgb: "150, 165, 195",
    targets: [".sidebar", ".nav-hero"],
    nav: { ru: "Панель", en: "Sidebar" },
    title: { ru: "Левая панель — все разделы", en: "Sidebar — every section" },
    lead: {
      ru: "Все разделы под рукой и сгруппированы: играть, библиотека, инструменты, профиль.",
      en: "All sections at hand, grouped: play, library, tools, profile.",
    },
    bullets: {
      ru: [
        "Прячется сама через 5 секунд без дела — верни мышкой к левому краю",
        "Счётчики и точки подсказывают, что где лежит",
        "Внизу — активный игрок",
      ],
      en: [
        "Hides automatically after 5 idle seconds — hover the left edge to restore",
        "Counters and status dots hint at what lives where",
        "Active player profile sits at the bottom",
      ],
    },
  },
  {
    id: "home",
    page: "home",
    Icon: IconPlay,
    rgb: "94, 203, 111",
    targets: [".home-play", ".home-hero-row", ".home-carousel-wrap", ".home-picker", ".home"],
    nav: { ru: "Главная", en: "Home" },
    title: { ru: "Главная: запуск в один клик", en: "Home: one-click launch" },
    lead: {
      ru: "Главная страница: запуск последней сыгранной версии или быстрый выбор популярной сборки из карусели.",
      en: "Home page: launch your last played version or pick a popular build right from the carousel.",
    },
    bullets: {
      ru: [
        "Большая кнопка запускает выбранную версию в один клик",
        "Если версий ещё нет — карусель сразу предложит свежие релизы",
        "Статус игры и прогресс скачивания видны сверху",
      ],
      en: [
        "Big button launches the chosen version with one click",
        "If no versions installed yet — carousel suggests fresh releases right away",
        "Game status and download progress appear at the top",
      ],
    },
  },
  {
    id: "account",
    page: "home",
    Icon: IconUser,
    rgb: "255, 140, 200",
    targets: [".account-chip"],
    nav: { ru: "Игрок", en: "Player" },
    title: { ru: "Кто играет?", en: "Who plays?" },
    lead: {
      ru: "Твой ник и аватар — всегда внизу панели. Можно создавать несколько профилей.",
      en: "Your name and avatar — always at the bottom of the sidebar. You can keep multiple profiles.",
    },
    bullets: {
      ru: [
        "Смена активного игрока в один клик",
        "Гость — для одиночной игры, Microsoft — для игры по сети",
      ],
      en: [
        "Switch active player in one click",
        "Guest for singleplayer, Microsoft for online multiplayer",
      ],
    },
    task: { kind: "click", targets: [".account-chip"] },
    taskLabel: {
      ru: "Задание: кликни по карточке игрока внизу панели — откроются «Аккаунты».",
      en: "Task: click the player card at the bottom of the sidebar — Accounts will open.",
    },
  },
  {
    id: "accounts",
    page: "accounts",
    Icon: IconUser,
    rgb: "80, 160, 255",
    targets: [".acc.active", ".acc", ".guest-card", ".acc-layout", ".page-head"],
    nav: { ru: "Аккаунты", en: "Accounts" },
    title: { ru: "Аккаунты", en: "Accounts" },
    lead: {
      ru: "Гостевой профиль создаётся мгновенно — нужен только ник. Также поддерживается вход через Microsoft.",
      en: "Guest profile takes a second — just enter a nickname. Microsoft sign-in is supported too.",
    },
    bullets: {
      ru: [
        "Активный профиль подсвечивается зелёным бейджем",
        "Импорт существующих аккаунтов из других лаунчеров — в разделе «Импорт»",
      ],
      en: [
        "The active account is highlighted with a green badge",
        "Import existing accounts from other launchers in the Import section",
      ],
    },
  },
  {
    id: "skin",
    page: "skin",
    Icon: IconSkin,
    rgb: "170, 120, 255",
    targets: [".viewer", ".skin-layout", ".page-head"],
    nav: { ru: "Скин", en: "Skin" },
    title: { ru: "Скин игрока", en: "Your look" },
    lead: {
      ru: "45 готовых качественных скинов или свой PNG-файл. Вращай 3D-модель, проверяй детали и меняй модель рук.",
      en: "45 high quality ready-made skins or your own PNG. Rotate the 3D model, check details and switch arm models.",
    },
    bullets: {
      ru: [
        "Переключение моделей CLASSIC (4px) и SLIM (3px)",
        "Скин применяется на лету без перезапуска лаунчера",
      ],
      en: [
        "Switch between CLASSIC (4px) and SLIM (3px) models",
        "Skin applies live without restarting the launcher",
      ],
    },
  },
  {
    id: "browse",
    page: "browse",
    Icon: IconCube,
    rgb: "245, 168, 60",
    targets: [".ftype", ".page-head"],
    nav: { ru: "Каталог", en: "Catalogue" },
    title: { ru: "Каталог: все версии Minecraft", en: "Catalogue: every Minecraft version" },
    lead: {
      ru: "От классической rd-132211 до новейших снапшотов. Фильтры сверху разделяют версии по типам.",
      en: "From the classic rd-132211 to fresh snapshots. Filters on top organize versions by type.",
    },
    bullets: {
      ru: [
        "Релизы, снапшоты, бета, альфа и Bedrock — всё в едином каталоге",
        "Для игры с модами сразу доступна установка Fabric, Quilt, Forge или NeoForge",
      ],
      en: [
        "Releases, snapshots, beta, alpha and Bedrock — all in one catalogue",
        "One-click Fabric, Quilt, Forge or NeoForge loader installation for mods",
      ],
    },
    task: { kind: "click", targets: [".ftype"] },
    taskLabel: {
      ru: "Задание: кликни по любому фильтру (например, «Снапшоты») — каталог отфильтруется.",
      en: "Task: click any filter (e.g. “Snapshots”) — the catalogue will filter live.",
    },
  },
  {
    id: "search",
    page: "browse",
    Icon: IconSearch,
    rgb: "56, 200, 200",
    targets: [".search-wrap", ".search-wrap input", ".page-head"],
    nav: { ru: "Поиск", en: "Search" },
    title: { ru: "Поиск по каталогу", en: "Search the catalogue" },
    lead: {
      ru: "Умный поиск: понимает номер версии, описание обновления и тип. Можно вводить несколько слов.",
      en: "Smart search: matches version ID, update description and type. Supports multiple words.",
    },
    bullets: {
      ru: [
        "Запрос «1.20» покажет ровно ветку 1.20",
        "Понимает слова «бета», «снапшот», названия обновлений и даты",
      ],
      en: [
        "Query “1.20” finds exactly the 1.20 branch",
        "Matches terms like “beta”, “snapshot”, update names and dates",
      ],
    },
    task: { kind: "input", targets: [".search-wrap input", ".search-wrap"] },
    taskLabel: {
      ru: "Задание: набери в поиске пару символов (например, «1.20») — список отфильтруется на лету.",
      en: "Task: type a couple of characters in search (e.g. “1.20”) — the list filters live.",
    },
  },
  {
    id: "installed",
    page: "installed",
    Icon: IconArchive,
    rgb: "94, 203, 111",
    targets: [".irow.is-last", ".irow", ".page-frame .card", ".page-head"],
    nav: { ru: "Установленные", en: "Installed" },
    title: { ru: "Установленные сборки", en: "Installed builds" },
    lead: {
      ru: "Твоя локальная коллекция: запуск, открытие папки с файлами, создание резервных копий и удаление.",
      en: "Your local collection: launch, open files folder, create snapshots and delete builds.",
    },
    bullets: {
      ru: [
        "Зелёная рамка отмечает последнюю запущенную версию",
        "Каждая сборка изолирована — свои моды, миры и скриншоты",
        "Кнопка «Вернуть к ванили» убирает лоадер без потери модов",
      ],
      en: [
        "Green border marks your last played version",
        "Each build is isolated — its own mods, worlds and screenshots",
        "“Revert to vanilla” removes the loader without losing mods",
      ],
    },
  },
  {
    id: "worlds",
    page: "worlds",
    Icon: IconGlobe,
    rgb: "245, 168, 60",
    targets: [".wcard", ".w-grid", ".w-layout", ".empty", ".page-head"],
    nav: { ru: "Миры", en: "Worlds" },
    title: { ru: "Миры и резервные копии", en: "Worlds & backups" },
    lead: {
      ru: "Единый центр сохранений всех версий. Создание бэкапа в один клик и безопасное восстановление.",
      en: "Single hub for saves across all versions. One-click backups and safe restoration.",
    },
    bullets: {
      ru: [
        "Поддерживаются даже миры Pre-Classic и старые форматы",
        "Бэкап сохраняет мир в архив, восстановление ничего не затирает",
        "Удаление всегда запрашивает подтверждение",
      ],
      en: [
        "Even Pre-Classic saves and legacy formats are supported",
        "Backups archive your save, restoring does not overwrite accidentally",
        "Deletion always prompts for confirmation",
      ],
    },
  },
  {
    id: "servers",
    page: "servers",
    Icon: IconServer,
    rgb: "255, 140, 200",
    targets: [".srv.sel", ".srv-add", ".srv", ".servers .empty", ".empty", ".page-head"],
    nav: { ru: "Серверы", en: "Servers" },
    title: { ru: "Серверы: игра с друзьями", en: "Servers: play together" },
    lead: {
      ru: "Локальный сервер в пару кликов: выбери версию, память и запусти. Консоль и логи — прямо в окне.",
      en: "Local server in a few clicks: pick version, memory and start. Console and live logs right in the app.",
    },
    bullets: {
      ru: [
        "Пинг, онлайн игроков и MOTD избранных серверов",
        "Пока сервер работает, в левой панели горит зелёная точка",
        "Управление сервером через встроенную консоль команд",
      ],
      en: [
        "Ping, player count and MOTD for favorite servers",
        "A green dot glows in the sidebar while your server runs",
        "Manage the server with the built-in command console",
      ],
    },
  },
  {
    id: "content",
    page: "content",
    Icon: IconArchive,
    rgb: "170, 120, 255",
    targets: [".ccard", ".cfilters", ".vpick-btn", ".vpick", ".page-head"],
    nav: { ru: "Контент", en: "Content" },
    title: { ru: "Контент: моды и шейдеры", en: "Content: mods & shaders" },
    lead: {
      ru: "Моды, шейдеры и ресурс-паки выбранной сборки в одном списке. Файлы можно перетаскивать прямо в окно.",
      en: "Mods, shaders and resource packs of the selected build in one list. Drag and drop files directly.",
    },
    bullets: {
      ru: [
        "Сверху выбирается нужная версия игры",
        "Ниже переключаются категории (моды, ресурс-паки, шейдеры)",
        "Любой мод можно временно отключить тумблером без удаления",
      ],
      en: [
        "Choose the target game build at the top",
        "Switch categories below (mods, resource packs, shaders)",
        "Any mod can be toggled off without deleting the file",
      ],
    },
  },
  {
    id: "modpacks",
    page: "modpacks",
    Icon: IconCube,
    rgb: "80, 160, 255",
    targets: [".mpcard", ".mp-search", ".page-head"],
    nav: { ru: "Модпаки", en: "Modpacks" },
    title: { ru: "Модпаки с Modrinth", en: "Modpacks from Modrinth" },
    lead: {
      ru: "Каталог готовых сборок: находишь модпак, выбираешь версию — лаунчер ставит его целиком.",
      en: "Curated modpack catalogue: search, choose a version — the launcher installs everything.",
    },
    bullets: {
      ru: [
        "Прямой поиск по каталогу Modrinth",
        "Автоматическая установка нужного лоадера и всех зависимостей",
        "Сборка сразу готова к запуску",
      ],
      en: [
        "Direct search across the Modrinth catalog",
        "Automatic installation of the required loader and all mods",
        "Build is ready to launch immediately",
      ],
    },
  },
  {
    id: "screenshots",
    page: "screenshots",
    Icon: IconCamera,
    rgb: "56, 200, 200",
    targets: [".sh-grid .shot-thumb-open", ".hotslot", ".sortseg", ".shots-toolbar", ".page-head"],
    nav: { ru: "Скриншоты", en: "Screenshots" },
    title: { ru: "Галерея скриншотов", en: "Screenshot gallery" },
    lead: {
      ru: "Все снимки экрана из игр собираются здесь: удобная сетка, фильтры и полноэкранный просмотр.",
      en: "All in-game screenshots gather here: clean grid, filters and full-screen viewer.",
    },
    bullets: {
      ru: [
        "Горячая клавиша снимка настраивается прямо на панели",
        "Снимок в один клик копируется в буфер обмена",
        "Работает как для Java, так и для Bedrock версий",
      ],
      en: [
        "Capture hotkey is configurable directly on the toolbar",
        "Copy any screenshot to clipboard with one click",
        "Works seamlessly for both Java and Bedrock versions",
      ],
    },
  },
  {
    id: "stats",
    page: "stats",
    Icon: IconChart,
    rgb: "94, 203, 111",
    targets: [".stc", ".st-cards", ".chart-card", ".empty", ".page-head"],
    nav: { ru: "Статистика", en: "Stats" },
    title: { ru: "Игровая статистика", en: "Playtime stats" },
    lead: {
      ru: "Сколько времени проведено в игре: по дням, отдельным сессиям и версиям с наглядными графиками.",
      en: "How much time you spent playing: by day, individual sessions and versions with clear charts.",
    },
    bullets: {
      ru: [
        "Суммарный наигрыш и время последней сессии",
        "График активности по дням за последние две недели",
        "Круговая диаграмма показывает любимые сборки",
      ],
      en: [
        "Total playtime and last session duration",
        "Activity timeline for the last two weeks",
        "Pie chart reveals your most played builds",
      ],
    },
  },
  {
    id: "import",
    page: "import",
    Icon: IconImport,
    rgb: "245, 168, 60",
    targets: [".src", ".custom-pick", ".page-head"],
    nav: { ru: "Импорт", en: "Import" },
    title: { ru: "Импорт из других лаунчеров", en: "Import from other launchers" },
    lead: {
      ru: "Быстрый перенос всех данных из других лаунчеров: TLauncher, Prism, SKlauncher, официального и других.",
      en: "Fast migration from other launchers: TLauncher, Prism, SKlauncher, official Minecraft and others.",
    },
    bullets: {
      ru: [
        "Автоматический поиск установленных лаунчеров на компьютере",
        "Перенос аккаунтов, миров, сборок и модов без потерь",
        "Возможность вручную указать любую нестандартную папку",
      ],
      en: [
        "Automatic discovery of installed launchers on your system",
        "Safe transfer of accounts, worlds, builds and mods",
        "Option to manually pick any custom data directory",
      ],
    },
  },
  {
    id: "diagnostics",
    page: "diagnostics",
    Icon: IconAlert,
    rgb: "255, 140, 200",
    targets: [".score-wrap", ".score-ring", ".diag-grid .card", ".page-head"],
    nav: { ru: "Диагностика", en: "Diagnostics" },
    title: { ru: "Диагностика и инструменты", en: "Diagnostics & tools" },
    lead: {
      ru: "Если что-то не работает: проверка окружения, версий Java, библиотек и целостности файлов игры.",
      en: "If something fails: checks environment, Java versions, libraries and game files integrity.",
    },
    bullets: {
      ru: [
        "Автоматическая проверка системных требований и виртуализации",
        "Проверка целостности файлов и докачка повреждённых библиотек",
        "Встроенный просмотрщик логов и экспорт отчёта для техподдержки",
      ],
      en: [
        "Automatic checks for system requirements and virtualization",
        "File integrity scanner with auto-repair for missing libraries",
        "Built-in log viewer and exportable diagnostics report",
      ],
    },
  },
  {
    id: "settings",
    page: "settings",
    Icon: IconSettings,
    rgb: "150, 165, 195",
    targets: [".theme-card", ".themes", ".sets-grid", ".page-head"],
    nav: { ru: "Настройки", en: "Settings" },
    title: { ru: "Настройки и темы оформления", en: "Settings and themes" },
    lead: {
      ru: "Выделение оперативной памяти, Java, автозапуск, папка игры. И 3 темы оформления под настроение.",
      en: "RAM allocation, Java, autostart, game directory. And 3 visual themes to match your mood.",
    },
    bullets: {
      ru: [
        "Темы Default, Mono, Eclipse, Voxel переключаются на лету",
        "Тонкая настройка памяти и JVM-аргументов для оптимизации FPS",
        "Отсюда же можно запустить это обучение заново в любой момент",
      ],
      en: [
        "Themes Default, Mono, Eclipse, Voxel switch instantly on the fly",
        "Fine-tune memory and JVM flags to maximize in-game FPS",
        "You can replay this tutorial anytime from here",
      ],
    },
    task: { kind: "click", targets: [".theme-card"] },
    taskLabel: {
      ru: "Задание: кликни по другой теме — интерфейс перекрасится сразу, включая этот тур.",
      en: "Task: click another theme — the interface recolors instantly, including this tour.",
    },
    settingsTab: "general",
  },
  {
    id: "settings-tabs",
    page: "settings",
    Icon: IconSettings,
    rgb: "80, 160, 255",
    targets: [".tabs .tab", ".tabs", ".page-head"],
    nav: { ru: "Вкладки", en: "Tabs" },
    title: { ru: "Четыре вкладки настроек", en: "Four settings tabs" },
    lead: {
      ru: "Общие (тема, язык), Игра (память, Java, окно), Диск (папки, кэш) и Опасная зона (сброс).",
      en: "General (theme, language), Game (RAM, Java, window), Disk (folders, cache) and Danger zone (resets).",
    },
    bullets: {
      ru: [
        "Переключаются кликом по горизонтальной строке вкладок",
        "Вкладка «Игра» — главная для настройки производительности",
        "Опасная зона содержит опции сброса настроек и очистки кэша",
      ],
      en: [
        "Switch with the top tab row",
        "“Game” tab is the core for tuning Minecraft performance",
        "Danger zone contains cache clearing and launcher reset options",
      ],
    },
    task: { kind: "click", targets: [".tabs .tab", ".tab"] },
    taskLabel: {
      ru: "Задание: переключи вкладку на «Игра» — откроются настройки памяти и Java.",
      en: "Task: switch the tab to “Game” — memory and Java settings will open.",
    },
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

type Rect = { x: number; y: number; w: number; h: number; r: number };
type Stage = "intro" | "tour" | "done";

const PAD = 8;
const TIP_W = 372;
const TIP_GAP = 18;

const FEATS = [
  {
    Icon: IconPlay,
    ru: ["Всё в один клик", "Версии, Java и библиотеки лаунчер ставит сам"],
    en: ["One-click everything", "Versions, Java and libraries install themselves"],
  },
  {
    Icon: IconCube,
    ru: ["Моды без боли", "Fabric, Quilt, Forge и NeoForge из коробки"],
    en: ["Mods without pain", "Fabric, Quilt, Forge and NeoForge out of the box"],
  },
  {
    Icon: IconSkin,
    ru: ["Скины, миры, серверы", "Своя библиотека с бэкапами и мониторингом"],
    en: ["Skins, worlds, servers", "Your own library with backups and monitoring"],
  },
] as const;

export const Onboarding: React.FC<Props> = ({ open, onClose, onNavigate }) => {
  const t = useT();
  const ru = t.locale === "ru";
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [frames, setFrames] = useState<Rect[]>([]);
  const [taskDone, setTaskDone] = useState(false);
  const [taskExpired, setTaskExpired] = useState(false);
  const [tipH, setTipH] = useState(380);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const scrolledStep = useRef<string | null>(null);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const bullets = ru ? step.bullets.ru : step.bullets.en;

  const close = () => {
    try { localStorage.setItem(ONBOARDING_SEEN_KEY, "1"); } catch { /* ignore */ }
    onClose();
  };

  // Каждое открытие начинает обучение заново: приветствие, первый шаг.
  useEffect(() => {
    if (open) {
      setStage("intro");
      setIndex(0);
      setTaskDone(false);
      setTaskExpired(false);
      scrolledStep.current = null;
    }
  }, [open]);

  // Сброс флагов задания при смене шага.
  // Предыдущий rect сохраняем, чтобы переход был плавным скольжением без вспышки тьмы.
  useEffect(() => {
    setTaskDone(false);
    setTaskExpired(false);
  }, [index]);

  // Навигация на нужную страницу и синхронное измерение геометрии цели
  useEffect(() => {
    if (!open || stage !== "tour") return;
    onNavigate(step.page);
    if (step.settingsTab) {
      window.dispatchEvent(new CustomEvent("trel:set-settings-tab", { detail: step.settingsTab }));
    }

    let dead = false;
    let misses = 0;

    const visible = (c: Element) => {
      const b = (c as HTMLElement).getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };

    const R = (n: number) => Math.round(n);
    const sameRect = (a: Rect, b: Rect) =>
      a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.r === b.r;

    const toRect = (el: HTMLElement): Rect => {
      const b = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const br = parseFloat(cs.borderTopLeftRadius) || 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Умные отступы: элементы, прилегающие к границам окна (например, сайдбар),
      // не должны вылезать в отрицательные координаты или обрезаться за экраном.
      const atLeft = b.left <= 4;
      const atTop = b.top <= 4;
      const atRight = b.right >= vw - 4;
      const atBottom = b.bottom >= vh - 4;

      const padL = atLeft ? 0 : Math.min(PAD, Math.max(0, b.left));
      const padT = atTop ? 0 : Math.min(PAD, Math.max(0, b.top));
      const padR = atRight ? 0 : Math.min(PAD, Math.max(0, vw - b.right));
      const padB = atBottom ? 0 : Math.min(PAD, Math.max(0, vh - b.bottom));

      const x = Math.max(0, b.left - padL);
      const y = Math.max(0, b.top - padT);
      const w = Math.min(vw - x, b.width + padL + padR);
      const h = Math.min(vh - y, b.height + padT + padB);

      const isFullEdge = atLeft && atTop && atBottom;
      const r = isFullEdge ? 0 : Math.min(br + (padL > 0 ? 5 : 0), Math.min(w, h) / 2);

      return { x: R(x), y: R(y), w: R(w), h: R(h), r: R(r) };
    };

    const unionOf = (rs: Rect[]): Rect => {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const q of rs) {
        x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y);
        x2 = Math.max(x2, q.x + q.w); y2 = Math.max(y2, q.y + q.h);
      }
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, r: 14 };
    };

    const findFrames = (): { union: Rect; frames: Rect[]; el: HTMLElement } | null => {
      if (step.task) {
        for (const sel of step.task.targets) {
          const els = Array.from(document.querySelectorAll(sel)).filter(visible) as HTMLElement[];
          if (!els.length) continue;
          const frames = els.map(toRect);
          return { union: unionOf(frames), frames, el: els[0] };
        }
      }
      for (const sel of step.targets) {
        const els = Array.from(document.querySelectorAll(sel)).filter(visible) as HTMLElement[];
        if (!els.length) continue;
        const r = toRect(els[0]);
        return { union: r, frames: [r], el: els[0] };
      }
      return null;
    };

    const tick = () => {
      if (dead) return;
      const f = findFrames();
      if (f) {
        misses = 0;
        setRect((prev) => (prev && sameRect(prev, f.union) ? prev : f.union));
        setFrames((prev) =>
          prev.length === f.frames.length && prev.every((p, i) => sameRect(p, f.frames[i]))
            ? prev
            : f.frames
        );
        if (scrolledStep.current !== step.id) {
          scrolledStep.current = step.id;
          f.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        return;
      }
      if (++misses > 12) {
        setRect(null);
        setFrames([]);
      }
    };

    tick();
    const raf1 = requestAnimationFrame(tick);
    const t1 = setTimeout(tick, 30);
    const t2 = setTimeout(tick, 90);
    const t3 = setTimeout(tick, 180);
    const t4 = setTimeout(tick, 320);

    const timer = window.setInterval(tick, 250);
    const onScroll = () => requestAnimationFrame(tick);
    const onResize = () => requestAnimationFrame(tick);

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      dead = true;
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, stage, index]);

  // Слушаем настоящие события документа: клик по цели или ввод текста
  useEffect(() => {
    if (!open || stage !== "tour" || !step.task || taskDone) return;
    const task = step.task;
    const evt = task.kind === "click" ? "click" : "input";
    const onEvt = (e: Event) => {
      const el = e.target as (Element & { value?: string }) | null;
      if (!el || typeof el.closest !== "function") return;
      if (!task.targets.some((sel) => el.closest(sel))) return;
      if (task.kind === "input" && (el.value ?? "").trim().length < 2) return;
      setTaskDone(true);
    };
    document.addEventListener(evt, onEvt, true);
    return () => document.removeEventListener(evt, onEvt, true);
  }, [open, stage, index, taskDone]);

  // Страховка от тупика: через 8 секунд невыполненного задания
  // появляется кнопка пропуска задания
  useEffect(() => {
    if (!open || stage !== "tour" || !step.task || taskDone) return;
    const id = window.setTimeout(() => setTaskExpired(true), 8000);
    return () => window.clearTimeout(id);
  }, [open, stage, index, taskDone]);

  // Выполненное задание: короткая победная пауза (900 мс) и автопереход дальше
  useEffect(() => {
    if (!open || stage !== "tour" || !taskDone) return;
    const id = window.setTimeout(() => {
      if (isLast) setStage("done");
      else setIndex((v) => Math.min(STEPS.length - 1, v + 1));
    }, 900);
    return () => window.clearTimeout(id);
  }, [open, stage, taskDone, isLast]);

  // Фактическое измерение высоты карточки для безупречного позиционирования
  useLayoutEffect(() => {
    if (stage !== "tour") return;
    const h = tipRef.current?.offsetHeight;
    if (h && Math.abs(h - tipH) > 2) setTipH(h);
  });

  // Фокус в карточке — клавиши влево/вправо/Esc работают сразу
  useEffect(() => {
    if (open && stage === "tour") tipRef.current?.focus();
  }, [open, stage, index]);

  const taskGate = !!step.task && !taskDone && !taskExpired;
  const goNext = () => {
    if (taskGate) return;
    if (isLast) setStage("done");
    else setIndex((v) => Math.min(STEPS.length - 1, v + 1));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (stage !== "tour") return;
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setIndex((v) => Math.max(0, v - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, index, isLast, taskGate]);

  if (!open) return null;

  // ---------- Сцена: приветствие ----------
  if (stage === "intro") {
    return (
      <div className="onb-stage">
        <div className="onb-card onb-intro" role="dialog" aria-modal="true" aria-label={ru ? "Приветствие обучения" : "Tutorial welcome"}>
          <div className="onb-logo"><IconSpark /></div>
          <h1 className="onb-h1">{ru ? "Добро пожаловать в Trel" : "Welcome to Trel"}</h1>
          <p className="onb-sub">
            {ru
              ? "Короткий интерактивный тур: покажем все возможности и дадим попробовать функции на живом интерфейсе."
              : "A short interactive tour: we show all features and let you try them on the live interface."}
          </p>
          <div className="onb-feats">
            {FEATS.map((f) => (
              <div className="onb-feat" key={f.ru[0]}>
                <span className="onb-feat-ico"><f.Icon /></span>
                <b>{ru ? f.ru[0] : f.en[0]}</b>
                <span>{ru ? f.ru[1] : f.en[1]}</span>
              </div>
            ))}
          </div>
          <div className="onb-actions-col">
            <button type="button" className="btn primary" onClick={() => setStage("tour")}>
              {ru ? "Начать обучение" : "Start the tour"}<IconArrow />
            </button>
            <button type="button" className="onb-linkish" onClick={close}>
              {ru ? "Я разберусь сам" : "I will explore myself"}
            </button>
          </div>
          <p className="onb-note">
            {ru ? "Ты всегда можешь пропустить тур клавишей Esc или кнопкой снизу." : "You can skip the tour anytime with Esc or the button below."}
          </p>
        </div>
      </div>
    );
  }

  // ---------- Сцена: финал ----------
  if (stage === "done") {
    return (
      <div className="onb-stage">
        <div className="onb-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
        <div className="onb-card onb-finale" role="dialog" aria-modal="true" aria-label={ru ? "Обучение завершено" : "Tutorial complete"}>
          <div className="onb-check-ring"><IconCheck /></div>
          <h1 className="onb-h1">{ru ? "Отлично, ты освоился!" : "Done, you are all set!"}</h1>
          <p className="onb-sub">
            {ru
              ? "Все ключевые разделы изучены. Теперь лаунчер готов к игре!"
              : "All core sections explored. The launcher is ready for your games!"}
          </p>
          <ul className="onb-points onb-recap">
            {(ru
              ? [
                  "Любые версии ставятся из Каталога в один клик",
                  "Моды, миры и скриншоты изолированы у каждой сборки",
                  "Настройки тем, памяти и Java всегда доступны в разделе «Настройки»",
                ]
              : [
                  "Any version installs from the Catalogue in one click",
                  "Mods, worlds and screenshots stay isolated per build",
                  "Themes, memory and Java settings are always available in Settings",
                ]
            ).map((b) => (
              <li key={b}><IconCheck /><span>{b}</span></li>
            ))}
          </ul>
          <div className="onb-actions-col">
            <button type="button" className="btn primary" onClick={close}>
              <IconPlay />{ru ? "Поехали играть" : "Let’s play"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Расчёт умного позиционирования карточки подсказки ----------
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let tipStyle: React.CSSProperties = {};

  if (!rect) {
    tipStyle = {};
  } else {
    const MARGIN = 16;

    const overlaps = (pos: { left: number; top: number }) => {
      const boxLeft = pos.left;
      const boxTop = pos.top;
      const boxRight = boxLeft + TIP_W;
      const boxBottom = boxTop + tipH;
      return (
        boxLeft < rect.x + rect.w + 8 &&
        boxRight > rect.x - 8 &&
        boxTop < rect.y + rect.h + 8 &&
        boxBottom > rect.y - 8
      );
    };

    const isTargetInSidebar = rect.x < 224 && rect.w <= 240;
    const overlapsSidebar = (pos: { left: number; top: number }) => {
      if (isTargetInSidebar) return false;
      return pos.left < 224;
    };

    type Candidate = { left: number; top: number; placement: "right" | "left" | "below" | "above"; score: number };
    const candidates: Candidate[] = [];

    // 1. Справа от цели
    const rightX = rect.x + rect.w + TIP_GAP;
    if (rightX + TIP_W <= vw - MARGIN) {
      const centerY = Math.max(MARGIN, Math.min(vh - tipH - MARGIN, rect.y + (rect.h - tipH) / 2));
      const topY = Math.max(MARGIN, Math.min(vh - tipH - MARGIN, rect.y));
      candidates.push({ left: rightX, top: centerY, placement: "right", score: 100 });
      if (Math.abs(topY - centerY) > 10) {
        candidates.push({ left: rightX, top: topY, placement: "right", score: 90 });
      }
    }

    // 2. Снизу от цели
    const belowY = rect.y + rect.h + TIP_GAP;
    if (belowY + tipH <= vh - MARGIN) {
      const alignX = Math.max(MARGIN, Math.min(vw - TIP_W - MARGIN, rect.x));
      const centerX = Math.max(MARGIN, Math.min(vw - TIP_W - MARGIN, rect.x + (rect.w - TIP_W) / 2));
      candidates.push({ left: alignX, top: belowY, placement: "below", score: 95 });
      if (Math.abs(centerX - alignX) > 10) {
        candidates.push({ left: centerX, top: belowY, placement: "below", score: 85 });
      }
    }

    // 3. Сверху от цели
    const aboveY = rect.y - tipH - TIP_GAP;
    if (aboveY >= MARGIN) {
      const alignX = Math.max(MARGIN, Math.min(vw - TIP_W - MARGIN, rect.x));
      const centerX = Math.max(MARGIN, Math.min(vw - TIP_W - MARGIN, rect.x + (rect.w - TIP_W) / 2));
      candidates.push({ left: alignX, top: aboveY, placement: "above", score: 80 });
      if (Math.abs(centerX - alignX) > 10) {
        candidates.push({ left: centerX, top: aboveY, placement: "above", score: 70 });
      }
    }

    // 4. Слева от цели
    const leftX = rect.x - TIP_W - TIP_GAP;
    if (leftX >= MARGIN) {
      const centerY = Math.max(MARGIN, Math.min(vh - tipH - MARGIN, rect.y + (rect.h - tipH) / 2));
      candidates.push({ left: leftX, top: centerY, placement: "left", score: 75 });
    }

    // Бонусы за естественный контекст размещения
    for (const c of candidates) {
      if (overlaps(c)) c.score -= 5000;
      if (overlapsSidebar(c)) c.score -= 200;

      // Если цель в левой части экрана или в сайдбаре — отдаём предпочтение правой стороне
      if (rect.x <= 230 && c.placement === "right") {
        c.score += 600;
      }
      // Если цель в верхней панели/поиске — предпочтительно размещение снизу
      if (rect.y <= 160 && c.placement === "below") {
        c.score += 350;
      }
      // Если цель в самом низу — предпочтительно сверху
      if (rect.y >= vh - 220 && c.placement === "above") {
        c.score += 350;
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0] ?? {
      left: Math.max(MARGIN, vw - TIP_W - MARGIN),
      top: Math.max(MARGIN, vh - tipH - MARGIN),
    };

    tipStyle = { left: chosen.left, top: chosen.top };
  }

  // Защитные экраны: если это шаг с заданием, клики вне цели блокируются,
  // а по самой цели — проходят. На чисто информационных шагах клики по приложению
  // блокируются, чтобы исключить случайные срабатывания действий в окне.
  const isInteractiveTask = !!step.task && !taskDone;

  const activeFrames = frames.length ? frames : (rect ? [rect] : []);

  return (
    <>
      {/* 1. Аппаратный SVG-спотлайт с маской */}
      <svg className="onb-overlay" aria-hidden="true">
        <defs>
          <mask id="onb-spot-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {activeFrames.map((fr, i) => (
              <rect
                key={i}
                className="onb-mask-cutout"
                x={fr.x}
                y={fr.y}
                width={fr.w}
                height={fr.h}
                rx={fr.r}
                ry={fr.r}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(4, 5, 8, 0.65)"
          mask="url(#onb-spot-mask)"
        />
      </svg>

      {/* 2. Защитные экраны для прозрачного перехвата кликов */}
      {rect && isInteractiveTask ? (
        <>
          <div className="onb-shield" style={{ left: 0, top: 0, right: 0, height: Math.max(0, rect.y) }} />
          <div className="onb-shield" style={{ left: 0, top: rect.y + rect.h, right: 0, bottom: 0 }} />
          <div className="onb-shield" style={{ left: 0, top: rect.y, width: Math.max(0, rect.x), height: rect.h }} />
          <div className="onb-shield" style={{ left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }} />
        </>
      ) : (
        <div className="onb-shield" style={{ inset: 0 }} />
      )}

      {/* 3. Светящиеся рамки на активных целях */}
      {activeFrames.map((fr, i) => (
        <div
          key={i}
          className={"onb-ring" + (step.task ? " task" : "") + (taskDone ? " done" : "")}
          style={{
            left: fr.x,
            top: fr.y,
            width: fr.w,
            height: fr.h,
            ["--onb-rgb" as string]: taskDone ? "94, 203, 111" : step.rgb,
            ["--onb-radius" as string]: `${fr.r}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* 4. Пульсирующий маячок для активного задания */}
      {rect && isInteractiveTask && (
        <span
          className="onb-beacon"
          style={{
            left: (frames[0] ?? rect).x + (frames[0] ?? rect).w - 8,
            top: (frames[0] ?? rect).y - 8,
            ["--onb-rgb" as string]: step.rgb,
          } as React.CSSProperties}
          aria-hidden="true"
        />
      )}

      {/* 5. Интерактивная карточка с описанием шага */}
      <div
        ref={tipRef}
        className={"onb-tip" + (!rect ? " center" : "")}
        style={{ ...tipStyle, ["--onb-rgb" as string]: step.rgb } as React.CSSProperties}
        role="dialog"
        aria-modal="false"
        aria-labelledby="onb-title"
        tabIndex={-1}
      >
        <header className="onb-head">
          <span className="onb-badge"><step.Icon /></span>
          <span className="onb-kicker">
            {ru ? `Обучение · шаг ${index + 1} из ${STEPS.length}` : `Tutorial · step ${index + 1} of ${STEPS.length}`}
          </span>
          <button
            type="button"
            className="onb-close"
            onClick={close}
            title={ru ? "Закрыть обучение (Esc)" : "Close tutorial (Esc)"}
            aria-label={ru ? "Закрыть обучение" : "Close tutorial"}
          >
            <IconClose />
          </button>
        </header>

        <div className="onb-segs" role="tablist" aria-label={ru ? "Шаги обучения" : "Tutorial steps"}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={"onb-seg" + (i === index ? " active" : "") + (i < index ? " done" : "")}
              onClick={() => setIndex(i)}
              disabled={taskGate && i > index}
              title={`${i + 1}. ${ru ? s.nav.ru : s.nav.en}`}
            >
              <span className="onb-seg-bar" />
            </button>
          ))}
        </div>

        <div className="onb-body" key={step.id}>
          <div className="onb-body-anim">
            <h2 className="onb-title" id="onb-title">{ru ? step.title.ru : step.title.en}</h2>
            <p className="onb-lead">{ru ? step.lead.ru : step.lead.en}</p>
            <ul className="onb-points">
              {bullets.map((b) => (
                <li key={b}><IconCheck /><span>{b}</span></li>
              ))}
            </ul>
            {step.task && step.taskLabel && (
              <div className={"onb-task" + (taskDone ? " done" : "")}>
                {taskDone ? (
                  <>
                    <span className="onb-task-ico"><IconCheck /></span>
                    <span className="onb-task-text">{ru ? "Есть! Отлично — едем дальше." : "Got it! Moving on."}</span>
                  </>
                ) : (
                  <>
                    <span className="onb-task-ico pulse"><IconArrow /></span>
                    <span className="onb-task-text">
                      {ru ? step.taskLabel.ru : step.taskLabel.en}
                      {taskExpired && (
                        <button type="button" className="onb-task-skip" onClick={() => setTaskDone(true)}>
                          {ru ? "Не получается? Пропустить задание" : "Stuck? Skip the task"}
                        </button>
                      )}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="onb-foot">
          <button type="button" className="onb-linkish" onClick={close}>
            {ru ? "Пропустить тур" : "Skip tour"}
          </button>
          <div className="onb-nav">
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setIndex((v) => Math.max(0, v - 1))}
              disabled={index === 0}
            >
              {ru ? "Назад" : "Back"}
            </button>
            <button type="button" className="btn primary sm" onClick={goNext} disabled={taskGate}>
              {isLast
                ? (ru ? "Финиш" : "Finish")
                : (ru ? "Дальше" : "Next")}
              {!isLast && <IconArrow />}
              {isLast && <IconCheck />}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
};

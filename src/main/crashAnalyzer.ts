// Crash Doctor — analyzer for crashes of the Minecraft Java client.
// Pure functions: the input is a log tail + crash-report text, the output — a diagnosis.
// The signature database is easy to extend (see SIGNATURES). Covered by unit tests.

export type CrashFixActionType =
  | 'increase-memory'
  | 'switch-java'
  | 'open-folder'
  | 'open-mods'
  | 'copy-report'
  | 'update-gpu-driver'
  | 'none';

export interface CrashFixAction {
  type: CrashFixActionType;
  label: string;
  /** Optional hint value (for example the recommended Xmx in MB). */
  hint?: string | number;
  /** Link for actions of the update-gpu-driver type (allowlist hosts only). */
  url?: string;
}

export interface CrashDiagnosis {
  /** Stable identifier of the cause (for i18n/tests). */
  id: string;
  severity: 'fatal' | 'warning' | 'info';
  /** Short title: what happened. */
  title: string;
  /** Human-readable explanation of the cause. */
  detail: string;
  /** Concrete steps/buttons to fix it. */
  actions: CrashFixAction[];
  /** Name of the mod/class/dependency, if it could be extracted. */
  culprit?: string;
}

export interface CrashInput {
  /** Exit code of the process (0 = clean). */
  exitCode: number;
  /** Tail of the console log (stdout+stderr). */
  logTail?: string;
  /** Contents of the latest crash-reports/*.txt, if there is one. */
  crashReport?: string;
  /** Mod loader of the profile, if any. */
  loader?: string | null;
  /** Base MC version. */
  baseMc?: string | null;
}

interface Signature {
  id: string;
  severity: CrashDiagnosis['severity'];
  /** Regexes; it triggers if at least one is found in the text. */
  patterns: RegExp[];
  /** Build the diagnosis (the culprit can be extracted via a capture group). */
  build: (text: string, input: CrashInput) => Omit<CrashDiagnosis, 'id' | 'severity'>;
}

function firstCapture(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
}

/** GPU vendor for the driver link (best-effort, without spawning a shell). */
export function detectGpuVendor(): 'nvidia' | 'amd' | 'intel' | null {
  try {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    let out = '';
    if (process.platform === 'win32') {
      out = execFileSync('wmic', ['path', 'win32_VideoController', 'get', 'name'], { timeout: 8000, encoding: 'utf-8', windowsHide: true });
    } else {
      // lspci may be missing — then null and a button without a link.
      out = execFileSync('lspci', { timeout: 8000, encoding: 'utf-8' });
    }
    const low = out.toLowerCase();
    if (low.includes('nvidia') || low.includes('geforce')) return 'nvidia';
    if (low.includes('amd') || low.includes('radeon')) return 'amd';
    if (low.includes('intel')) return 'intel';
  } catch { /* unknown vendor */ }
  return null;
}

// Order matters: the more specific signatures come before the generic ones.
const SIGNATURES: Signature[] = [
  {
    id: 'forge-missing-mods',
    severity: 'fatal',
    patterns: [/MissingModsException/i, /missing mods list/i, /requires ['"`]?([\w\-+]+)['"`]?/i],
    build: (text) => ({
      title: 'Не хватает зависимости мода (Forge)',
      detail: 'Forge отказался стартовать: какому-то моду нужен другой мод или версия. Доставь зависимость из списка ниже.',
      actions: [
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/requires ['"`]?([\w\-+]+)['"`]?/i, /Mod ([\w\-+]+) requires/i]),
    }),
  },
  {
    id: 'mixin-apply-failed',
    severity: 'fatal',
    patterns: [/MixinApplyError/i, /Mixin prepare failed/i, /org\.spongepowered\.asm\.mixin\.transformer\.throwables/i],
    build: (text) => ({
      title: 'Сломался Mixin-патч мода',
      detail: 'Мод попытался пропатчить чужой класс и не смог: обычно конфликт двух модов или мод не от этой версии игры/лоадера.',
      actions: [
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/MixinApplyError[^\n]*?(\S+\.class)/i, /for (\S+) during/i]),
    }),
  },
  {
    id: 'out-of-memory',
    severity: 'fatal',
    patterns: [/java\.lang\.OutOfMemoryError/i, /GC overhead limit exceeded/i, /unable to create new native thread/i],
    build: () => ({
      title: 'Не хватило оперативной памяти',
      detail: 'Игра упала с OutOfMemoryError. Выделенной памяти (Xmx) недостаточно — особенно с модами и большими мирами.',
      actions: [
        { type: 'increase-memory', label: 'Увеличить память', hint: 4096 },
        { type: 'open-folder', label: 'Открыть папку игры' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
    }),
  },
  {
    id: 'unsupported-java',
    severity: 'fatal',
    patterns: [
      /java\.lang\.UnsupportedClassVersionError[^\n]*?(\S+) has been compiled/i,
      /(UnsupportedClassVersionError)/i,
      /has been compiled by a more recent version of the Java Runtime/i,
    ],
    build: (text) => ({
      title: 'Несовместимая версия Java',
      detail: 'Эта версия/мод требует другую версию Java. Например, MC 1.17+ нужна Java 17+, а 1.20.5+ — Java 21.',
      actions: [
        { type: 'switch-java', label: 'Сменить версию Java' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/(\S+) has been compiled/i]),
    }),
  },
  {
    id: 'fabric-missing-deps',
    severity: 'fatal',
    patterns: [
      /net\.fabricmc\.loader\.impl\.FormattedException/i,
      /ModResolutionException/i,
      /requires (?:any version of |version )?['"`]?([\w\-]+)['"`]?/i,
    ],
    build: (text) => ({
      title: 'Конфликт или нехватка зависимостей модов (Fabric)',
      detail: 'Fabric не смог собрать набор модов: какому-то моду нужна зависимость или другая версия. Проверь, что установлены все required-моды и их версии совпадают.',
      actions: [
        { type: 'open-mods', label: 'Открыть менеджер модов' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/requires .*?['"`]?([\w\-]+)['"`]?/i]),
    }),
  },
  {
    id: 'forge-missing-deps',
    severity: 'fatal',
    patterns: [
      /Missing or unsupported mandatory dependencies/i,
      /Mod ID: '([\w\-]+)'.*requires/i,
      /requires .* loaded/i,
    ],
    build: (text) => ({
      title: 'Нехватка обязательных зависимостей (Forge)',
      detail: 'Forge сообщил, что некоторым модам не хватает обязательных зависимостей или версии не совпадают.',
      actions: [
        { type: 'open-mods', label: 'Открыть менеджер модов' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/Mod ID: '([\w\-]+)'/i]),
    }),
  },
  {
    id: 'mixin-failure',
    severity: 'fatal',
    patterns: [
      /Mixin apply(?:ing)? failed[^\n]*?([\w.]+\.json)/i,
      /org\.spongepowered\.asm\.mixin/i,
      /MixinApplyError|InvalidMixinException/i,
    ],
    build: (text) => ({
      title: 'Конфликт модов (Mixin)',
      detail: 'Один мод пытается изменить код, который уже изменён другим, либо несовместим с этой версией MC. Обычно виноват устаревший или конфликтующий мод.',
      actions: [
        { type: 'open-mods', label: 'Открыть менеджер модов' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/mixin[s]?[./]([\w]+\.json)/i, /from mod ([\w\-]+)/i]),
    }),
  },
  {
    id: 'gpu-driver',
    severity: 'fatal',
    patterns: [
      /Failed to (?:create|initialize) (?:OpenGL|GLFW|window)/i,
      /GLFW error/i,
      /Couldn't set pixel format/i,
      /org\.lwjgl/i,
      /Pixel format not accelerated/i,
      /GLFW error 65542/i,
      /EXCEPTION_ACCESS_VIOLATION.*ig[0-9a-z]+\.dll/i,
    ],
    build: () => {
      const vendor = detectGpuVendor();
      const url = vendor === 'nvidia'
        ? 'https://www.nvidia.com/Download/index.aspx'
        : vendor === 'amd'
          ? 'https://www.amd.com/en/support/download/drivers.html'
          : vendor === 'intel'
            ? 'https://www.intel.com/content/www/us/en/download-center/home.html'
            : undefined;
      return {
        title: 'Проблема с видеодрайвером / OpenGL',
        detail: 'Не удалось инициализировать графику (LWJGL/GLFW/OpenGL). Чаще всего помогает обновление драйвера видеокарты или запуск на дискретной GPU.',
        actions: [
          ...(url ? [{ type: 'update-gpu-driver' as const, label: 'Скачать драйвер', url }] : []),
          { type: 'copy-report' as const, label: 'Скопировать отчёт' },
        ],
      };
    },
  },
  {
    id: 'native-bridge',
    severity: 'fatal',
    patterns: [/UnsatisfiedLinkError/i, /libhoudini/i, /Native bridge/i],
    build: (text) => ({
      title: 'Ошибка нативной библиотеки',
      detail: 'Процесс не смог загрузить нативную библиотеку (.dll/.so). Для Bedrock-эмуляции это обычно Houdini/ARM-трансляция; для Java — повреждённые натив-файлы версии.',
      actions: [
        { type: 'open-folder', label: 'Открыть папку игры' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/UnsatisfiedLinkError:?\s*([^\n]+)/i]),
    }),
  },
  {
    id: 'duplicate-mods',
    severity: 'fatal',
    patterns: [/Found a duplicate mod/i, /DuplicateModsFoundException/i, /duplicate mods? ['"`]?([\w\-]+)/i],
    build: (text) => ({
      title: 'Дублирующиеся моды',
      detail: 'В папке mods лежит один и тот же мод в двух версиях. Удали лишнюю копию.',
      actions: [
        { type: 'open-mods', label: 'Открыть менеджер модов' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
      culprit: firstCapture(text, [/duplicate mods? ['"`]?([\w\-]+)/i]),
    }),
  },
];

/**
 * Analyzes a crash. Returns a diagnosis or null if the exit was clean (code 0)
 * and there are no signs of an error in the logs.
 */
export function analyzeCrash(input: CrashInput): CrashDiagnosis | null {
  // The crash-report header (with the description) + the log tail: previously
  // we took only the last 60k and blindly cut off the header with the main diagnosis.
  const head = (input.crashReport || '').slice(0, 20_000);
  const tail = ((input.crashReport || '') + '\n' + (input.logTail || '')).slice(-60_000);
  const text = head + '\n' + tail;

  for (const sig of SIGNATURES) {
    if (sig.patterns.some((re) => re.test(text))) {
      const partial = sig.build(text, input);
      return { id: sig.id, severity: sig.severity, ...partial };
    }
  }

  // Nothing was recognized, but the process crashed — generic diagnosis.
  if (input.exitCode !== 0) {
    return {
      id: 'unknown',
      severity: 'warning',
      title: 'Игра завершилась с ошибкой',
      detail: `Процесс вышел с кодом ${input.exitCode}. Точную причину распознать не удалось — посмотри полный лог или crash-report.`,
      actions: [
        { type: 'open-folder', label: 'Открыть папку игры' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
    };
  }

  return null;
}

/** List of the ids of all known signatures — for tests and debugging. */
export function knownSignatureIds(): string[] {
  return SIGNATURES.map((s) => s.id);
}
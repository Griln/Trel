// Crash Doctor — анализатор крашей Java-клиента Minecraft.
// Чистые функции: на вход хвост лога + текст crash-report, на выход — диагноз.
// База сигнатур легко расширяется (см. SIGNATURES). Покрыто юнит-тестами.

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
  /** Необязательная подсказка-значение (например, рекомендуемый Xmx в МБ). */
  hint?: string | number;
}

export interface CrashDiagnosis {
  /** Стабильный идентификатор причины (для i18n/тестов). */
  id: string;
  severity: 'fatal' | 'warning' | 'info';
  /** Короткий заголовок: что случилось. */
  title: string;
  /** Человеческое объяснение причины. */
  detail: string;
  /** Конкретные шаги/кнопки для починки. */
  actions: CrashFixAction[];
  /** Имя мода/класса/зависимости, если удалось извлечь. */
  culprit?: string;
}

export interface CrashInput {
  /** Код выхода процесса (0 = чисто). */
  exitCode: number;
  /** Хвост консольного лога (stdout+stderr). */
  logTail?: string;
  /** Содержимое последнего crash-reports/*.txt, если есть. */
  crashReport?: string;
  /** Мод-лоадер профиля, если есть. */
  loader?: string | null;
  /** Базовая версия MC. */
  baseMc?: string | null;
}

interface Signature {
  id: string;
  severity: CrashDiagnosis['severity'];
  /** Регексы; срабатывает, если хоть один найден в тексте. */
  patterns: RegExp[];
  /** Построить диагноз (можно извлечь culprit через capture group). */
  build: (text: string, input: CrashInput) => Omit<CrashDiagnosis, 'id' | 'severity'>;
}

function firstCapture(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
}

// Порядок важен: более специфичные сигнатуры идут раньше общих.
const SIGNATURES: Signature[] = [
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
    ],
    build: () => ({
      title: 'Проблема с видеодрайвером / OpenGL',
      detail: 'Не удалось инициализировать графику (LWJGL/GLFW/OpenGL). Чаще всего помогает обновление драйвера видеокарты или запуск на дискретной GPU.',
      actions: [
        { type: 'update-gpu-driver', label: 'Как обновить драйвер' },
        { type: 'copy-report', label: 'Скопировать отчёт' },
      ],
    }),
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
 * Анализирует краш. Возвращает диагноз или null, если выход штатный (code 0)
 * и в логах нет признаков ошибки.
 */
export function analyzeCrash(input: CrashInput): CrashDiagnosis | null {
  const text = ((input.crashReport || '') + '\n' + (input.logTail || '')).slice(-60_000);

  for (const sig of SIGNATURES) {
    if (sig.patterns.some((re) => re.test(text))) {
      const partial = sig.build(text, input);
      return { id: sig.id, severity: sig.severity, ...partial };
    }
  }

  // Ничего не распознали, но процесс упал — общий диагноз.
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

/** Список id всех известных сигнатур — для тестов и отладки. */
export function knownSignatureIds(): string[] {
  return SIGNATURES.map((s) => s.id);
}
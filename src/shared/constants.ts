/**
 * Пресеты производительности: готовые связки память+флаги.
 * Флаги заведомо проходят DANGEROUS-фильтр (проверено тестом).
 */
export const PERF_PRESETS = {
  potato: {
    memoryMb: 2048,
    jvmArgs: '-XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+DisableExplicitGC -Dfile.encoding=UTF-8',
  },
  balanced: {
    memoryMb: 4096,
    jvmArgs: '-XX:+UseG1GC -XX:MaxGCPauseMillis=50 -Dfile.encoding=UTF-8',
  },
  ultra: {
    memoryMb: 8192,
    jvmArgs: '-XX:+UseG1GC -XX:MaxGCPauseMillis=25 -XX:+AlwaysPreTouch -Dfile.encoding=UTF-8',
  },
} as const;
export type PerfPresetId = keyof typeof PERF_PRESETS;

/** Dangerous JVM flags that should be blocked from user input. */
export const DANGEROUS_JVM_ARGS = /^-(agentlib|javaagent|Xbootcp|XX:-?UseSplitVerifier|XX:NativeMemoryTracking|XX:\+FlightRecorder|XX:StartFlightRecording)/i;

/** Whitelist pattern for safe shell command characters. */
// Whitelist символов для pre/post-команд. Запрещены: подстановка $(...),
// обратные кавычки, Win-расширение %VAR% и escape ^. Абсолютные пути и аргументы
// разрешены, поэтому whitelist — не панацея, а сетка от случайных инъекций;
// команды выполняются от имени юзера.
export const SHELL_WHITELIST = /^[A-Za-z0-9\s\-_./\\:@=+,~()[\]"'!#?*{}]+$/;

/** Bedrock version source — mcpehub.org (DLE-based). Mobile UA required to see download buttons. */
export const BEDROCK_SOURCE_HOST = 'mcpehub.org';
export const BEDROCK_PACKAGE = 'com.mojang.minecraftpe';

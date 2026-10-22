/**
 * Performance presets: ready-made memory + flag combinations.
 * The flags are known to pass the DANGEROUS filter (verified by a test).
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
// Whitelist of characters for pre/post commands. Forbidden: $(...) substitution,
// backticks, the Win expansion %VAR% and the escape ^. Absolute paths and arguments
// are allowed, so the whitelist is not a panacea, but a grid against accidental injections;
// the commands run as the user.
export const SHELL_WHITELIST = /^[A-Za-z0-9\s\-_./\\:@=+,~()[\]"'!#?*{}]+$/;

/** Bedrock version source — mcpehub.org (DLE-based). Mobile UA required to see download buttons. */
export const BEDROCK_SOURCE_HOST = 'mcpehub.org';
export const BEDROCK_PACKAGE = 'com.mojang.minecraftpe';

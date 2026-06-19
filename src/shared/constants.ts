/** Dangerous JVM flags that should be blocked from user input. */
export const DANGEROUS_JVM_ARGS = /^-(agentlib|javaagent|Xbootcp|XX:-?UseSplitVerifier|XX:NativeMemoryTracking|XX:\+FlightRecorder|XX:StartFlightRecording)/i;

/** Whitelist pattern for safe shell command characters. */
export const SHELL_WHITELIST = /^[A-Za-z0-9\s\-_./\\:@%=+,~()[\]"'!#?*{}]+$/;

/** Bedrock version source — mcpehub.org (DLE-based). Mobile UA required to see download buttons. */
export const BEDROCK_SOURCE_HOST = 'mcpehub.org';
export const BEDROCK_PACKAGE = 'com.mojang.minecraftpe';

/** Dangerous JVM flags that should be blocked from user input. */
export const DANGEROUS_JVM_ARGS = /^-(agentlib|javaagent|Xbootcp|XX:-?UseSplitVerifier|XX:NativeMemoryTracking|XX:\+FlightRecorder|XX:StartFlightRecording)/i;

/** Whitelist pattern for safe shell command characters. */
export const SHELL_WHITELIST = /^[A-Za-z0-9\s\-_./\\:@%=+,~()[\]"'!#?*{}]+$/;

import { Logger, LogLevel, ConsoleSink, MemorySink, toLevel, LEVEL_NAMES } from './Logger.js';

const STORAGE_KEY = 'logLevel';

function storedLevel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return toLevel(saved, LogLevel.INFO);
  } catch {
    // Private browsing — fall through to the default.
  }
  return LogLevel.INFO;
}

/** Ring buffer of recent entries; the future debug panel reads from this. */
export const logBuffer = new MemorySink(300);

/** App-wide root logger. Prefer `log.child('Subsystem')` over using this directly. */
export const log = new Logger('app', {
  level: storedLevel(),
  sinks: [new ConsoleSink(), logBuffer]
});

/**
 * Devtools escape hatch. The deployed PWA can't be rebuilt to turn on verbose
 * logging, so expose a way to raise it live:
 *
 *   nightCool.setLogLevel('debug')
 *   nightCool.dumpLogs()
 */
globalThis.nightCool = {
  setLogLevel(level) {
    const resolved = log.setLevel(level);
    try {
      localStorage.setItem(STORAGE_KEY, LEVEL_NAMES[resolved]);
    } catch {
      // Not persisting is fine; the level still applies for this session.
    }
    return LEVEL_NAMES[resolved];
  },
  getLogLevel: () => LEVEL_NAMES[log.level],
  dumpLogs: () => logBuffer.entries(),
  clearLogs: () => logBuffer.clear()
};

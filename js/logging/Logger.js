/**
 * Application logging.
 *
 * Every log call produces the same entry shape the firmware emits:
 *
 *   { ts, level, tag, message, data }
 *
 * so a future in-app debug panel can render device and browser logs in one
 * list. Nothing outside this folder should call console.* directly.
 *
 * Entries fan out to "sinks". ConsoleSink writes to devtools; MemorySink keeps
 * a bounded ring buffer that a view can subscribe to — that is the seam the
 * debug UI will plug into, and it is already collecting.
 */

export const LogLevel = Object.freeze({
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
});

export const LEVEL_NAMES = Object.freeze(['ERROR', 'WARN', 'INFO', 'DEBUG']);

/** Resolve a level from a name ('debug'), a number, or fall back. */
export function toLevel(value, fallback = LogLevel.INFO) {
  if (typeof value === 'number' && LEVEL_NAMES[value]) return value;
  const index = LEVEL_NAMES.indexOf(String(value).toUpperCase());
  return index === -1 ? fallback : index;
}

/** Writes entries to the browser console, mapping level to the right method. */
export class ConsoleSink {
  static #methods = ['error', 'warn', 'info', 'debug'];

  write(entry) {
    const method = ConsoleSink.#methods[entry.level] ?? 'log';
    // Extra data is passed as separate args so objects and Errors stay
    // inspectable (and stack traces survive) rather than being stringified.
    console[method](`[${entry.tag}] ${entry.message}`, ...entry.data);
  }
}

/**
 * Bounded in-memory ring buffer. Holds the most recent `capacity` entries and
 * notifies subscribers on each write.
 */
export class MemorySink {
  #entries = [];
  #capacity;
  #listeners = new Set();

  constructor(capacity = 300) {
    this.#capacity = capacity;
  }

  write(entry) {
    this.#entries.push(entry);
    if (this.#entries.length > this.#capacity) this.#entries.shift();
    this.#listeners.forEach((fn) => fn(entry));
  }

  /** Snapshot of buffered entries, oldest first. */
  entries() {
    return [...this.#entries];
  }

  clear() {
    this.#entries = [];
  }

  /** Subscribe to new entries. Returns an unsubscribe function. */
  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
}

/**
 * A tagged logger. Loggers created via child() share the root's level and
 * sinks, so raising verbosity at runtime affects the whole app at once.
 */
export class Logger {
  #tag;
  #shared;

  constructor(tag = 'app', shared = { level: LogLevel.INFO, sinks: [] }) {
    this.#tag = tag;
    this.#shared = shared;
  }

  /** A logger for a subsystem, e.g. log.child('Schedule'). */
  child(tag) {
    return new Logger(tag, this.#shared);
  }

  get level() {
    return this.#shared.level;
  }

  setLevel(level) {
    this.#shared.level = toLevel(level, this.#shared.level);
    return this.#shared.level;
  }

  addSink(sink) {
    this.#shared.sinks.push(sink);
  }

  #emit(level, message, data) {
    if (level > this.#shared.level) return;
    const entry = { ts: Date.now(), level, tag: this.#tag, message, data };
    for (const sink of this.#shared.sinks) {
      try {
        sink.write(entry);
      } catch {
        // A broken sink must never take down the code that logged.
      }
    }
  }

  error(message, ...data) { this.#emit(LogLevel.ERROR, message, data); }
  warn(message, ...data)  { this.#emit(LogLevel.WARN, message, data); }
  info(message, ...data)  { this.#emit(LogLevel.INFO, message, data); }
  debug(message, ...data) { this.#emit(LogLevel.DEBUG, message, data); }
}

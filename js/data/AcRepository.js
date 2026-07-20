import {
  ref, onValue, set, query, limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { DB_PATHS, HISTORY_LIMIT, HISTORY_WINDOW_MS } from '../config.js';

/**
 * The only place in the web app that knows Realtime Database path strings and
 * on-the-wire shapes. Views and state never import `ref`/`set` themselves, so a
 * schema change is contained to this file.
 *
 * Every on*() method returns Firebase's unsubscribe function.
 */
export class AcRepository {
  #db;

  constructor(db) {
    this.#db = db;
  }

  #watch(path, handler) {
    return onValue(ref(this.#db, path), (snapshot) => handler(snapshot.val()));
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  /** Latest sensor sample: {temp, timestamp, offset}. */
  onSensor(handler) {
    return this.#watch(DB_PATHS.sensor, handler);
  }

  /** Device-reported AC state: {power, temp, mode, fan}. */
  onStatus(handler) {
    return this.#watch(DB_PATHS.status, handler);
  }

  /**
   * Device check-in time, normalised to milliseconds. The firmware writes
   * seconds to save bytes, so anything below ~1e12 is scaled up.
   */
  onHeartbeat(handler) {
    return this.#watch(DB_PATHS.heartbeat, (value) => {
      let heartbeat = Number(value) || 0;
      if (heartbeat && heartbeat < 1e12) heartbeat *= 1000;
      handler(heartbeat);
    });
  }

  /** Auto-mode flag. Defaults to enabled when the node is missing or malformed. */
  onAuto(handler) {
    return this.#watch(DB_PATHS.auto, (value) => {
      handler(typeof value?.enabled === 'boolean' ? value.enabled : true);
    });
  }

  /** Schedule blocks. Only fires when the stored value is a non-empty array. */
  onSchedule(handler) {
    return this.#watch(DB_PATHS.schedule, (value) => {
      if (Array.isArray(value) && value.length) handler(value);
    });
  }

  /** Last command written by either the UI or the device's own scheduler. */
  onCommand(handler) {
    return this.#watch(DB_PATHS.command, (value) => {
      if (value) handler(value);
    });
  }

  /**
   * History entries, normalised to {t, temp, setTemp, acOn}, sorted ascending
   * and trimmed to the last 24 hours.
   */
  onHistory(handler) {
    const historyQuery = query(ref(this.#db, DB_PATHS.history), limitToLast(HISTORY_LIMIT));
    return onValue(historyQuery, (snapshot) => {
      const raw = snapshot.val() || {};
      const cutoff = Date.now() - HISTORY_WINDOW_MS;
      const points = Object.entries(raw)
        .map(([key, entry]) => ({
          t: Number(entry?.timestamp ?? key),
          temp: Number(entry?.temp),
          setTemp: Number(entry?.setTemp),
          acOn: !!entry?.acOn
        }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.temp) && p.t >= cutoff)
        .sort((a, b) => a.t - b.t);
      handler(points);
    });
  }

  /** Debug toggles: {firebase, irEmitter, irReceiver}. */
  onDebugFlags(handler) {
    return this.#watch(DB_PATHS.debug, (value) => {
      const flags = value || {};
      handler({
        firebase: !!flags.firebase,
        irEmitter: !!flags.irEmitter,
        irReceiver: !!flags.irReceiver
      });
    });
  }

  /** Sensor calibration offset in °C. */
  onCalibrationOffset(handler) {
    return this.#watch(DB_PATHS.calibration, (value) => {
      const offset = Number(value?.offset ?? 0);
      handler(Number.isFinite(offset) ? offset : 0);
    });
  }

  /** Controller tuning: {hysteresis °C, minToggleMs}. */
  onControllerConfig(handler) {
    return this.#watch(DB_PATHS.config, (value) => {
      const hysteresis = Number(value?.hysteresis);
      const minToggleMs = Number(value?.minToggleMs);
      handler({
        hysteresis: Number.isFinite(hysteresis) ? hysteresis : 0.5,
        minToggleMs: Number.isFinite(minToggleMs) ? minToggleMs : 120000
      });
    });
  }

  // ------------------------------------------------------------------
  // Writes
  // ------------------------------------------------------------------

  setAutoEnabled(enabled) {
    return set(ref(this.#db, DB_PATHS.auto), { enabled: !!enabled });
  }

  saveSchedule(schedule) {
    return set(ref(this.#db, DB_PATHS.schedule), schedule);
  }

  /** Publish a full command; the device polls this path. */
  sendCommand(command) {
    return set(ref(this.#db, DB_PATHS.command), { ...command, timestamp: Date.now() });
  }

  setDebugFlag(name, enabled) {
    const paths = {
      firebase: DB_PATHS.debugFirebase,
      irEmitter: DB_PATHS.debugIrEmitter,
      irReceiver: DB_PATHS.debugIrReceiver
    };
    const path = paths[name];
    if (!path) throw new Error(`Unknown debug flag: ${name}`);
    return set(ref(this.#db, path), !!enabled);
  }

  setCalibrationOffset(offsetC) {
    return set(ref(this.#db, DB_PATHS.calibrationOffset), Number(offsetC) || 0);
  }

  saveControllerConfig({ hysteresis, minToggleMs }) {
    return Promise.all([
      set(ref(this.#db, DB_PATHS.configHysteresis), hysteresis),
      set(ref(this.#db, DB_PATHS.configMinToggleMs), minToggleMs)
    ]);
  }
}

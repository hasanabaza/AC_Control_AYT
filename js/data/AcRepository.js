import {
  ref, onValue, set, remove, query, limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  devicePaths, DEVICES_ROOT, HISTORY_ROOT, HISTORY_LIMIT, HISTORY_WINDOW_MS,
  HEARTBEAT_STALE_MS
} from '../config.js';

/**
 * The only place in the web app that knows Realtime Database path strings and
 * on-the-wire shapes. Views and state never import `ref`/`set` themselves, so a
 * schema change is contained to this file.
 *
 * All per-device methods act on the *active* device, set with useDevice(). The
 * composition root switches the active device and re-subscribes; the views are
 * device-agnostic and simply reflect whichever one is selected.
 *
 * Every on*() method returns Firebase's unsubscribe function.
 */
export class AcRepository {
  #db;
  #deviceId = null;
  #paths = null;

  constructor(db) {
    this.#db = db;
  }

  /** Point every per-device path at `id` (or clear it with null). */
  useDevice(id) {
    this.#deviceId = id || null;
    this.#paths = id ? devicePaths(id) : null;
  }

  get deviceId() {
    return this.#deviceId;
  }

  #path(key) {
    if (!this.#paths) throw new Error('AcRepository: no active device selected');
    return this.#paths[key];
  }

  #watch(key, handler) {
    return onValue(ref(this.#db, this.#path(key)), (snapshot) => handler(snapshot.val()));
  }

  // ------------------------------------------------------------------
  // Device registry (not scoped to the active device)
  // ------------------------------------------------------------------

  /**
   * Every registered device as {id, name, type, heartbeat (ms), online},
   * sorted by name. Reads the whole /devices tree — bounded, since history
   * lives in a separate tree — so the picker stays cheap on the free plan.
   */
  onDevices(handler) {
    return onValue(ref(this.#db, DEVICES_ROOT), (snapshot) => {
      const raw = snapshot.val() || {};
      const devices = Object.entries(raw).map(([id, node]) => {
        let heartbeat = Number(node?.heartbeat) || 0;
        if (heartbeat && heartbeat < 1e12) heartbeat *= 1000;
        return {
          id,
          name: node?.meta?.name || id,
          type: node?.meta?.type || 'ac',
          heartbeat,
          online: heartbeat > 0 && (Date.now() - heartbeat) <= HEARTBEAT_STALE_MS
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      handler(devices);
    });
  }

  /** Live name of the active device; used by the settings rename field. */
  onDeviceName(handler) {
    return this.#watch('metaName', (value) =>
      handler(typeof value === 'string' ? value : (this.#deviceId || '')));
  }

  /** Rename the active device. Firmware only seeds a name when absent, so this sticks. */
  setDeviceName(name) {
    return set(ref(this.#db, this.#path('metaName')), String(name).trim());
  }

  /**
   * Permanently remove a device and its history. A device that is still powered
   * on re-registers on its next check-in, so this only sticks for an offline
   * (decommissioned) device — the UI warns about that before calling here.
   * Defaults to the active device.
   */
  deleteDevice(id = this.#deviceId) {
    if (!id) return Promise.resolve();
    return Promise.all([
      remove(ref(this.#db, `${DEVICES_ROOT}/${id}`)),
      remove(ref(this.#db, `${HISTORY_ROOT}/${id}`))
    ]);
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  /** Latest sensor sample: {temp, timestamp, offset}. */
  onSensor(handler) {
    return this.#watch('sensor', handler);
  }

  /** Device-reported AC state: {power, temp, mode, fan}. */
  onStatus(handler) {
    return this.#watch('status', handler);
  }

  /**
   * Device check-in time, normalised to milliseconds. The firmware writes
   * seconds to save bytes, so anything below ~1e12 is scaled up.
   */
  onHeartbeat(handler) {
    return this.#watch('heartbeat', (value) => {
      let heartbeat = Number(value) || 0;
      if (heartbeat && heartbeat < 1e12) heartbeat *= 1000;
      handler(heartbeat);
    });
  }

  /** Auto-mode flag. Defaults to enabled when the node is missing or malformed. */
  onAuto(handler) {
    return this.#watch('auto', (value) => {
      handler(typeof value?.enabled === 'boolean' ? value.enabled : true);
    });
  }

  /** Schedule blocks. Only fires when the stored value is a non-empty array. */
  onSchedule(handler) {
    return this.#watch('schedule', (value) => {
      if (Array.isArray(value) && value.length) handler(value);
    });
  }

  /** Last command written by either the UI or the device's own scheduler. */
  onCommand(handler) {
    return this.#watch('command', (value) => {
      if (value) handler(value);
    });
  }

  /**
   * History entries, normalised to {t, temp, setTemp, acOn}, sorted ascending
   * and trimmed to the last 24 hours.
   */
  onHistory(handler) {
    const historyQuery = query(ref(this.#db, this.#path('history')), limitToLast(HISTORY_LIMIT));
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
    return this.#watch('debug', (value) => {
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
    return this.#watch('calibration', (value) => {
      const offset = Number(value?.offset ?? 0);
      handler(Number.isFinite(offset) ? offset : 0);
    });
  }

  /** Which sensor drives control: 'local' or another device's id. Defaults to 'local'. */
  onTempSource(handler) {
    return this.#watch('tempSource', (value) => {
      handler(typeof value === 'string' && value ? value : 'local');
    });
  }

  /** Relay GPIO override for a heater; null when unset (firmware uses its default). */
  onRelayPin(handler) {
    return this.#watch('relayPin', (value) => {
      const pin = Number(value);
      handler(Number.isInteger(pin) && pin > 0 ? pin : null);
    });
  }

  /** Controller tuning: {hysteresis °C, minToggleMs}. */
  onControllerConfig(handler) {
    return this.#watch('config', (value) => {
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
    return set(ref(this.#db, this.#path('auto')), { enabled: !!enabled });
  }

  saveSchedule(schedule) {
    return set(ref(this.#db, this.#path('schedule')), schedule);
  }

  /** Publish a full command; the device polls this path. */
  sendCommand(command) {
    return set(ref(this.#db, this.#path('command')), { ...command, timestamp: Date.now() });
  }

  setDebugFlag(name, enabled) {
    const keys = {
      firebase: 'debugFirebase',
      irEmitter: 'debugIrEmitter',
      irReceiver: 'debugIrReceiver'
    };
    const key = keys[name];
    if (!key) throw new Error(`Unknown debug flag: ${name}`);
    return set(ref(this.#db, this.#path(key)), !!enabled);
  }

  setCalibrationOffset(offsetC) {
    return set(ref(this.#db, this.#path('calibrationOffset')), Number(offsetC) || 0);
  }

  /** Set the control temperature source: 'local' or another device's id. */
  setTempSource(source) {
    return set(ref(this.#db, this.#path('tempSource')), String(source || 'local'));
  }

  /** Set (or clear, when falsy/invalid) the heater relay GPIO override. */
  setRelayPin(pin) {
    const value = Number(pin);
    const path = this.#path('relayPin');
    if (Number.isInteger(value) && value > 0) return set(ref(this.#db, path), value);
    return remove(ref(this.#db, path));
  }

  saveControllerConfig({ hysteresis, minToggleMs }) {
    return Promise.all([
      set(ref(this.#db, this.#path('configHysteresis')), hysteresis),
      set(ref(this.#db, this.#path('configMinToggleMs')), minToggleMs)
    ]);
  }
}

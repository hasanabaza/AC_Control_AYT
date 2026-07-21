import {
  DEFAULT_SCHEDULE, DEFAULT_COMMAND, HEARTBEAT_STALE_MS, SAFETY_TEMP_C, SCHEDULE_ROWS
} from '../config.js';

/**
 * Single source of truth for everything the UI renders.
 *
 * Extends EventTarget and emits one named event per slice ('sensor', 'status',
 * 'heartbeat', 'auto', 'schedule', 'command', 'history', 'scheduleDirty') so
 * views only redraw when their own data moves. This matters for the schedule
 * editor, which rebuilds its <input> nodes and would steal focus mid-edit if it
 * redrew on every sensor tick.
 */
export class AppState extends EventTarget {
  devices = [];
  activeDeviceId = null;
  sensor = null;
  status = null;
  heartbeat = 0;
  autoEnabled = true;
  schedule = structuredClone(DEFAULT_SCHEDULE);
  command = { ...DEFAULT_COMMAND };
  history = [];
  lastLiveUpdateAt = 0;
  scheduleDirty = false;

  #emit(name) {
    this.dispatchEvent(new CustomEvent(name));
  }

  // ------------------------------------------------------------------
  // Device registry
  // ------------------------------------------------------------------

  /** Replace the list of known devices (from the /devices registry). */
  setDevices(devices) {
    this.devices = Array.isArray(devices) ? devices : [];
    this.#emit('devices');
  }

  setActiveDevice(id) {
    this.activeDeviceId = id;
    this.#emit('activeDevice');
  }

  /** The currently selected device's registry entry, or null. */
  get activeDevice() {
    return this.devices.find((d) => d.id === this.activeDeviceId) || null;
  }

  /**
   * Clear all per-device slices back to defaults. Called when switching
   * devices so the UI never shows one device's readings against another's
   * name while the new subscriptions are still landing.
   */
  resetDeviceData() {
    this.sensor = null;
    this.status = null;
    this.heartbeat = 0;
    this.autoEnabled = true;
    this.schedule = structuredClone(DEFAULT_SCHEDULE);
    this.command = { ...DEFAULT_COMMAND };
    this.history = [];
    this.lastLiveUpdateAt = 0;
    this.scheduleDirty = false;
    for (const slice of ['sensor', 'status', 'heartbeat', 'auto', 'schedule',
                         'command', 'history', 'scheduleDirty']) {
      this.#emit(slice);
    }
  }

  /** Note that fresh data arrived from the device, for the "live update" tag. */
  #touchLive() {
    this.lastLiveUpdateAt = Date.now();
  }

  // ------------------------------------------------------------------
  // Mutations — called by the wiring in main.js from repository callbacks
  // ------------------------------------------------------------------

  setSensor(sensor) {
    this.sensor = sensor;
    this.#touchLive();
    this.#emit('sensor');
  }

  setStatus(status) {
    this.status = status;
    this.#touchLive();
    this.#emit('status');
  }

  setHeartbeat(heartbeatMs) {
    this.heartbeat = heartbeatMs;
    this.#touchLive();
    this.#emit('heartbeat');
  }

  setAutoEnabled(enabled) {
    this.autoEnabled = enabled;
    this.#emit('auto');
  }

  /** Replace the schedule from the database; clears the unsaved-changes flag. */
  setSchedule(schedule) {
    this.schedule = Array.from({ length: SCHEDULE_ROWS }, (_, i) => ({
      ...this.schedule[i],
      ...schedule[i]
    }));
    this.scheduleDirty = false;
    this.#emit('schedule');
    this.#emit('scheduleDirty');
  }

  /** Apply a local edit to one schedule block and mark it unsaved. */
  updateScheduleBlock(index, patch) {
    if (!this.schedule[index]) return;
    this.schedule[index] = { ...this.schedule[index], ...patch };
    this.scheduleDirty = true;
    this.#emit('schedule');
    this.#emit('scheduleDirty');
  }

  markScheduleSaved() {
    this.scheduleDirty = false;
    this.#emit('scheduleDirty');
  }

  setCommand(command) {
    this.command = {
      power: command.power ?? this.command.power,
      temp: typeof command.temp === 'number' ? command.temp : this.command.temp,
      mode: command.mode ?? this.command.mode,
      fan: command.fan ?? this.command.fan
    };
    this.#emit('command');
  }

  setHistory(points) {
    this.history = points;
    this.#emit('history');
  }

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------

  /** True when the device hasn't checked in recently enough to trust. */
  get isDeviceStale() {
    return !this.heartbeat || (Date.now() - this.heartbeat) > HEARTBEAT_STALE_MS;
  }

  get roomTemp() {
    return typeof this.sensor?.temp === 'number' ? this.sensor.temp : null;
  }

  /**
   * Effective power. An explicit 'off' from either the device or the last
   * command wins, so the UI never claims the AC is running when either side
   * says otherwise.
   */
  get power() {
    const fromStatus = typeof this.status?.power === 'string' ? this.status.power : null;
    const fromCommand = typeof this.command?.power === 'string' ? this.command.power : null;
    if (fromStatus === 'off' || fromCommand === 'off') return 'off';
    if (fromStatus === 'on' || fromCommand === 'on') return 'on';
    return 'unknown';
  }

  /** Target temperature, preferring the command over device-reported status. */
  get setTemp() {
    if (typeof this.command?.temp === 'number') return this.command.temp;
    if (typeof this.status?.temp === 'number') return this.status.temp;
    return null;
  }

  /** Auto mode on, room hot, and the device silent — worth warning about. */
  get needsSafetyWarning() {
    const hot = this.roomTemp !== null && this.roomTemp > SAFETY_TEMP_C;
    return this.autoEnabled && hot && this.isDeviceStale;
  }
}

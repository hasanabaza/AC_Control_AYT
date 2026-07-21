// Firebase connection details, Realtime Database paths and tuning constants.
//
// Note: the Firebase web apiKey is public by design (it identifies the project,
// it does not authorise access). Access control lives in the Realtime Database
// security rules, not here.

export const firebaseConfig = {
  apiKey: "AIzaSyCZSpKfPC0K9KVnf5BnfJBHfGtaAHWDIWI",
  authDomain: "ac-control-ayt.firebaseapp.com",
  databaseURL: "https://ac-control-ayt-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ac-control-ayt",
  storageBucket: "ac-control-ayt.firebasestorage.app",
  messagingSenderId: "11363048858",
  appId: "1:11363048858:web:9d42ac960e407f4fe2ae23"
};

// Roots of the two top-level trees. Live state is bounded and per-device under
// DEVICES_ROOT; the growing history is a separate tree so the device picker can
// read every device's live state without dragging history over the wire.
export const DEVICES_ROOT = 'devices';
export const HISTORY_ROOT = 'history';

// Build every Realtime Database path for one device. The firmware mirrors this
// layout (see AcCloud) — keep the two in sync. A schema change touches only
// this function and its AcCloud counterpart.
export function devicePaths(id) {
  const base = `${DEVICES_ROOT}/${id}`;
  return {
    meta:              `${base}/meta`,
    metaName:          `${base}/meta/name`,
    sensor:            `${base}/sensor`,
    status:            `${base}/status`,
    heartbeat:         `${base}/heartbeat`,
    command:           `${base}/command`,
    auto:              `${base}/auto`,
    schedule:          `${base}/schedule`,
    history:           `${HISTORY_ROOT}/${id}`,
    debug:             `${base}/debug`,
    debugFirebase:     `${base}/debug/firebase`,
    debugIrEmitter:    `${base}/debug/irEmitter`,
    debugIrReceiver:   `${base}/debug/irReceiver`,
    calibration:       `${base}/calibration`,
    calibrationOffset: `${base}/calibration/offset`,
    config:            `${base}/config`,
    configHysteresis:  `${base}/config/hysteresis`,
    configMinToggleMs: `${base}/config/minToggleMs`
  };
}

// A heartbeat older than this marks the device offline.
export const HEARTBEAT_STALE_MS = 90 * 1000;

// Room temperature above which a stale device triggers the safety banner.
export const SAFETY_TEMP_C = 32;

// Allowed target-temperature range for both manual control and schedule blocks.
export const TEMP_MIN_C = 16;
export const TEMP_MAX_C = 30;

// History window and how many entries to pull before trimming to the window.
export const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HISTORY_LIMIT = 300;

// Re-render cadence for views that age out on their own (clocks, staleness).
export const CONNECTION_REFRESH_MS = 15 * 1000;
export const ARC_REFRESH_MS = 60 * 1000;

export const DEFAULT_SCHEDULE = [
  { enabled: true,  start: "22:00", end: "07:00", targetTemp: 26 },
  { enabled: false, start: "13:00", end: "15:00", targetTemp: 26 }
];

export const DEFAULT_COMMAND = { power: "off", temp: 24, mode: "cool", fan: "auto" };

// Number of schedule rows the UI edits. The firmware accepts any count.
export const SCHEDULE_ROWS = 2;

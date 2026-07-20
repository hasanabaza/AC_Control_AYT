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

// Every Realtime Database path the app touches. The device mirrors these in
// firmware config — keep the two in sync.
export const DB_PATHS = {
  sensor:            'ac/sensor',
  status:            'ac/status',
  heartbeat:         'ac/heartbeat',
  command:           'ac/command',
  auto:              'ac/auto',
  schedule:          'ac/schedule',
  history:           'ac/history',
  debug:             'ac/debug',
  debugFirebase:     'ac/debug/firebase',
  debugIrEmitter:    'ac/debug/irEmitter',
  debugIrReceiver:   'ac/debug/irReceiver',
  calibration:       'ac/calibration',
  calibrationOffset: 'ac/calibration/offset',
  config:            'ac/config',
  configHysteresis:  'ac/config/hysteresis',
  configMinToggleMs: 'ac/config/minToggleMs'
};

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

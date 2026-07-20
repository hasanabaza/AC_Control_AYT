// Small time helpers shared by several views.

/** Human "3m ago" style label for a past timestamp (ms), localised via i18n. */
export function timeAgo(timestampMs, i18n) {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return i18n.t('secondsAgo', { n: seconds });
  if (seconds < 3600) return i18n.t('minutesAgo', { n: Math.round(seconds / 60) });
  return i18n.t('hoursAgo', { n: Math.round(seconds / 3600) });
}

/** "14:35" for a timestamp in ms. */
export function formatClock(timestampMs) {
  return new Date(timestampMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "14:35:07" for a timestamp in ms. */
export function formatClockWithSeconds(timestampMs) {
  return new Date(timestampMs).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/** "14:35 · 03/07" for a timestamp in ms. */
export function formatDateTime(timestampMs) {
  return new Date(timestampMs).toLocaleString([], {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
  });
}

/** "HH:MM" -> minutes since midnight. Returns 0 for malformed input. */
export function timeToMinutes(hhmm) {
  const [hours, minutes] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

/** Minutes elapsed today, for positioning the "now" marker on the 24h arc. */
export function minutesOfDay(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

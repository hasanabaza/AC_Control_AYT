import { timeToMinutes, minutesOfDay } from '../utils/time.js';
import { ARC_REFRESH_MS } from '../config.js';

const VIEW_W = 300;
const VIEW_H = 96;
const MINUTES_PER_DAY = 1440;
const BAND_Y = 8;
const BAND_H = 34;
const LINE_Y = 66;
const LINE_H = 22;

/**
 * The signature 24-hour visual: day/night gradient, scheduled cooling bands,
 * the recorded temperature trace, and a marker at the current time.
 *
 * Rendered as an SVG string in one pass — cheap enough at this size, and far
 * easier to follow than incremental DOM patching.
 */
export class NightArcView {
  #state;
  #svg;
  #timer = null;

  constructor(state) {
    this.#state = state;
    this.#svg = document.getElementById('nightArc');

    ['schedule', 'history'].forEach((event) =>
      this.#state.addEventListener(event, () => this.render())
    );
  }

  /** Start the clock that keeps the "now" marker moving. */
  start() {
    if (this.#timer !== null) return;
    this.#timer = setInterval(() => this.render(), ARC_REFRESH_MS);
    this.render();
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  render() {
    this.#svg.innerHTML = [
      this.#background(),
      this.#hourGrid(),
      this.#scheduleBands(),
      this.#temperatureTrace(),
      this.#nowMarker()
    ].join('');
  }

  #background() {
    return `
      <defs>
        <linearGradient id="dayNight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#0A1120"/>
          <stop offset="25%"  stop-color="#16233F"/>
          <stop offset="50%"  stop-color="#2C3F63"/>
          <stop offset="75%"  stop-color="#16233F"/>
          <stop offset="100%" stop-color="#0A1120"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="url(#dayNight)"/>
    `;
  }

  #hourGrid() {
    const lines = [];
    for (let hour = 0; hour <= 24; hour += 3) {
      const x = (hour / 24) * VIEW_W;
      lines.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${VIEW_H}" stroke="#263353" stroke-width="1" opacity="0.5"/>`
      );
    }
    return lines.join('');
  }

  /** Teal bands for enabled blocks; overnight ranges are split at midnight. */
  #scheduleBands() {
    return this.#state.schedule
      .filter((block) => block.enabled)
      .flatMap((block) => {
        const start = timeToMinutes(block.start);
        const end = timeToMinutes(block.end);
        return end > start
          ? [this.#band(start, end)]
          : [this.#band(start, MINUTES_PER_DAY), this.#band(0, end)];
      })
      .join('');
  }

  #band(fromMinutes, toMinutes) {
    const x1 = (fromMinutes / MINUTES_PER_DAY) * VIEW_W;
    const x2 = (toMinutes / MINUTES_PER_DAY) * VIEW_W;
    const width = Math.max(2, x2 - x1);
    return `<rect x="${x1}" y="${BAND_Y}" width="${width}" height="${BAND_H}" rx="4" fill="var(--cool)" opacity="0.55"/>`;
  }

  /**
   * Recorded temperatures from the last 24h, plotted by time-of-day and scaled
   * to whatever range those samples span.
   */
  #temperatureTrace() {
    const points = this.#state.history;
    if (points.length < 2) return '';

    const temps = points.map((p) => p.temp);
    const min = Math.min(...temps);
    const range = Math.max(1, Math.max(...temps) - min);

    const path = points
      .map((point, i) => {
        const x = (minutesOfDay(new Date(point.t)) / MINUTES_PER_DAY) * VIEW_W;
        const y = LINE_Y + LINE_H - ((point.temp - min) / range) * LINE_H;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    return `<path d="${path}" fill="none" stroke="var(--warm)" stroke-width="2" opacity="0.85"/>`;
  }

  #nowMarker() {
    const x = (minutesOfDay() / MINUTES_PER_DAY) * VIEW_W;
    return `
      <line x1="${x}" y1="0" x2="${x}" y2="${VIEW_H}" stroke="#E7ECF7" stroke-width="1.5"/>
      <circle cx="${x}" cy="4" r="3" fill="#E7ECF7"/>
    `;
  }
}

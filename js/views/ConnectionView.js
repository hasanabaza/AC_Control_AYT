import { formatClock } from '../utils/time.js';
import { CONNECTION_REFRESH_MS } from '../config.js';

/**
 * Online/offline pill in the app bar. Repaints on heartbeat changes and on a
 * timer, since "stale" becomes true through the passage of time alone.
 */
export class ConnectionView {
  #state;
  #i18n;
  #els;
  #timer = null;

  constructor(state, i18n) {
    this.#state = state;
    this.#i18n = i18n;
    this.#els = {
      pill: document.getElementById('statusPill'),
      text: document.getElementById('statusText')
    };

    this.#state.addEventListener('heartbeat', () => this.render());
    this.#i18n.onChange(() => this.render());
  }

  /** Begin the staleness re-check timer. Called once the user is signed in. */
  start() {
    if (this.#timer !== null) return;
    this.#timer = setInterval(() => this.render(), CONNECTION_REFRESH_MS);
    this.render();
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  render() {
    const { pill, text } = this.#els;
    const stale = this.#state.isDeviceStale;

    pill.classList.toggle('online', !stale);
    pill.classList.toggle('offline', stale);

    if (!stale) {
      text.textContent = this.#i18n.t('statusOnline');
    } else if (this.#state.heartbeat) {
      text.textContent = this.#i18n.t('statusOfflineSince', {
        since: formatClock(this.#state.heartbeat)
      });
    } else {
      text.textContent = this.#i18n.t('statusOffline');
    }
  }
}

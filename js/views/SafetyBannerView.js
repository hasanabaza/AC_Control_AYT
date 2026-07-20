import { formatClock } from '../utils/time.js';
import { CONNECTION_REFRESH_MS } from '../config.js';

/**
 * Warns when the room is hot, auto mode is on, and the device has gone quiet —
 * the combination where the user might reasonably believe cooling is happening
 * when it is not.
 */
export class SafetyBannerView {
  #state;
  #i18n;
  #els;
  #timer = null;

  constructor(state, i18n) {
    this.#state = state;
    this.#i18n = i18n;
    this.#els = {
      banner: document.getElementById('safetyBanner'),
      text: document.getElementById('safetyBannerText')
    };

    ['sensor', 'status', 'heartbeat', 'auto'].forEach((event) =>
      this.#state.addEventListener(event, () => this.render())
    );
    this.#i18n.onChange(() => this.render());
  }

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
    const { banner, text } = this.#els;
    const show = this.#state.needsSafetyWarning;

    banner.style.display = show ? 'block' : 'none';
    if (!show) return;

    text.textContent = this.#i18n.t('safetyBanner', {
      temp: this.#state.roomTemp.toFixed(1),
      since: this.#state.heartbeat
        ? formatClock(this.#state.heartbeat)
        : this.#i18n.t('waitingForDevice')
    });
  }
}

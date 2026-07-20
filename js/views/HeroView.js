import { timeAgo, formatClockWithSeconds } from '../utils/time.js';

/**
 * The headline card: current room temperature, AC state, and freshness.
 * DOM lookups happen once in the constructor rather than on every render.
 */
export class HeroView {
  #state;
  #i18n;
  #els;

  constructor(state, i18n) {
    this.#state = state;
    this.#i18n = i18n;
    this.#els = {
      temp: document.getElementById('currentTemp'),
      acState: document.getElementById('acStateLabel'),
      updated: document.getElementById('lastUpdated'),
      liveTag: document.getElementById('liveTag'),
      liveTagText: document.getElementById('liveTagText')
    };

    ['sensor', 'status', 'auto', 'command'].forEach((event) =>
      this.#state.addEventListener(event, () => this.render())
    );
    this.#i18n.onChange(() => this.render());
  }

  render() {
    const { temp, acState, updated, liveTag, liveTagText } = this.#els;
    const state = this.#state;
    const t = (key, vars) => this.#i18n.t(key, vars);

    const roomTemp = state.roomTemp;
    temp.textContent = roomTemp !== null ? roomTemp.toFixed(1) : '--';

    const setTemp = state.setTemp !== null ? state.setTemp.toFixed(0) : '--';
    const power = state.power;

    if (power === 'on') {
      const modeLabel = state.autoEnabled ? t('modeAutoButton') : t('modeManualButton');
      acState.textContent = `${modeLabel} · ${setTemp}°C`;
      acState.classList.add('on');
    } else if (power === 'off') {
      acState.textContent = `${t('stateOff')} · --°C`;
      acState.classList.remove('on');
    } else {
      acState.textContent = t('stateUnknown');
      acState.classList.remove('on');
    }

    const sampledAt = state.sensor?.timestamp || 0;
    updated.textContent = sampledAt
      ? t('updatedPrefix', { time: timeAgo(sampledAt, this.#i18n) })
      : t('waitingForDevice');

    if (state.lastLiveUpdateAt) {
      liveTag.style.display = 'inline-flex';
      // Only the text node is replaced so the pulsing dot element survives.
      liveTagText.textContent =
        `${t('liveUpdate')} · ${formatClockWithSeconds(state.lastLiveUpdateAt)}`;
    } else {
      liveTag.style.display = 'none';
    }
  }
}

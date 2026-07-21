import { log } from '../logging/log.js';

const logger = log.child('DevicePicker');

/**
 * The device selector in the app bar. Renders one option per registered
 * device, marks the active one, and reports selection changes upward — it does
 * not touch the repository itself, so all subscription switching stays in the
 * composition root.
 */
export class DevicePickerView {
  #state;
  #i18n;
  #onSelect;
  #select;

  constructor(state, i18n, { onSelect }) {
    this.#state = state;
    this.#i18n = i18n;
    this.#onSelect = onSelect;
    this.#select = document.getElementById('deviceSelect');

    this.#select.addEventListener('change', () => {
      if (this.#select.value) this.#onSelect(this.#select.value);
    });

    state.addEventListener('devices', () => this.render());
    state.addEventListener('activeDevice', () => this.render());
    this.#i18n.onChange(() => this.render());
  }

  render() {
    const devices = this.#state.devices;
    const active = this.#state.activeDeviceId;

    this.#select.replaceChildren();

    if (!devices.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = this.#i18n.t('noDevices');
      this.#select.appendChild(opt);
      this.#select.disabled = true;
      return;
    }

    this.#select.disabled = false;
    for (const device of devices) {
      const opt = document.createElement('option');
      opt.value = device.id;
      // Leading dot doubles as an at-a-glance online indicator.
      opt.textContent = `${device.online ? '●' : '○'} ${device.name}`;
      if (device.id === active) opt.selected = true;
      this.#select.appendChild(opt);
    }
    logger.debug(`rendered ${devices.length} device(s), active=${active}`);
  }
}

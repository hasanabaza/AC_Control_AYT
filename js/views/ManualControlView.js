import { TEMP_MIN_C, TEMP_MAX_C } from '../config.js';
import { clamp } from '../utils/time.js';
import { log } from '../logging/log.js';

const logger = log.child('Manual');

/**
 * Power / target temperature / mode / fan controls.
 *
 * Each interaction publishes the full command object, because the device reads
 * /ac/command as a whole rather than watching individual fields.
 */
export class ManualControlView {
  #state;
  #repo;
  #els;

  constructor(state, repo) {
    this.#state = state;
    this.#repo = repo;
    this.#els = {
      power: document.getElementById('powerSwitch'),
      tempValue: document.getElementById('tempVal'),
      tempUp: document.getElementById('tempUp'),
      tempDown: document.getElementById('tempDown'),
      mode: document.getElementById('modeSelect'),
      fan: document.getElementById('fanSelect')
    };

    this.#els.power.addEventListener('click', () =>
      this.#send({ power: this.#state.command.power === 'on' ? 'off' : 'on' }));
    this.#els.tempUp.addEventListener('click', () => this.#stepTemp(+1));
    this.#els.tempDown.addEventListener('click', () => this.#stepTemp(-1));
    this.#els.mode.addEventListener('change', (e) => this.#send({ mode: e.target.value }));
    this.#els.fan.addEventListener('change', (e) => this.#send({ fan: e.target.value }));

    this.#state.addEventListener('command', () => this.render());
  }

  #stepTemp(delta) {
    this.#send({ temp: clamp(this.#state.command.temp + delta, TEMP_MIN_C, TEMP_MAX_C) });
  }

  /** Apply the change locally for instant feedback, then publish it. */
  #send(patch) {
    const command = { ...this.#state.command, ...patch };
    this.#state.setCommand(command);
    logger.debug(`sending ${JSON.stringify(patch)}`);
    this.#repo.sendCommand(command).catch((error) =>
      logger.error('command write failed', error));
  }

  render() {
    const { power, tempValue, mode, fan } = this.#els;
    const command = this.#state.command;

    power.classList.toggle('on', command.power === 'on');
    tempValue.textContent = `${command.temp}°`;
    mode.value = command.mode;
    fan.value = command.fan;
  }
}

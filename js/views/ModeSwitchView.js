/**
 * Auto / Manual segmented control. Writes straight to the database; the UI
 * updates when the resulting /ac/auto change echoes back, so the button state
 * always reflects what the device will actually see.
 */
export class ModeSwitchView {
  #state;
  #repo;
  #els;

  constructor(state, repo) {
    this.#state = state;
    this.#repo = repo;
    this.#els = {
      auto: document.getElementById('modeAutoBtn'),
      manual: document.getElementById('modeManualBtn'),
      manualGrid: document.getElementById('manualGrid'),
      manualNote: document.getElementById('manualNote')
    };

    this.#els.auto.addEventListener('click', () => this.#repo.setAutoEnabled(true));
    this.#els.manual.addEventListener('click', () => this.#repo.setAutoEnabled(false));
    this.#state.addEventListener('auto', () => this.render());
  }

  render() {
    const { auto, manual, manualGrid, manualNote } = this.#els;
    const autoEnabled = this.#state.autoEnabled;

    auto.classList.toggle('active', autoEnabled);
    manual.classList.toggle('active', !autoEnabled);
    // Manual controls are inert while the device is driving itself.
    manualGrid.classList.toggle('disabled', autoEnabled);
    manualNote.style.display = autoEnabled ? 'block' : 'none';
  }
}

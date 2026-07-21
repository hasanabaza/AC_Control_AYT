/**
 * Settings page: debug toggles, sensor calibration and controller tuning.
 *
 * Also owns the main/settings view swap. Values are pushed from the database
 * into the inputs, so two browsers stay consistent.
 */
export class SettingsView {
  #repo;
  #i18n;
  #els;

  constructor(repo, i18n) {
    this.#repo = repo;
    this.#i18n = i18n;
    this.#els = {
      mainView: document.getElementById('mainView'),
      settingsView: document.getElementById('settingsView'),
      openBtn: document.getElementById('settingsBtn'),
      closeBtn: document.getElementById('closeSettingsBtn'),
      deviceName: document.getElementById('deviceNameInput'),
      saveDeviceNameBtn: document.getElementById('saveDeviceNameBtn'),
      deleteDeviceBtn: document.getElementById('deleteDeviceBtn'),
      debugFirebase: document.getElementById('debugFirebase'),
      debugEmitter: document.getElementById('debugEmitter'),
      debugReceiver: document.getElementById('debugReceiver'),
      calibrationOffset: document.getElementById('calibrationOffset'),
      saveCalibrationBtn: document.getElementById('saveCalibrationBtn'),
      hysteresis: document.getElementById('hysteresisInput'),
      minToggleSec: document.getElementById('minToggleSec'),
      saveConfigBtn: document.getElementById('saveConfigBtn')
    };

    this.#els.openBtn.addEventListener('click', () => this.open());
    this.#els.closeBtn.addEventListener('click', () => this.close());

    this.#els.saveDeviceNameBtn.addEventListener('click', () => {
      const name = this.#els.deviceName.value.trim();
      if (name) this.#repo.setDeviceName(name);
    });

    this.#els.deleteDeviceBtn.addEventListener('click', () => this.#deleteDevice());

    this.#els.debugFirebase.addEventListener('change', (e) =>
      this.#repo.setDebugFlag('firebase', e.target.checked));
    this.#els.debugEmitter.addEventListener('change', (e) =>
      this.#repo.setDebugFlag('irEmitter', e.target.checked));
    this.#els.debugReceiver.addEventListener('change', (e) =>
      this.#repo.setDebugFlag('irReceiver', e.target.checked));

    this.#els.saveCalibrationBtn.addEventListener('click', () =>
      this.#repo.setCalibrationOffset(Number(this.#els.calibrationOffset.value)));

    this.#els.saveConfigBtn.addEventListener('click', () => this.#saveControllerConfig());
  }

  open() {
    this.#els.mainView.style.display = 'none';
    this.#els.settingsView.style.display = 'block';
  }

  close() {
    this.#els.mainView.style.display = 'block';
    this.#els.settingsView.style.display = 'none';
  }

  /**
   * Subscribe to the active device's settings paths. Returns the list of
   * unsubscribe functions so the composition root can detach them when the
   * selected device changes.
   */
  bind() {
    return [
      this.#repo.onDeviceName((name) => {
        // Don't clobber a name the user is mid-edit; only sync when unfocused.
        if (document.activeElement !== this.#els.deviceName) {
          this.#els.deviceName.value = name;
        }
      }),

      this.#repo.onDebugFlags((flags) => {
        this.#els.debugFirebase.checked = flags.firebase;
        this.#els.debugEmitter.checked = flags.irEmitter;
        this.#els.debugReceiver.checked = flags.irReceiver;
      }),

      this.#repo.onCalibrationOffset((offset) => {
        this.#els.calibrationOffset.value = offset.toFixed(1);
      }),

      this.#repo.onControllerConfig(({ hysteresis, minToggleMs }) => {
        this.#els.hysteresis.value = hysteresis.toFixed(1);
        // Stored in milliseconds, edited in whole seconds.
        this.#els.minToggleSec.value = Math.round(minToggleMs / 1000);
      })
    ];
  }

  /*
   * Delete the active device (and its history). A powered-on device re-registers
   * on its next check-in, so the confirmation says to unplug it first. After the
   * delete, main.js's registry listener switches the picker to another device.
   */
  #deleteDevice() {
    const name = this.#els.deviceName.value.trim() || this.#repo.deviceId || '';
    if (!window.confirm(this.#i18n.t('deleteDeviceConfirm', { name }))) return;
    this.#repo.deleteDevice();
    this.close();
  }

  #saveControllerConfig() {
    const hysteresis = Number(this.#els.hysteresis.value) || 0.5;
    const seconds = Number(this.#els.minToggleSec.value) || 120;
    this.#repo.saveControllerConfig({
      hysteresis,
      minToggleMs: Math.max(0, Math.round(seconds * 1000))
    });
  }
}

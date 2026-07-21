import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { firebaseConfig } from './config.js';
import { log } from './logging/log.js';
import { translations } from './i18n/translations.js';
import { I18n } from './i18n/I18n.js';
import { AcRepository } from './data/AcRepository.js';
import { AppState } from './state/AppState.js';

import { AuthView } from './views/AuthView.js';
import { DevicePickerView } from './views/DevicePickerView.js';
import { HeroView } from './views/HeroView.js';
import { ConnectionView } from './views/ConnectionView.js';
import { SafetyBannerView } from './views/SafetyBannerView.js';
import { NightArcView } from './views/NightArcView.js';
import { ModeSwitchView } from './views/ModeSwitchView.js';
import { ScheduleView } from './views/ScheduleView.js';
import { ManualControlView } from './views/ManualControlView.js';
import { HistoryChartView } from './views/HistoryChartView.js';
import { SettingsView } from './views/SettingsView.js';

const logger = log.child('App');

// Remembers the last device selected, so a returning visitor lands on it.
const LAST_DEVICE_KEY = 'nightcool.device';

/**
 * Composition root: builds every collaborator, wires the repository's database
 * callbacks into the state, and lets each view react to the slices it cares
 * about. Nothing else in the app reaches across these boundaries.
 */
class NightCoolApp {
  #state = new AppState();
  #i18n = new I18n(translations);
  #repo;
  #auth;
  #views;
  #listenersStarted = false;
  // Unsubscribe functions for the *active device*; replaced on every switch.
  #deviceUnsubs = [];

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.#auth = getAuth(app);
    this.#repo = new AcRepository(getDatabase(app));

    this.#views = {
      picker: new DevicePickerView(this.#state, this.#i18n,
        { onSelect: (id) => this.#selectDevice(id) }),
      hero: new HeroView(this.#state, this.#i18n),
      connection: new ConnectionView(this.#state, this.#i18n),
      safety: new SafetyBannerView(this.#state, this.#i18n),
      arc: new NightArcView(this.#state),
      modeSwitch: new ModeSwitchView(this.#state, this.#repo),
      schedule: new ScheduleView(this.#state, this.#repo, this.#i18n),
      manual: new ManualControlView(this.#state, this.#repo),
      history: new HistoryChartView(this.#state, this.#i18n),
      settings: new SettingsView(this.#repo, this.#i18n),
      auth: new AuthView(this.#auth, this.#i18n, { onSignedIn: () => this.#startListeners() })
    };
  }

  async start() {
    this.#initLanguageToggle();
    this.#i18n.applyToDom();
    this.#renderAll();

    if (this.#hasPlaceholderConfig()) {
      logger.error('Firebase config still contains placeholder values');
      this.#views.auth.disableWithConfigError();
      return;
    }

    await this.#views.auth.start();
  }

  #hasPlaceholderConfig() {
    return Object.values(firebaseConfig)
      .some((value) => typeof value === 'string' && value.includes('REPLACE_ME'));
  }

  #initLanguageToggle() {
    const button = document.getElementById('languageToggle');
    const sync = () => {
      // The flag shows the language you'd switch *to*, not the current one.
      const toTurkish = this.#i18n.lang === 'en';
      button.textContent = toTurkish ? '🇹🇷' : '🇬🇧';
      const label = this.#i18n.t(toTurkish ? 'switchToTurkish' : 'switchToEnglish');
      button.title = label;
      button.setAttribute('aria-label', label);
    };

    button.addEventListener('click', () => this.#i18n.toggle());
    this.#i18n.onChange(sync);
    sync();
  }

  /** Paint initial state before any database data has arrived. */
  #renderAll() {
    this.#views.picker.render();
    this.#views.hero.render();
    this.#views.connection.render();
    this.#views.safety.render();
    this.#views.arc.render();
    this.#views.modeSwitch.render();
    this.#views.schedule.render();
    this.#views.schedule.renderSaveState();
    this.#views.manual.render();
  }

  /**
   * Runs once, on first successful sign-in. Subscribes to the device registry
   * and starts the self-ageing views; per-device subscriptions are attached
   * separately whenever the active device changes.
   */
  #startListeners() {
    if (this.#listenersStarted) return;
    this.#listenersStarted = true;
    logger.info('attaching device registry listener');

    this.#repo.onDevices((devices) => {
      this.#state.setDevices(devices);
      this.#ensureActiveDevice(devices);
    });

    // Views whose output ages on its own need their own timers.
    this.#views.connection.start();
    this.#views.safety.start();
    this.#views.arc.start();
  }

  /**
   * Pick an active device when none is selected yet (first load), or recover
   * if the current one disappeared from the registry.
   */
  #ensureActiveDevice(devices) {
    const current = this.#state.activeDeviceId;
    if (current && devices.some((d) => d.id === current)) return;

    // No devices left (e.g. the last one was just deleted): detach and clear so
    // the UI doesn't keep showing a device that no longer exists.
    if (!devices.length) {
      this.#detachDevice();
      this.#state.resetDeviceData();
      this.#state.setActiveDevice(null);
      this.#repo.useDevice(null);
      return;
    }

    const remembered = localStorage.getItem(LAST_DEVICE_KEY);
    const pick = devices.find((d) => d.id === remembered) || devices[0];
    this.#selectDevice(pick.id);
  }

  /** Switch the active device: detach the old subscriptions, attach the new. */
  #selectDevice(id) {
    if (!id || id === this.#state.activeDeviceId) return;
    logger.info(`switching to device ${id}`);

    this.#detachDevice();
    this.#state.resetDeviceData();
    this.#state.setActiveDevice(id);
    this.#repo.useDevice(id);
    try { localStorage.setItem(LAST_DEVICE_KEY, id); } catch { /* private mode */ }
    this.#attachDevice();
  }

  #detachDevice() {
    for (const unsub of this.#deviceUnsubs) {
      try { unsub(); } catch (e) { logger.warn('unsubscribe failed', e); }
    }
    this.#deviceUnsubs = [];
  }

  #attachDevice() {
    const state = this.#state;
    const repo = this.#repo;
    this.#deviceUnsubs = [
      repo.onSensor((sensor) => state.setSensor(sensor)),
      repo.onStatus((status) => state.setStatus(status)),
      repo.onHeartbeat((heartbeat) => state.setHeartbeat(heartbeat)),
      repo.onAuto((enabled) => state.setAutoEnabled(enabled)),
      repo.onSchedule((schedule) => state.setSchedule(schedule)),
      repo.onCommand((command) => state.setCommand(command)),
      repo.onHistory((points) => state.setHistory(points)),
      ...this.#views.settings.bind()
    ];
  }
}

new NightCoolApp().start();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => logger.debug('service worker registered'))
      .catch((error) => logger.warn('service worker registration failed', error));
  });
}

import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * Sign-in form, sign-out button, and the login/app screen swap.
 *
 * Persistence degrades gracefully: local storage first, then session storage,
 * then in-memory — iOS private browsing rejects the first two.
 */
export class AuthView {
  #auth;
  #i18n;
  #els;
  #onSignedIn;

  constructor(auth, i18n, { onSignedIn }) {
    this.#auth = auth;
    this.#i18n = i18n;
    this.#onSignedIn = onSignedIn;
    this.#els = {
      loginScreen: document.getElementById('loginScreen'),
      appScreen: document.getElementById('appScreen'),
      email: document.getElementById('email'),
      password: document.getElementById('password'),
      loginBtn: document.getElementById('loginBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      error: document.getElementById('loginError')
    };

    this.#els.loginBtn.addEventListener('click', () => this.#signIn());
    this.#els.password.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.#signIn();
    });
    this.#els.logoutBtn.addEventListener('click', () => signOut(this.#auth));
  }

  async start() {
    await this.#ensurePersistence();
    onAuthStateChanged(this.#auth, (user) => this.#onAuthChange(user));
  }

  /** Block sign-in and explain why when the Firebase config is incomplete. */
  disableWithConfigError() {
    this.#els.error.textContent = this.#i18n.t('firebaseConfigError');
    this.#els.loginBtn.disabled = true;
  }

  #onAuthChange(user) {
    const signedIn = !!user;
    this.#els.loginScreen.style.display = signedIn ? 'none' : 'flex';
    this.#els.appScreen.style.display = signedIn ? 'block' : 'none';
    if (signedIn) this.#onSignedIn();
  }

  async #ensurePersistence() {
    const strategies = [
      [browserLocalPersistence, 'local', null],
      [browserSessionPersistence, 'session', 'sessionPersistenceNote'],
      [inMemoryPersistence, 'in-memory', 'inMemoryPersistenceNote']
    ];

    for (const [persistence, label, noteKey] of strategies) {
      try {
        await setPersistence(this.#auth, persistence);
        console.log(`Auth persistence: ${label}`);
        if (noteKey) this.#els.error.textContent = this.#i18n.t(noteKey);
        return;
      } catch (error) {
        console.warn(`Auth persistence "${label}" unavailable`, error);
      }
    }
  }

  async #signIn() {
    const { loginBtn, error, email, password } = this.#els;
    error.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = this.#i18n.t('signingIn');

    try {
      await signInWithEmailAndPassword(this.#auth, email.value.trim(), password.value);
    } catch (err) {
      console.error(err);
      error.textContent = this.#i18n.t('signInError');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = this.#i18n.t('signInButton');
    }
  }
}

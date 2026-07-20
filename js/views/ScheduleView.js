import { TEMP_MIN_C, TEMP_MAX_C } from '../config.js';
import { clamp } from '../utils/time.js';

/**
 * Two-row night schedule editor.
 *
 * Rows are built once and then synced in place. The previous implementation
 * rebuilt the row markup on every change, which discarded the <input> the user
 * was interacting with; keeping the nodes stable avoids that entirely.
 *
 * Edits are local until "Save schedule" is pressed — `scheduleDirty` on the
 * state drives the badge that says so.
 */
export class ScheduleView {
  #state;
  #repo;
  #i18n;
  #els;
  #rows = [];

  constructor(state, repo, i18n) {
    this.#state = state;
    this.#repo = repo;
    this.#i18n = i18n;
    this.#els = {
      container: document.getElementById('scheduleRows'),
      badge: document.getElementById('scheduleSaveState'),
      note: document.getElementById('scheduleStatusNote'),
      saveBtn: document.getElementById('saveScheduleBtn'),
      flash: document.getElementById('schedSaveFlash')
    };

    this.#buildRows();
    this.#els.saveBtn.addEventListener('click', () => this.#save());
    this.#state.addEventListener('schedule', () => this.render());
    this.#state.addEventListener('scheduleDirty', () => this.renderSaveState());
    this.#i18n.onChange(() => this.renderSaveState());
  }

  /** Create one row per schedule block and wire its controls to the state. */
  #buildRows() {
    this.#els.container.innerHTML = '';
    this.#rows = this.#state.schedule.map((_, index) => {
      const row = document.createElement('div');
      row.className = 'sched-row';
      row.innerHTML = `
        <div class="sched-toggle">
          <input type="checkbox" class="schedEnable" aria-label="Enable schedule block ${index + 1}">
        </div>
        <div class="sched-times">
          <input type="time" class="schedStart" aria-label="Start time">
          <span class="sched-arrow">→</span>
          <input type="time" class="schedEnd" aria-label="End time">
        </div>
        <div class="sched-temp">
          <div class="stepper">
            <button type="button" class="schedTempDown" aria-label="Decrease target temperature">–</button>
            <span class="schedTempValue"></span>
            <button type="button" class="schedTempUp" aria-label="Increase target temperature">+</button>
          </div>
        </div>
      `;
      this.#els.container.appendChild(row);

      const refs = {
        row,
        enable: row.querySelector('.schedEnable'),
        start: row.querySelector('.schedStart'),
        end: row.querySelector('.schedEnd'),
        tempValue: row.querySelector('.schedTempValue'),
        tempUp: row.querySelector('.schedTempUp'),
        tempDown: row.querySelector('.schedTempDown')
      };

      refs.enable.addEventListener('change', (e) =>
        this.#state.updateScheduleBlock(index, { enabled: e.target.checked }));
      refs.start.addEventListener('change', (e) =>
        this.#state.updateScheduleBlock(index, { start: e.target.value }));
      refs.end.addEventListener('change', (e) =>
        this.#state.updateScheduleBlock(index, { end: e.target.value }));
      refs.tempUp.addEventListener('click', () => this.#stepTemp(index, +1));
      refs.tempDown.addEventListener('click', () => this.#stepTemp(index, -1));

      return refs;
    });
  }

  #stepTemp(index, delta) {
    const current = this.#state.schedule[index].targetTemp;
    this.#state.updateScheduleBlock(index, {
      targetTemp: clamp(current + delta, TEMP_MIN_C, TEMP_MAX_C)
    });
  }

  /** Push state values into the existing row nodes. */
  render() {
    this.#state.schedule.forEach((block, index) => {
      const refs = this.#rows[index];
      if (!refs) return;

      refs.row.classList.toggle('disabled', !block.enabled);
      refs.enable.checked = !!block.enabled;
      // Don't clobber a field the user is actively typing into.
      if (document.activeElement !== refs.start) refs.start.value = block.start;
      if (document.activeElement !== refs.end) refs.end.value = block.end;
      refs.tempValue.textContent = `${block.targetTemp}°`;
    });
  }

  renderSaveState() {
    const { badge, note } = this.#els;
    if (this.#state.scheduleDirty) {
      badge.textContent = this.#i18n.t('unsavedChanges');
      badge.className = 'status-badge unsaved';
      note.textContent = this.#i18n.t('scheduleUnsavedNote');
    } else {
      badge.textContent = this.#i18n.t('scheduleSaved');
      badge.className = 'status-badge saved';
      note.textContent = this.#i18n.t('scheduleSyncedNote');
    }
  }

  async #save() {
    const { saveBtn, flash } = this.#els;
    saveBtn.disabled = true;
    try {
      await this.#repo.saveSchedule(this.#state.schedule);
      this.#state.markScheduleSaved();
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), 1600);
    } catch (error) {
      // Leave the dirty badge up so the user knows the change didn't land.
      console.error('[Schedule] save failed', error);
    } finally {
      saveBtn.disabled = false;
    }
  }
}

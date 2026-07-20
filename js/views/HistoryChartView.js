import { formatDateTime } from '../utils/time.js';

const COLOR_ROOM = '#F2A65A';
const COLOR_SET = '#4FD1C5';
const COLOR_GRID = '#263353';
const COLOR_TICK = '#8B96B3';
const FONT_MONO = { family: "'JetBrains Mono', monospace", size: 10 };

/**
 * 24-hour room vs. target temperature chart, with cooling periods shaded.
 *
 * Chart.js and its moment adapter are loaded from CDN in index.html; if either
 * is unavailable the view degrades to doing nothing rather than throwing.
 */
export class HistoryChartView {
  #state;
  #i18n;
  #canvas;
  #detailsEl;
  #chart = null;
  #selectedIndex = null;

  constructor(state, i18n) {
    this.#state = state;
    this.#i18n = i18n;
    this.#canvas = document.getElementById('historyChart');
    this.#detailsEl = document.getElementById('historyDetails');

    this.#state.addEventListener('history', () => this.render());
    this.#i18n.onChange(() => this.#renderDetails());
  }

  render() {
    if (!this.#canvas || typeof Chart === 'undefined') return;

    const points = this.#state.history;
    const labels = points.map((p) => new Date(p.t));

    const data = {
      labels,
      datasets: [
        {
          label: 'Room temp (°C)',
          data: points.map((p) => p.temp),
          borderColor: COLOR_ROOM,
          backgroundColor: 'rgba(242,166,90,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHitRadius: 8,
          borderWidth: 2
        },
        {
          label: 'Set temp (°C)',
          data: points.map((p) => (Number.isFinite(p.setTemp) ? p.setTemp : null)),
          borderColor: COLOR_SET,
          backgroundColor: 'rgba(79,209,197,0.06)',
          fill: false,
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHitRadius: 8,
          borderWidth: 2,
          borderDash: [6, 4]
        }
      ]
    };

    if (this.#chart) {
      this.#chart.data = data;
      this.#chart.update();
    } else {
      this.#chart = new Chart(this.#canvas, {
        type: 'line',
        data,
        options: this.#options(),
        plugins: [this.#acOnShadingPlugin()]
      });
    }

    // Default the detail panel to the most recent sample.
    if (points.length) {
      this.#selectedIndex = Math.min(this.#selectedIndex ?? points.length - 1, points.length - 1);
      this.#renderDetails();
    }
  }

  #options() {
    return {
      responsive: true,
      animation: false,
      plugins: { legend: { display: false } },
      interaction: { mode: 'nearest', intersect: true },
      onClick: (_evt, activeEls) => {
        if (!activeEls.length) return;
        this.#selectedIndex = activeEls[0].index;
        this.#renderDetails();
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'hour' },
          ticks: { color: COLOR_TICK, font: FONT_MONO },
          grid: { color: COLOR_GRID }
        },
        y: {
          ticks: { color: COLOR_TICK, font: FONT_MONO },
          grid: { color: COLOR_GRID }
        }
      }
    };
  }

  /**
   * Shades the background over stretches where the AC was reported on, so the
   * effect of cooling on the room trace is visible at a glance.
   */
  #acOnShadingPlugin() {
    const getPoints = () => this.#state.history;
    return {
      id: 'acOnShading',
      beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        const points = getPoints();

        ctx.save();
        ctx.fillStyle = 'rgba(79,209,197,0.12)';
        let runStart = null;

        points.forEach((point, i) => {
          if (point.acOn && runStart === null) runStart = i;
          const isLast = i === points.length - 1;
          const runEnds = runStart !== null && (!point.acOn || isLast);
          if (!runEnds) return;

          const endIndex = point.acOn ? i : i - 1;
          if (endIndex >= runStart) {
            const x1 = scales.x.getPixelForValue(points[runStart].t);
            const x2 = scales.x.getPixelForValue(points[endIndex].t);
            ctx.fillRect(x1, chartArea.top, Math.max(1, x2 - x1), chartArea.bottom - chartArea.top);
          }
          runStart = null;
        });

        ctx.restore();
      }
    };
  }

  #renderDetails() {
    const point = this.#state.history[this.#selectedIndex];
    if (!this.#detailsEl || !point) return;

    const room = Number.isFinite(point.temp) ? `${point.temp.toFixed(1)}°C` : '--';
    const setTemp = Number.isFinite(point.setTemp) ? `${point.setTemp.toFixed(1)}°C` : '--';

    this.#detailsEl.innerHTML = `
      <strong>${formatDateTime(point.t)}</strong><br>
      ${this.#i18n.t('roomTempLabel')}: <strong>${room}</strong><br>
      ${this.#i18n.t('setTempLabel')}: <strong>${setTemp}</strong>`;
  }
}

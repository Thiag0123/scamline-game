import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let total = 0;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    total = 0;
    container.innerHTML = `<p class="hint">Preparando a máquina...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "casino-start") {
      container.innerHTML = `
        <p style="font-size:2.5rem;">🎰</p>
        <p>Total acumulado: <b id="casino-total">0</b></p>
        <button id="pull-btn" style="width:100%; height:60px; font-size:1.2rem;">🎲 Puxar a alavanca</button>
        <div id="pull-log" style="text-align:left; margin-top:10px; max-height:120px; overflow-y:auto;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      container.querySelector("#pull-btn").addEventListener("click", () => {
        sendActionRef({ type: "pull-lever" });
      });

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
        if (s <= 0) {
          const btn = container.querySelector("#pull-btn");
          if (btn) btn.disabled = true;
        }
      });
    } else if (payload.type === "pull-result") {
      total = payload.total;
      const totalEl = container.querySelector("#casino-total");
      if (totalEl) totalEl.textContent = total;
      const log = container.querySelector("#pull-log");
      if (log) {
        const div = document.createElement("div");
        const icon = payload.outcome === "positive" ? "🟢 +1" : payload.outcome === "negative" ? "🔴 -1" : "⚪ 0";
        div.textContent = icon;
        log.prepend(div);
      }
    } else if (payload.type === "casino-result") {
      clearCountdown();
      const rows = payload.results.map((r) => `<li>${escapeHtml(r.name)}: ${r.total >= 0 ? "+" : ""}${r.total}</li>`).join("");
      container.innerHTML = `<p>Resultado de todos:</p><ul style="text-align:left;">${rows}</ul>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    total = 0;
  },
};

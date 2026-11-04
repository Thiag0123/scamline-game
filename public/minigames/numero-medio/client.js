import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "number-prompt") {
      container.innerHTML = `
        <p>Escreva qualquer número, sem limite. Quem ficar no meio de todos (mediana) ganha 1 ponto.</p>
        <input id="number-input" type="number" placeholder="Seu número" style="width:100%; font-size:1.3rem; text-align:center;" />
        <button id="number-submit" style="margin-top:10px; width:100%;">Confirmar</button>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let submitted = false;
      const doSubmit = () => {
        if (submitted) return;
        const val = container.querySelector("#number-input").value;
        if (val === "") return;
        submitted = true;
        sendActionRef({ type: "submit-number", number: Number(val) });
        container.querySelector("#number-submit").disabled = true;
        container.querySelector("#number-submit").textContent = "Enviado!";
      };
      container.querySelector("#number-submit").addEventListener("click", doSubmit);

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
        if (s <= 0) doSubmit();
      });
    } else if (payload.type === "number-result") {
      clearCountdown();
      const sorted = payload.numbers.slice().sort((a, b) => a.number - b.number);
      const rows = sorted.map((n) => `<li>${escapeHtml(n.name)}: ${n.number}</li>`).join("");
      container.innerHTML = `<p>Números (do menor pro maior):</p><ul style="text-align:left;">${rows}</ul>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

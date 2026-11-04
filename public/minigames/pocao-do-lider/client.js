import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando as poções...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "choice-prompt") {
      container.innerHTML = `
        <p>🧪 Você recebeu uma poção de arremesso. Se usar, normalmente vale +1 ponto...</p>
        <p class="hint">Mas cuidado: a poção de quem está em 1º lugar está envenenada (se houver empate no topo, todos os líderes empatados estão envenenados).</p>
        <button id="use-btn" style="width:100%;">Usar a poção</button>
        <button id="skip-btn" style="width:100%;">Não usar</button>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let submitted = false;
      const submit = (use) => {
        if (submitted) return;
        submitted = true;
        sendActionRef({ type: "submit-choice", use });
        container.querySelectorAll("button").forEach((b) => (b.disabled = true));
      };
      container.querySelector("#use-btn").addEventListener("click", () => submit(true));
      container.querySelector("#skip-btn").addEventListener("click", () => submit(false));

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "result") {
      clearCountdown();
      const rows = payload.results
        .map(
          (r) =>
            `<li>${escapeHtml(r.name)}: ${r.poisoned ? "😱 estava envenenada! -1" : "✅ segura! +1"}</li>`
        )
        .join("");
      container.innerHTML = `
        <p>O(s) líder(es) era(m): <b>${escapeHtml((payload.leaderNames || []).join(", "))}</b></p>
        <ul style="text-align:left;">${rows || "<li>Ninguém usou a poção.</li>"}</ul>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

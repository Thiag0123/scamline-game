import { startCountdown, clearCountdown, escapeHtml, renderPlayerButtonList } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Sorteando quem vai sair...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "actor-prompt") {
      container.innerHTML = `
        <p>🌸 Você pode sair e levar uma flor a alguém (+1 ponto pra quem receber). <b>É obrigatório escolher</b> — se não escolher a tempo, você perde 1 ponto.</p>
        <div id="target-list" style="text-align:left;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      const list = container.querySelector("#target-list");
      renderPlayerButtonList(list, payload.players, (p) => {
        sendActionRef({ type: "pick-target", targetId: p.id });
      });

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "waiting") {
      container.innerHTML = `
        <p>🌸 <b>${escapeHtml(payload.actorName)}</b> saiu levando uma flor. Aguarde...</p>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "result") {
      clearCountdown();
      container.innerHTML = payload.targetName
        ? `<p>🌸 <b>${escapeHtml(payload.actorName)}</b> deu a flor pra <b>${escapeHtml(payload.targetName)}</b>! +1 ponto.</p>`
        : `<p><b>${escapeHtml(payload.actorName)}</b> não escolheu a tempo e perdeu 1 ponto.</p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

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
        <p>Você pode sair e tirar 1 ponto de alguém. <b>É obrigatório escolher</b> — se não escolher a tempo, você perde o ponto.</p>
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
        <p><b>${escapeHtml(payload.actorName)}</b> está decidindo se sai e tira ponto de alguém...</p>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "result") {
      clearCountdown();
      container.innerHTML = payload.targetName
        ? `<p><b>${escapeHtml(payload.actorName)}</b> saiu e tirou 1 ponto de <b>${escapeHtml(payload.targetName)}</b>.</p>`
        : payload.timedOut
        ? `<p><b>${escapeHtml(payload.actorName)}</b> não escolheu a tempo e perdeu 1 ponto.</p>`
        : `<p><b>${escapeHtml(payload.actorName)}</b> decidiu não fazer nada.</p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

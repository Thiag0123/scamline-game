import { startCountdown, clearCountdown, escapeHtml, renderPlayerButtonList } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Sorteando quem começa com a TNT...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "your-turn") {
      container.innerHTML = `
        <p style="font-size:1.3rem;">🧨 Você está com a TNT!</p>
        <p>Chance de explodir se tentar desarmar agora: <b>${payload.explodeChance}%</b></p>
        ${payload.isLastChance ? `<p style="color:#ff8080;">Última chance — se não agir, você vai ser forçado a desarmar!</p>` : ""}
        <button id="defuse-btn" style="width:100%; background:#ff8080;">💣 Tentar desarmar</button>
        <p class="hint" style="margin:10px 0 4px;">Ou passe pra alguém:</p>
        <div id="pass-list" style="text-align:left;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let acted = false;
      container.querySelector("#defuse-btn").addEventListener("click", () => {
        if (acted) return;
        acted = true;
        sendActionRef({ type: "defuse" });
      });
      renderPlayerButtonList(container.querySelector("#pass-list"), payload.players, (p) => {
        if (acted) return;
        acted = true;
        sendActionRef({ type: "pass", targetId: p.id });
      });

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "waiting-turn") {
      container.innerHTML = `
        <p><b>${escapeHtml(payload.holderName)}</b> está com a TNT (chance de explosão: ${payload.explodeChance}%).</p>
        <p class="hint">Decidindo se desarma ou passa...</p>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "passed") {
      clearCountdown();
      const p = document.createElement("p");
      p.innerHTML = `🧨 A TNT foi passada pra <b>${escapeHtml(payload.holderName)}</b> (chance de explosão agora: ${payload.explodeChance}%).`;
      container.prepend(p);
    } else if (payload.type === "result") {
      clearCountdown();
      container.innerHTML = payload.success
        ? `<p style="font-size:1.3rem;">✅ <b>${escapeHtml(payload.holderName)}</b> desarmou a TNT com sucesso! +1 ponto.</p>`
        : `<p style="font-size:1.3rem;">💥 A TNT explodiu nas mãos de <b>${escapeHtml(payload.holderName)}</b>!</p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

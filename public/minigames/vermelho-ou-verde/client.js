import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Sorteando as duplas...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "pair-start") {
      container.innerHTML = `
        <p>Sua dupla: <b>${escapeHtml(payload.partnerName)}</b></p>
        <p class="hint">Vermelho+Vermelho: 1 cada. Verde+Verde: 3 cada. Diferente: quem apertou vermelho ganha 5, quem apertou verde não ganha nada. Dá pra trocar de escolha até o tempo acabar.</p>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button id="btn-green" style="flex:1; height:70px; background:#3ddc3d; font-size:1.1rem;">VERDE</button>
          <button id="btn-red" style="flex:1; height:70px; background:#ff4d4d; font-size:1.1rem;">VERMELHO</button>
        </div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let currentChoice = null;
      const press = (color) => {
        currentChoice = color;
        sendActionRef({ type: "press-button", color });
        const greenBtn = container.querySelector("#btn-green");
        const redBtn = container.querySelector("#btn-red");
        greenBtn.style.outline = color === "green" ? "3px solid white" : "none";
        redBtn.style.outline = color === "red" ? "3px solid white" : "none";
      };
      container.querySelector("#btn-green").addEventListener("click", () => press("green"));
      container.querySelector("#btn-red").addEventListener("click", () => press("red"));

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "bye-round") {
      container.innerHTML = `<p class="hint">Você está de folga nessa rodada. Aguarde...</p>`;
      startCountdown(payload.durationMs, (s) => {});
    } else if (payload.type === "pair-result") {
      clearCountdown();
      const yourLabel = payload.yourChoice === "green" ? "🟢 Verde" : "🔴 Vermelho";
      const theirLabel = payload.theirChoice === "green" ? "🟢 Verde" : "🔴 Vermelho";
      container.innerHTML = `
        <p>Você: ${yourLabel} · Dupla: ${theirLabel}</p>
        <p style="font-size:1.3rem;">Você marcou <b>${payload.yourScore}</b> ponto(s) nessa dupla.</p>
      `;
    } else if (payload.type === "final-reveal") {
      clearCountdown();
      const rows = payload.scores
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((s) => `<li>${escapeHtml(s.name)}: ${s.score} pontos acumulados</li>`)
        .join("");
      container.innerHTML = `
        <p>Placar final acumulado:</p>
        <ul style="text-align:left;">${rows}</ul>
        <p>🏆 Ganharam 1 ponto: <b>${escapeHtml((payload.winnerNames || []).join(", "))}</b></p>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;
let takenPotions = new Set(); // índices já bebidos (removidos da mesa)

function renderGrid(container, remainingPotions, totalPotions, clickable) {
  const grid = document.createElement("div");
  grid.style.cssText = "display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0;";
  for (let i = 0; i < totalPotions; i++) {
    const cell = document.createElement("div");
    const isTaken = !remainingPotions.includes(i);
    cell.style.cssText = `
      aspect-ratio:1; border-radius:8px; display:flex; align-items:center; justify-content:center;
      font-size:1.3rem; background:${isTaken ? "#0a0a12" : "#2a2a3d"}; opacity:${isTaken ? "0.3" : "1"};
      cursor:${clickable && !isTaken ? "pointer" : "default"};
    `;
    cell.textContent = "🧪";
    if (clickable && !isTaken) {
      cell.addEventListener("click", () => {
        sendActionRef({ type: "drink-potion", potionIndex: i });
        grid.querySelectorAll("div").forEach((c) => (c.style.cursor = "default"));
      });
    }
    grid.appendChild(cell);
  }
  return grid;
}

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando as poções...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "turn-start") {
      const isMyTurn = payload.currentPlayerId === myIdRef;
      container.innerHTML = "";
      const p = document.createElement("p");
      p.innerHTML = isMyTurn
        ? `🧪 <b>É a sua vez!</b> Clique na poção que quer beber.`
        : `🧪 Vez de <b>${escapeHtml(payload.currentPlayerName)}</b> escolher uma poção...`;
      container.appendChild(p);
      container.appendChild(renderGrid(container, payload.remainingPotions, payload.totalPotions, isMyTurn));
      const timerP = document.createElement("p");
      timerP.id = "phase-timer";
      timerP.className = "hint";
      container.appendChild(timerP);

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "potion-result") {
      clearCountdown();
      const msg = document.createElement("p");
      msg.style.fontSize = "1.1rem";
      msg.innerHTML = payload.poisoned
        ? `☠️ <b>${escapeHtml(payload.playerName)}</b> bebeu o VENENO!`
        : `✅ ${escapeHtml(payload.playerName)} bebeu uma poção segura.`;
      container.prepend(msg);
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    takenPotions = new Set();
  },
};

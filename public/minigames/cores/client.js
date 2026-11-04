import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

const COLOR_HEX = {
  Vermelho: "#ff5e5e",
  Azul: "#4d88ff",
  Verde: "#4dff88",
  Amarelo: "#ffd24d",
  Roxo: "#8a4dff",
  Laranja: "#ff9a4d",
};

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando os espaços...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "color-prompt") {
      container.innerHTML = `
        <p>Escolha um espaço colorido. Maioria ganha ponto, minoria não ganha nada. Todo mundo igual = todos perdem!</p>
        <div id="color-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:12px 0;"></div>
        <p id="phase-timer" class="hint"></p>
      `;
      const grid = container.querySelector("#color-grid");
      let chosen = false;
      payload.colors.forEach((color) => {
        const cell = document.createElement("div");
        cell.textContent = color;
        cell.style.cssText = `
          background:${COLOR_HEX[color] || "#666"}; border-radius:8px; padding:16px 4px; text-align:center;
          cursor:pointer; color:#14141f; font-weight:bold; font-size:0.85rem;
        `;
        cell.addEventListener("click", () => {
          if (chosen) return;
          chosen = true;
          sendActionRef({ type: "choose-color", color });
          grid.querySelectorAll("div").forEach((c) => (c.style.outline = "none"));
          cell.style.outline = "4px solid white";
        });
        grid.appendChild(cell);
      });

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "color-result") {
      clearCountdown();
      const rows = payload.choices
        .map((c) => `<li>${escapeHtml(c.name)}: <b style="color:${COLOR_HEX[c.color] || "#fff"}">${c.color}</b></li>`)
        .join("");
      container.innerHTML = `<p>Escolhas de todos:</p><ul style="text-align:left;">${rows}</ul>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

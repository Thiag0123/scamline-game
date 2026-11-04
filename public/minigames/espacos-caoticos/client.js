import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando as plataformas...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "choose-platform-start") {
      const stillAlive = payload.alive.includes(myIdRef);
      container.innerHTML = stillAlive
        ? `<p>Escolha uma plataforma em segredo. A bomba explode onde tiver mais gente!</p>
           <div id="platform-grid" style="display:grid; grid-template-columns:repeat(5,1fr); gap:5px; margin:10px 0;"></div>
           <p id="phase-timer" class="hint"></p>`
        : `<p class="hint">Você já foi eliminado. Assistindo o resto da rodada...</p>`;

      if (stillAlive) {
        const grid = container.querySelector("#platform-grid");
        let chosen = false;
        payload.platforms.forEach((n) => {
          const cell = document.createElement("div");
          cell.textContent = n;
          cell.style.cssText =
            "aspect-ratio:1; background:#2a2a3d; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.85rem;";
          cell.addEventListener("click", () => {
            if (chosen) return;
            chosen = true;
            sendActionRef({ type: "choose-platform", platform: n });
            grid.querySelectorAll("div").forEach((c) => (c.style.cursor = "default"));
            cell.style.background = "var(--mg-accent)";
          });
          grid.appendChild(cell);
        });

        startCountdown(payload.durationMs, (s) => {
          const el = container.querySelector("#phase-timer");
          if (el) el.textContent = `⏱ ${s}s`;
        });
      }
    } else if (payload.type === "bomb-result") {
      clearCountdown();
      const msg = document.createElement("p");
      msg.style.fontSize = "1.1rem";
      msg.innerHTML = payload.noOneHit
        ? `💣 A bomba explodiu na plataforma <b>${payload.bombedPlatform}</b> — mas todo mundo escolheu lugares diferentes, ninguém foi atingido! A plataforma saiu de jogo.`
        : payload.hitNames.length
        ? `💣 A bomba explodiu na plataforma <b>${payload.bombedPlatform}</b>! Eliminados: <b>${escapeHtml(payload.hitNames.join(", "))}</b>.`
        : `💣 A bomba explodiu na plataforma <b>${payload.bombedPlatform}</b>, mas ninguém estava lá.`;
      container.prepend(msg);
    } else if (payload.type === "final-reveal") {
      clearCountdown();
      container.innerHTML = payload.winnerName
        ? `<p>🏆 <b>${escapeHtml(payload.winnerName)}</b> sobreviveu e ganhou 1 ponto!</p>`
        : `<p>Ninguém sobreviveu.</p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    myIdRef = null;
  },
};

import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Distribuindo os naipes...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "symbols-start") {
      const othersHtml = payload.others
        .map((o) => `<li>${window.__avatarImgHtml ? window.__avatarImgHtml(o.id, 28) : ""} ${escapeHtml(o.name)}: <b style="font-size:1.3rem;">${o.suit}</b></li>`)
        .join("");
      container.innerHTML = `
        <p>Naipes dos outros:</p>
        <ul style="text-align:left;">${othersHtml}</ul>
        <p>Qual é o SEU naipe?</p>
        <div id="suit-options" style="display:flex; gap:8px; justify-content:center;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      const optionsDiv = container.querySelector("#suit-options");
      let submitted = false;
      payload.options.forEach((suit) => {
        const btn = document.createElement("button");
        btn.textContent = suit;
        btn.style.fontSize = "1.5rem";
        btn.style.flex = "1";
        btn.addEventListener("click", () => {
          if (submitted) return;
          submitted = true;
          sendActionRef({ type: "submit-guess", suit });
          optionsDiv.querySelectorAll("button").forEach((b) => (b.disabled = true));
          btn.style.outline = "3px solid var(--mg-accent)";
        });
        optionsDiv.appendChild(btn);
      });

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "symbols-reveal") {
      clearCountdown();
      const rows = payload.reveal
        .map((r) => `<li>${escapeHtml(r.name)}: <b style="font-size:1.2rem;">${r.suit}</b></li>`)
        .join("");
      container.innerHTML = `<p>Naipe de cada um:</p><ul style="text-align:left;">${rows}</ul>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

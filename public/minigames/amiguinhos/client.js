import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";
import { createMultiChatUI } from "/js/multichat-ui.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;
let chatUI = null;

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando o quadro...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "session-start") {
      const others = payload.players.filter((p) => p.id !== myIdRef);
      container.innerHTML = `
        <p>Escolha um jogador no quadro. Se alguém escolher você, você ganha 1 ponto.</p>
        <p>Sua escolha atual: <b id="current-choice-label">nenhuma ainda</b></p>
        <div id="choice-buttons" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;"></div>
        <div id="chat-container"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;

      const label = container.querySelector("#current-choice-label");
      const buttons = container.querySelector("#choice-buttons");
      others.forEach((p) => {
        const avatarHtml = window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 30) : "";
        const btn = document.createElement("button");
        btn.innerHTML = `${avatarHtml} ${escapeHtml(p.name)}`;
        btn.style.margin = "0";
        btn.addEventListener("click", () => {
          sendActionRef({ type: "choose", targetId: p.id });
          label.innerHTML = `${avatarHtml} ${escapeHtml(p.name)}`;
          buttons.querySelectorAll("button").forEach((b) => (b.style.outline = "none"));
          btn.style.outline = "3px solid var(--mg-accent)";
        });
        buttons.appendChild(btn);
      });

      const contacts = others.map((p) => ({
        id: p.id,
        labelHtml: `${window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 28) : ""} ${escapeHtml(p.name)}`,
      }));
      chatUI = createMultiChatUI({
        container: container.querySelector("#chat-container"),
        contacts,
        onSend: (targetId, text) => sendActionRef({ type: "chat-message", targetId, text }),
      });

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s (dá pra mudar de escolha até acabar)`;
      });
    } else if (payload.type === "chat-message") {
      chatUI?.receiveMessage(payload.fromId, payload.fromName, payload.text);
    } else if (payload.type === "reveal") {
      clearCountdown();
      const rows = payload.choices.map((c) => `<li>${escapeHtml(c.voterName)} escolheu ${escapeHtml(c.targetName)}</li>`).join("");
      container.innerHTML = `
        <p>Quem escolheu quem:</p>
        <ul style="text-align:left;">${rows}</ul>
        <p>🎉 Ganharam ponto: <b>${escapeHtml((payload.chosenNames || []).join(", ") || "ninguém")}</b></p>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    chatUI = null;
  },
};

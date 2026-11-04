import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";
import { createMultiChatUI } from "/js/multichat-ui.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;
let chatUI = null;
let currentVote = null;

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Sorteando quem tem a máscara...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "session-start") {
      const others = payload.players.filter((p) => p.id !== myIdRef);
      const allForVote = payload.players; // pode votar em qualquer um, inclusive si mesmo

      container.innerHTML = `
        <p style="font-size:1.1rem;">🎭 <b>Alguém nesta sala tem a máscara diferente</b> — pode ser qualquer um, inclusive você mesmo. Ninguém sabe quem é!</p>
        <p class="hint">Seu voto atual: <b id="current-vote-label">ninguém ainda</b></p>
        <div id="vote-buttons" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;"></div>
        <div id="chat-container"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;

      const voteButtons = container.querySelector("#vote-buttons");
      allForVote.forEach((p) => {
        const avatarHtml = window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 28) : "";
        const btn = document.createElement("button");
        btn.innerHTML = `${avatarHtml} ${escapeHtml(p.name)}${p.id === myIdRef ? " (você)" : ""}`;
        btn.style.margin = "0";
        btn.addEventListener("click", () => {
          currentVote = p.id;
          sendActionRef({ type: "vote", targetId: p.id });
          container.querySelector("#current-vote-label").innerHTML = `${avatarHtml} ${escapeHtml(p.name)}${p.id === myIdRef ? " (você)" : ""}`;
          voteButtons.querySelectorAll("button").forEach((b) => (b.style.outline = "none"));
          btn.style.outline = "3px solid var(--mg-accent)";
        });
        voteButtons.appendChild(btn);
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
        if (el) el.textContent = `⏱ ${s}s (voto pode mudar até acabar)`;
      });
    } else if (payload.type === "chat-message") {
      chatUI?.receiveMessage(payload.fromId, payload.fromName, payload.text);
    } else if (payload.type === "reveal") {
      clearCountdown();
      container.innerHTML = `<p>A máscara diferente era de: <b>${escapeHtml(payload.chosenName || "?")}</b></p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    chatUI = null;
    currentVote = null;
  },
};

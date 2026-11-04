import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";
import { createMultiChatUI } from "/js/multichat-ui.js";

let els = {};
let sendActionRef = null;
let chatUI = null;
let currentGuesses = {};

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    currentGuesses = {};
    container.innerHTML = `<p class="hint">Sorteando as salas...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "session-start") {
      const roomNumbers = Array.from({ length: payload.numRooms }, (_, i) => i + 1).filter(
        (n) => n !== payload.yourRoom
      );

      container.innerHTML = `
        <p class="hint">Sua sala: <b>${payload.yourRoom}</b></p>
        <div id="chat-container"></div>
        <p class="hint" style="margin:10px 0 4px;">Seus palpites (pode mudar quando quiser — vale o que estiver marcado no fim):</p>
        <div id="guess-list" style="text-align:left;"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;

      // Chat: contatos são os NÚMEROS das salas (exceto a própria)
      const contacts = roomNumbers.map((n) => ({ id: String(n), label: `Sala ${n}` }));
      chatUI = createMultiChatUI({
        container: container.querySelector("#chat-container"),
        contacts,
        onSend: (contactId, text) => sendActionRef({ type: "chat-message", toRoom: Number(contactId), text }),
      });

      // Painel de palpites: pra cada jogador (nome real), escolher a sala
      const guessList = container.querySelector("#guess-list");
      const options = Array.from({ length: payload.numRooms }, (_, i) => i + 1)
        .map((n) => `<option value="${n}">Sala ${n}</option>`)
        .join("");
      payload.players.forEach((p) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin:6px 0;";
        const avatar = window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 28) : "";
        row.innerHTML = `
          <span>${avatar} ${escapeHtml(p.name)}</span>
          <select data-player-id="${p.id}"><option value="">?</option>${options}</select>
        `;
        const sel = row.querySelector("select");
        sel.addEventListener("change", () => {
          currentGuesses[p.id] = Number(sel.value) || null;
          sendActionRef({ type: "submit-guess", guesses: currentGuesses });
        });
        guessList.appendChild(row);
      });

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "chat-message") {
      chatUI?.receiveMessage(String(payload.fromRoom), `Sala ${payload.fromRoom}`, payload.text);
    } else if (payload.type === "reveal") {
      clearCountdown();
      const rows = payload.rooms.map((r) => `<li>${escapeHtml(r.name)}: Sala ${r.room}</li>`).join("");
      container.innerHTML = `
        <p>Onde cada um estava de verdade:</p>
        <ul style="text-align:left;">${rows}</ul>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    chatUI = null;
    currentGuesses = {};
    sendActionRef = null;
  },
};

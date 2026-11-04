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
    container.innerHTML = `<p class="hint">Preparando...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "session-start") {
      container.innerHTML = `
        <p>Escreva uma palavra livre — tente combinar com os outros (converse pra descobrir o que eles vão escrever).</p>
        <input id="word-input" type="text" placeholder="Sua palavra..." maxlength="40" style="width:100%;" />
        <p class="hint">Pode mudar quantas vezes quiser até o tempo acabar.</p>
        <div id="chat-container"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;
      const input = container.querySelector("#word-input");
      input.addEventListener("input", () => {
        sendActionRef({ type: "submit-word", word: input.value });
      });

      const others = payload.players.filter((p) => p.id !== myIdRef);
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
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "chat-message") {
      chatUI?.receiveMessage(payload.fromId, payload.fromName, payload.text);
    } else if (payload.type === "word-result") {
      clearCountdown();
      const rows = payload.words.map((w) => `<li>${escapeHtml(w.name)}: <b>${escapeHtml(w.word)}</b></li>`).join("");
      container.innerHTML = `<p>Palavras de todos:</p><ul style="text-align:left;">${rows}</ul>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    chatUI = null;
    sendActionRef = null;
  },
};

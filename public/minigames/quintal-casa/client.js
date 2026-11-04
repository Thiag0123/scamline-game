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
        <p class="hint">Se PAR no quintal: quintal -1, casa +1. Se ÍMPAR: quintal +1, casa -1.</p>
        <p>Sua escolha atual: <b id="current-choice-label">nenhuma ainda</b></p>
        <div style="display:flex; gap:10px; margin-bottom:10px;">
          <button id="btn-quintal" style="flex:1; height:60px;">🌳 Quintal</button>
          <button id="btn-casa" style="flex:1; height:60px;">🏠 Casa</button>
        </div>
        <div id="chat-container"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;
      const label = container.querySelector("#current-choice-label");
      const choose = (place) => {
        sendActionRef({ type: "choose", place });
        label.textContent = place === "quintal" ? "🌳 Quintal" : "🏠 Casa";
      };
      container.querySelector("#btn-quintal").addEventListener("click", () => choose("quintal"));
      container.querySelector("#btn-casa").addEventListener("click", () => choose("casa"));

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
        if (el) el.textContent = `⏱ ${s}s (dá pra mudar de ideia até acabar)`;
      });
    } else if (payload.type === "chat-message") {
      chatUI?.receiveMessage(payload.fromId, payload.fromName, payload.text);
    } else if (payload.type === "choice-reveal") {
      clearCountdown();
      const quintalList = payload.results.filter((r) => r.place === "quintal");
      const casaList = payload.results.filter((r) => r.place === "casa");
      const parityLabel = payload.quintalIsEven ? "PAR" : "ÍMPAR";
      container.innerHTML = `
        <p>Número no quintal: <b>${payload.quintalCount} (${parityLabel})</b></p>
        <div style="display:flex; gap:10px; text-align:left;">
          <div style="flex:1;">
            <p><b>🌳 Quintal</b> (${payload.quintalIsEven ? "-1" : "+1"})</p>
            <ul>${quintalList.map((p) => `<li>${escapeHtml(p.name)}</li>`).join("") || "<li>ninguém</li>"}</ul>
          </div>
          <div style="flex:1;">
            <p><b>🏠 Casa</b> (${payload.quintalIsEven ? "+1" : "-1"})</p>
            <ul>${casaList.map((p) => `<li>${escapeHtml(p.name)}</li>`).join("") || "<li>ninguém</li>"}</ul>
          </div>
        </div>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    chatUI = null;
    sendActionRef = null;
  },
};

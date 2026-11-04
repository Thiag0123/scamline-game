import { startCountdown, clearCountdown, escapeHtml, renderPlayerButtonList } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;
let myWord = null;
let turnLog = [];

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Recebendo sua palavra secreta...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "your-word") {
      myWord = payload.word;
      turnLog = [];
    } else if (payload.type === "turn-start") {
      const isMyTurn = payload.currentPlayerId === myIdRef;
      const logHtml = turnLog.map((t) => `<div>${t}</div>`).join("");
      container.innerHTML = `
        <p class="hint">Rodada ${payload.round}/${payload.totalRounds} · Sua palavra: <b>${escapeHtml(myWord)}</b></p>
        <p>${escapeHtml(payload.prompt)}</p>
        <div id="turn-log" style="text-align:left; max-height:120px; overflow-y:auto; margin-bottom:8px;">${logHtml}</div>
        ${
          isMyTurn
            ? `<input id="turn-input" type="text" placeholder="Sua resposta..." maxlength="150" style="width:100%;" />
               <button id="turn-submit" style="margin-top:8px; width:100%;">Responder</button>`
            : `<p class="hint">É a vez de <b>${escapeHtml(payload.currentPlayerName)}</b> responder...</p>`
        }
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      if (isMyTurn) {
        let submitted = false;
        const doSubmit = () => {
          if (submitted) return;
          const text = container.querySelector("#turn-input").value.trim();
          if (!text) return;
          submitted = true;
          sendActionRef({ type: "submit-turn-answer", text });
          container.querySelector("#turn-submit").disabled = true;
        };
        container.querySelector("#turn-submit").addEventListener("click", doSubmit);
      }
      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "turn-answer") {
      turnLog.push(`<b>${escapeHtml(payload.playerName)}:</b> ${escapeHtml(payload.text)}`);
      const log = container.querySelector("#turn-log");
      if (log) log.innerHTML = turnLog.map((t) => `<div>${t}</div>`).join("");
    } else if (payload.type === "voting-start") {
      clearCountdown();
      container.innerHTML = `
        <p>Quem você acha que tem a palavra diferente?</p>
        <div id="vote-list" style="text-align:left;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      renderPlayerButtonList(
        container.querySelector("#vote-list"),
        payload.players,
        (p) => sendActionRef({ type: "vote", targetId: p.id })
      );
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "reveal") {
      clearCountdown();
      container.innerHTML = `
        <p>O impostor era: <b>${escapeHtml(payload.impostorName)}</b></p>
        <p class="hint">Palavra da maioria: ${escapeHtml(payload.mainWord)} · Palavra do impostor: ${escapeHtml(payload.altWord)}</p>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    myWord = null;
    turnLog = [];
  },
};

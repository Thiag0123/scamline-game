import { startCountdown, clearCountdown, escapeHtml, renderPlayerButtonList } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando as perguntas...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "question-prompt") {
      container.innerHTML = `
        <p><b>${escapeHtml(payload.question)}</b></p>
        <input id="answer-input" type="text" placeholder="Sua resposta..." maxlength="150" style="width:100%;" />
        <button id="answer-submit" style="margin-top:10px; width:100%;">Responder</button>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let submitted = false;
      const doSubmit = () => {
        if (submitted) return;
        const text = container.querySelector("#answer-input").value.trim();
        if (!text) return;
        submitted = true;
        sendActionRef({ type: "submit-answer", text });
        container.querySelector("#answer-submit").disabled = true;
        container.querySelector("#answer-submit").textContent = "Enviado!";
      };
      container.querySelector("#answer-submit").addEventListener("click", doSubmit);

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "answers-reveal") {
      clearCountdown();
      const rows = payload.answers.map((a) => `<li><b>${escapeHtml(a.name)}:</b> ${escapeHtml(a.answer)}</li>`).join("");
      container.innerHTML = `
        <p class="hint">A maioria recebeu: "${escapeHtml(payload.mainQuestion)}"</p>
        <p>Respostas de todos — alguém tinha uma pergunta diferente. Quem será?</p>
        <ul style="text-align:left;">${rows}</ul>
        <p>Vote em quem você acha que é o impostor:</p>
        <div id="vote-list" style="text-align:left;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      renderPlayerButtonList(
        container.querySelector("#vote-list"),
        payload.answers.map((a) => ({ id: a.id, name: a.name })),
        (p) => sendActionRef({ type: "vote", targetId: p.id })
      );
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "impostor-reveal") {
      clearCountdown();
      container.innerHTML = `
        <p>O impostor era: <b>${escapeHtml(payload.impostorName)}</b></p>
        <p class="hint">A pergunta diferente era: "${escapeHtml(payload.altQuestion)}"</p>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

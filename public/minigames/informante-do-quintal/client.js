import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Sorteando o informante...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "inform-prompt") {
      container.innerHTML = `
        <p>🤫 Você sabe a verdade: <b>${payload.truth ? "PODE" : "NÃO PODE"} sair no quintal.</b></p>
        <p>Faça uma declaração pública. Você pode falar a verdade ou mentir:</p>
        <button id="say-true" style="width:100%;">Dizer: "Pode sair no quintal"</button>
        <button id="say-false" style="width:100%;">Dizer: "Não pode sair no quintal"</button>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let submitted = false;
      const submit = (claim) => {
        if (submitted) return;
        submitted = true;
        sendActionRef({ type: "submit-statement", claim });
      };
      container.querySelector("#say-true").addEventListener("click", () => submit(true));
      container.querySelector("#say-false").addEventListener("click", () => submit(false));

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "waiting-informant") {
      container.innerHTML = `
        <p><b>${escapeHtml(payload.informedName)}</b> sabe a verdade e vai fazer uma declaração...</p>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "statement-announced") {
      clearCountdown();
      container.innerHTML = `
        <p><b>${escapeHtml(payload.informedName)}</b> disse: "${payload.claim ? "Pode sair no quintal" : "Não pode sair no quintal"}"</p>
        <p class="hint">Preparando a decisão...</p>
      `;
    } else if (payload.type === "decide-start") {
      clearCountdown();
      container.innerHTML = `
        <p>Em quem você acredita? O que você acha que é verdade?</p>
        <button id="believe-true" style="width:100%;">Acho que PODE sair no quintal</button>
        <button id="believe-false" style="width:100%;">Acho que NÃO PODE sair no quintal</button>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      let submitted = false;
      const submit = (belief) => {
        if (submitted) return;
        submitted = true;
        sendActionRef({ type: "submit-belief", belief });
        container.querySelectorAll("button").forEach((b) => (b.disabled = true));
      };
      const trueBtn = container.querySelector("#believe-true");
      const falseBtn = container.querySelector("#believe-false");
      if (trueBtn) trueBtn.addEventListener("click", () => submit(true));
      if (falseBtn) falseBtn.addEventListener("click", () => submit(false));

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "decide-wait") {
      clearCountdown();
      container.innerHTML = `
        <p>Os outros estão decidindo em quem confiar...</p>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "reveal") {
      clearCountdown();
      container.innerHTML = `
        <p>A verdade era: <b>${payload.truth ? "PODE" : "NÃO PODE"} sair no quintal.</b></p>
        <p><b>${escapeHtml(payload.informedName)}</b> tinha dito: "${payload.claim ? "Pode" : "Não pode"}" ${payload.claim === payload.truth ? "(falou a verdade)" : "(mentiu!)"}</p>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

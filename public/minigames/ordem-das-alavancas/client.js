import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";
import { createMultiChatUI } from "/js/multichat-ui.js";

let els = {};
let sendActionRef = null;
let chatUI = null;
let hintMarks = {}; // índice -> "true" | "false" | null (só uso local, não envia ao servidor)

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    hintMarks = {};
    container.innerHTML = `<p class="hint">Recebendo dicas...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "session-start") {
      const hintsHtml = payload.hints
        .map(
          (h, i) => `
        <li style="margin-bottom:4px;">
          ${escapeHtml(h)}
          <button data-hint="${i}" data-mark="true" style="padding:2px 6px; font-size:0.75rem; margin-left:4px;">✅ Verdade</button>
          <button data-hint="${i}" data-mark="false" style="padding:2px 6px; font-size:0.75rem;">❌ Falsa</button>
        </li>`
        )
        .join("");

      container.innerHTML = `
        <p class="hint">Suas dicas (marque o que você acha de cada uma — só pra você, ninguém vê):</p>
        <ul style="text-align:left; list-style:none; padding:0;">${hintsHtml}</ul>
        <p class="hint" style="margin:10px 0 4px;">Seu palpite de ordem (pode mudar quantas vezes quiser):</p>
        <div id="order-picker" style="display:flex; gap:6px; justify-content:center; margin-bottom:8px;"></div>
        <div id="chat-container"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;

      // Marcação local (verdade/falsa) — só visual pro próprio jogador
      container.querySelectorAll("button[data-hint]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = btn.dataset.hint;
          const mark = btn.dataset.mark;
          hintMarks[idx] = hintMarks[idx] === mark ? null : mark;
          const li = btn.closest("li");
          li.querySelectorAll("button").forEach((b) => {
            b.style.outline = "none";
            b.style.background = "";
          });
          if (hintMarks[idx]) {
            btn.style.outline = "3px solid " + (mark === "true" ? "#3ddc3d" : "#ff4d4d");
            btn.style.background = mark === "true" ? "#1d4d1d" : "#4d1d1d";
          }
        });
      });

      // Palpite de ordem, editável a qualquer momento
      const picker = container.querySelector("#order-picker");
      const selects = [];
      payload.levers.forEach((_, i) => {
        const sel = document.createElement("select");
        payload.levers.forEach((lever) => {
          const opt = document.createElement("option");
          opt.value = lever;
          opt.textContent = lever;
          sel.appendChild(opt);
        });
        sel.selectedIndex = i;
        sel.addEventListener("change", sendOrder);
        selects.push(sel);
        picker.appendChild(sel);
      });
      function sendOrder() {
        sendActionRef({ type: "submit-order", order: selects.map((s) => s.value) });
      }
      sendOrder(); // manda o palpite inicial também

      // Chat separado por pessoa
      const contacts = payload.players.map((p) => ({
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
    } else if (payload.type === "reveal") {
      clearCountdown();
      container.innerHTML = `<p>A ordem certa era: <b>${payload.secretOrder.join(" → ")}</b></p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    chatUI = null;
    hintMarks = {};
    sendActionRef = null;
  },
};

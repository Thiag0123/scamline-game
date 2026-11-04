import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";
import { createDrawingCanvas } from "/js/drawing-canvas.js";

let els = {};
let sendActionRef = null;
let canvasCtl = null;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "draw-start") {
      container.innerHTML = `
        <p>🎨 Desenhe qualquer coisa! Os outros vão tentar adivinhar que é seu depois.</p>
        <div id="canvas-holder" style="text-align:center;"></div>
        <button id="submit-drawing-btn" style="width:100%; margin-top:10px;">Enviar Desenho</button>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;
      canvasCtl = createDrawingCanvas({ container: container.querySelector("#canvas-holder") });
      let submitted = false;
      const doSubmit = () => {
        if (submitted) return;
        submitted = true;
        sendActionRef({ type: "submit-drawing", dataUrl: canvasCtl.getDataURL() });
        container.querySelector("#submit-drawing-btn").disabled = true;
        container.querySelector("#submit-drawing-btn").textContent = "Enviado!";
      };
      container.querySelector("#submit-drawing-btn").addEventListener("click", doSubmit);

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
        if (s <= 0) doSubmit();
      });
    } else if (payload.type === "guess-wait") {
      canvasCtl = null;
      container.innerHTML = `
        <p>Sua vez de esperar — os outros estão tentando adivinhar qual desenho é <b>seu</b>!</p>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;
      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "guess-round") {
      canvasCtl = null;
      container.innerHTML = `
        <p>Qual desses desenhos é de <b>${escapeHtml(payload.artistName)}</b>?</p>
        <div id="options-grid" style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;"></div>
        <p id="phase-timer" class="hint" style="margin-top:8px;"></p>
      `;
      const grid = container.querySelector("#options-grid");
      let answered = false;
      payload.options.forEach((opt) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "cursor:pointer; border:3px solid transparent; border-radius:8px; overflow:hidden;";
        wrap.innerHTML = `<img src="${opt.dataUrl}" style="width:120px; height:120px; display:block; background:#fff;" />`;
        wrap.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          sendActionRef({ type: "submit-guess", optionId: opt.optionId });
          grid.querySelectorAll("div").forEach((d) => (d.style.cursor = "default"));
          wrap.style.borderColor = "var(--mg-accent)";
        });
        grid.appendChild(wrap);
      });

      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "guess-round-result") {
      clearCountdown();
      const p = document.createElement("p");
      p.innerHTML = `<b>${escapeHtml(payload.artistName)}</b>: ${payload.correctCount}/${payload.totalGuessers} acertaram.`;
      container.prepend(p);
    }
  },

  unmount() {
    clearCountdown();
    canvasCtl?.destroy?.();
    els = {};
    canvasCtl = null;
    sendActionRef = null;
  },
};

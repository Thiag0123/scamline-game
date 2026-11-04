import { startCountdown, clearCountdown, escapeHtml } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let currentIndex = -1;

export default {
  mount({ container, sendAction }) {
    sendActionRef = sendAction;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando o quiz...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "question") {
      currentIndex = payload.index;
      container.innerHTML = `
        <p class="hint">Pergunta ${payload.index + 1}/${payload.total}</p>
        <p style="font-size:1.1rem;">${escapeHtml(payload.text)}</p>
        <div id="options-list"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      const list = container.querySelector("#options-list");
      let answered = false;
      payload.options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.textContent = opt;
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.dataset.index = i;
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          sendActionRef({ type: "submit-answer", index: currentIndex, choice: i });
          list.querySelectorAll("button").forEach((b) => (b.disabled = true));
          btn.style.background = "#8aff8a";
        });
        list.appendChild(btn);
      });

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "question-result") {
      clearCountdown();
      const list = container.querySelector("#options-list");
      if (list) {
        const correctBtn = list.querySelector(`button[data-index="${payload.correct}"]`);
        if (correctBtn) correctBtn.style.background = "#3ddc3d";
        list.querySelectorAll("button").forEach((b) => (b.disabled = true));
      }
    } else if (payload.type === "quiz-result") {
      clearCountdown();
      const rows = payload.results
        .slice()
        .sort((a, b) => b.correct - a.correct)
        .map((r) => `<li>${escapeHtml(r.name)}: ${r.correct} acerto(s)</li>`)
        .join("");
      container.innerHTML = `<p>Resultado do quiz:</p><ul style="text-align:left;">${rows}</ul>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

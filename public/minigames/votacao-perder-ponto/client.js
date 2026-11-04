// Minigame "Votação: Perder Ponto" (cliente)

let els = {};
let sendActionRef = null;
let myIdRef = null;
import { startCountdown, clearCountdown } from "/js/minigame-helpers.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Aguardando início da votação...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "voting-start") {
      container.innerHTML = `
        <p>Vote em quem você acha que deve <b style="color:#ff8080">perder 1 ponto</b>.</p>
        <p class="hint">⚠️ Obrigatório votar — se não votar a tempo, você perde 1 ponto também.</p>
        <div id="vote-list" style="text-align:left;"></div>
        <div id="live-tally" style="text-align:left; margin-top:10px;"></div>
        <p id="phase-timer" class="hint" style="margin-top:10px;"></p>
      `;
      const list = container.querySelector("#vote-list");
      let voted = false;
      payload.players.filter((p) => p.id !== myIdRef).forEach((p) => {
        const avatar = window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 28) : "";
        const btn = document.createElement("button");
        btn.innerHTML = `${avatar} ${escapeHtml(p.name)}`;
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.addEventListener("click", () => {
          if (voted) return;
          voted = true;
          sendActionRef({ type: "vote", targetId: p.id });
          list.querySelectorAll("button").forEach((b) => (b.disabled = true));
          btn.innerHTML = `✅ Votou em ${avatar} ${escapeHtml(p.name)}`;
        });
        list.appendChild(btn);
      });

      startCountdown(payload.durationMs, (s) => {
        container.querySelector("#phase-timer").textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "live-tally") {
      const el = container.querySelector("#live-tally");
      if (el) {
        el.innerHTML = `<p class="hint">Votos em tempo real (${payload.votesIn}/${payload.votesTotal}):</p>` +
          payload.tally
            .filter((t) => t.count > 0)
            .map((t) => `<div>${window.__avatarImgHtml ? window.__avatarImgHtml(t.id, 26) : ""} ${escapeHtml(t.name)}: ${t.count}</div>`)
            .join("");
      }
    } else if (payload.type === "voting-result") {
      clearCountdown();
      const loserNames = payload.tally
        .filter((t) => payload.losers.includes(t.id))
        .map((t) => t.name)
        .join(", ");
      container.innerHTML = `
        <p>Resultado da votação:</p>
        <ul style="text-align:left;">
          ${payload.tally.map((t) => `<li>${escapeHtml(t.name)}: ${t.count} voto(s)</li>`).join("")}
        </ul>
        <p style="color:#ff8080;"><b>${loserNames || "Ninguém"}</b> perdeu 1 ponto.</p>
        ${payload.didNotVote && payload.didNotVote.length ? `<p style="color:#ff8080;">${escapeHtml(payload.didNotVote.join(", "))} não votou a tempo e também perdeu 1 ponto.</p>` : ""}
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
  },
};

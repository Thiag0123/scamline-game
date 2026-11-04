import { startCountdown, clearCountdown, escapeHtml, renderPlayerButtonList } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;
let players = [];

function renderCircle(container, alivePlayers, holderName) {
  const size = 220;
  const radius = 85;
  const center = size / 2;
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative; width:${size}px; height:${size}px; margin:10px auto;`;
  alivePlayers.forEach((p, i) => {
    const angle = (i / alivePlayers.length) * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle) - 22;
    const y = center + radius * Math.sin(angle) - 22;
    const avatarHtml = window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 54) : "";
    const div = document.createElement("div");
    div.style.cssText = `position:absolute; left:${x}px; top:${y}px; text-align:center; ${p.name === holderName ? "outline:3px solid var(--mg-accent); border-radius:50%;" : ""}`;
    div.innerHTML = `${avatarHtml}<div style="font-size:0.6rem;">${escapeHtml(p.name)}</div>`;
    wrap.appendChild(div);
  });
  if (holderName) {
    const gun = document.createElement("div");
    gun.style.cssText = "position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:1.8rem;";
    gun.textContent = "🔫";
    wrap.appendChild(gun);
  }
  container.appendChild(wrap);
}

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando a roda...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "circle-setup") {
      players = payload.players;
    } else if (payload.type === "your-turn") {
      container.innerHTML = `<p>🔫 <b>Sua vez!</b> Atire em quem?</p><p class="hint">Restam no tambor: 🔘 ${payload.remainingBlank} festim · 💥 ${payload.remainingReal} real(is)</p><div id="circle"></div><div id="target-list" style="text-align:left;"></div><p id="phase-timer" class="hint" style="margin-top:8px;"></p>`;
      renderCircle(container.querySelector("#circle"), payload.players, "você");
      const meAsTarget = [{ id: myIdRef, name: "Você mesmo" }, ...payload.players.filter((p) => p.id !== myIdRef)];
      renderPlayerButtonList(container.querySelector("#target-list"), meAsTarget, (p) => {
        sendActionRef({ type: "shoot", targetId: p.id });
      });
      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "waiting-turn") {
      container.innerHTML = `<p>🔫 <b>${escapeHtml(payload.holderName)}</b> está com a arma...</p><p class="hint">Restam no tambor: 🔘 ${payload.remainingBlank} festim · 💥 ${payload.remainingReal} real(is)</p><div id="circle"></div><p id="phase-timer" class="hint" style="margin-top:8px;"></p>`;
      renderCircle(container.querySelector("#circle"), players, payload.holderName);
      startCountdown(payload.durationMs, (s) => {
        const el = container.querySelector("#phase-timer");
        if (el) el.textContent = `⏱ ${s}s`;
      });
    } else if (payload.type === "shot-fired") {
      clearCountdown();
      const targetLabel = payload.shotSelf ? "em si mesmo" : `em ${escapeHtml(payload.targetName)}`;
      const resultLabel = payload.isReal ? "💥 BALA REAL!" : "🔘 Festim (bala de festim)";
      container.innerHTML = `
        <p style="font-size:1.2rem;">${escapeHtml(payload.shooterName)} atirou ${targetLabel}...</p>
        <p style="font-size:1.3rem;"><b>${resultLabel}</b></p>
        <p class="hint">Restam no tambor: 🔘 ${payload.remainingBlank} festim · 💥 ${payload.remainingReal} real(is)</p>
      `;
    } else if (payload.type === "game-over") {
      clearCountdown();
      container.innerHTML = `
        <p>🕊️ Sobreviveram: <b>${escapeHtml(payload.survivorNames.join(", ") || "ninguém")}</b></p>
        <p style="color:#ff8080;">💀 Foram atingidos: <b>${escapeHtml(payload.hitNames.join(", ") || "ninguém")}</b> (-1 ponto cada)</p>
      `;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    players = [];
    sendActionRef = null;
  },
};

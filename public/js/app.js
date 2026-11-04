// app.js
// Controla as telas e a comunicação via socket.io: lobby (com avatares), jogo (rodadas),
// revelação final sincronizada pelo servidor, desempate, e retorno ao lobby.

import { clearCountdown } from "./minigame-helpers.js";

const socket = io();

const THEMES = {
  "votacao-perder-ponto": { icon: "👎", color: "#ff5e5e" },
  "votacao-ganhar-ponto": { icon: "👍", color: "#4dff88" },
  "quintal-casa": { icon: "🏡", color: "#4dff88" },
  "mascara-diferente": { icon: "🎭", color: "#ffb84d" },
  "salas-secretas": { icon: "🚪", color: "#4dc9ff" },
  "ordem-das-alavancas": { icon: "🎚️", color: "#4dc9ff" },
  "saida-estrategica": { icon: "🚶", color: "#ff8080" },
  "tnt": { icon: "🧨", color: "#ff5e5e" },
  "a-flor": { icon: "🌸", color: "#ff8fd8" },
  "pocoes": { icon: "🧪", color: "#8a4dff" },
  "palavra-em-comum": { icon: "💬", color: "#ffd24d" },
  "informante-do-quintal": { icon: "🕵️", color: "#4dc9ff" },
  "pocao-do-lider": { icon: "👑", color: "#ffd24d" },
  "pergunta-impostor": { icon: "❓", color: "#ff8fd8" },
  "quiz-geral": { icon: "🧠", color: "#4dc9ff" },
  "palavra-impostor": { icon: "🔤", color: "#4dff88" },
};
const DEFAULT_THEME = { icon: "🎮", color: "#ff5e5e" };
const NEUTRAL_THEME = { icon: "⏳", color: "#888899" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function setTheme(theme) {
  document.documentElement.style.setProperty("--mg-accent", theme.color);
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// Mapa global de avatares (id -> nome do arquivo), preenchido a partir do lobby e usado
// por todo lugar que mostra nome de jogador (inclusive dentro dos minigames).
window.__playerAvatars = new Map();
function avatarFile(id) {
  return window.__playerAvatars.get(id) || null;
}
window.__avatarFor = avatarFile;

// Retorna o HTML de uma <img> de avatar (ou string vazia se não tiver avatar ainda).
// As imagens ficam em /avatars/<arquivo> — troque os arquivos em public/avatars/ pelas
// suas próprias artes, mantendo os mesmos nomes (avatar-01.png ... avatar-16.png).
function avatarImgHtml(id, size = 28) {
  const file = avatarFile(id);
  if (!file) return "";
  return `<img src="/avatars/${file}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle;" onerror="this.style.visibility='hidden'" />`;
}
window.__avatarImgHtml = avatarImgHtml;

const screens = {
  home: document.getElementById("screen-home"),
  lobby: document.getElementById("screen-lobby"),
  game: document.getElementById("screen-game"),
  final: document.getElementById("screen-final"),
};
function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
}

let myId = null;
let currentMinigameModule = null;
let pendingMinigameEvents = [];
let minigameList = [];
let avatarList = [];
let minigameSelectorRendered = false;
let avatarPickerRendered = false;
let roundToken = 0;
let lastRoomSnapshot = null;

socket.on("connect", () => {
  myId = socket.id;
  socket.emit("list-minigames", (list) => {
    minigameList = list || [];
    if (screens.lobby.classList.contains("active")) renderMinigameSelector();
  });
  socket.emit("list-avatars", (list) => {
    avatarList = list || [];
    if (screens.lobby.classList.contains("active")) renderAvatarPicker();
  });
});

// ---------- TELA HOME ----------
const inputName = document.getElementById("input-name");
const inputCode = document.getElementById("input-code");
const homeError = document.getElementById("home-error");

document.getElementById("btn-create-room").addEventListener("click", () => {
  const name = inputName.value.trim();
  if (!name) return showHomeError("Digite seu nome.");
  socket.emit("create-room", { name }, (res) => {
    if (!res.ok) return showHomeError(res.error || "Erro ao criar sala.");
    enterLobby(res.room);
  });
});

document.getElementById("btn-join-room").addEventListener("click", () => {
  const name = inputName.value.trim();
  const code = inputCode.value.trim().toUpperCase();
  if (!name) return showHomeError("Digite seu nome.");
  if (!code) return showHomeError("Digite o código da sala.");
  socket.emit("join-room", { name, code }, (res) => {
    if (!res.ok) return showHomeError(res.error || "Erro ao entrar na sala.");
    enterLobby(res.room);
  });
});
function showHomeError(msg) {
  homeError.textContent = msg;
}

function enterLobby(room) {
  document.getElementById("player-sidebar").style.display = "flex";
  renderLobby(room);
  renderAvatarPicker();
  showScreen("lobby");
}

// ---------- SIDEBAR ESQUERDA (avatares) ----------
function renderSidebar(players) {
  const sidebar = document.getElementById("player-sidebar");
  sidebar.innerHTML = "";
  players.forEach((p) => {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.alignItems = "center";
    div.style.gap = "2px";
    const avatarHtml = p.avatar
      ? `<img src="/avatars/${p.avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.visibility='hidden'" />`
      : "";
    div.innerHTML = `
      <div class="sidebar-avatar${p.connected === false ? " disconnected" : ""}">${avatarHtml}</div>
      <div class="sidebar-name">${escapeHtml(p.name)}${p.id === myId ? " (você)" : ""}</div>
    `;
    sidebar.appendChild(div);
  });
}

// ---------- TELA LOBBY ----------
function renderLobby(room) {
  lastRoomSnapshot = room;
  room.players.forEach((p) => window.__playerAvatars.set(p.id, p.avatar));
  renderSidebar(room.players);

  document.getElementById("lobby-code").textContent = room.code;
  const list = document.getElementById("lobby-players");
  list.innerHTML = "";
  room.players.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="pname"><span class="avatar-inline"><img src="/avatars/${p.avatar}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;vertical-align:middle;" onerror="this.style.visibility='hidden'" /></span> ${escapeHtml(p.name)}${p.id === myId ? " (você)" : ""}</span>`;
    if (p.id === room.hostId) li.classList.add("host");
    if (p.ready) li.classList.add("ready");
    list.appendChild(li);
  });

  const isHost = room.hostId === myId;
  document.getElementById("host-controls").style.display = isHost ? "block" : "none";
  if (isHost) renderMinigameSelector();

  updateAvatarPickerSelection(room.players.find((p) => p.id === myId)?.avatar);
}

function renderAvatarPicker() {
  if (avatarPickerRendered || avatarList.length === 0) return;
  const container = document.getElementById("avatar-picker");
  container.innerHTML = "";
  avatarList.forEach((av) => {
    const btn = document.createElement("button");
    btn.className = "avatar-option";
    btn.dataset.avatar = av;
    btn.innerHTML = `<img src="/avatars/${av}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.visibility='hidden'" />`;
    btn.addEventListener("click", () => socket.emit("set-avatar", { avatar: av }));
    container.appendChild(btn);
  });
  avatarPickerRendered = true;
  if (lastRoomSnapshot) {
    updateAvatarPickerSelection(lastRoomSnapshot.players.find((p) => p.id === myId)?.avatar);
  }
}
function updateAvatarPickerSelection(avatar) {
  document.querySelectorAll(".avatar-option").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.avatar === avatar);
  });
}

function renderMinigameSelector() {
  if (minigameSelectorRendered) return;
  const container = document.getElementById("minigame-selector");
  if (!container || minigameList.length === 0) return;
  container.innerHTML = "";
  minigameList.forEach((mg) => {
    const theme = THEMES[mg.id] || DEFAULT_THEME;
    const label = document.createElement("label");
    label.style.display = "block";
    label.style.margin = "4px 0";
    label.innerHTML = `<input type="checkbox" checked data-mg-id="${mg.id}" /> ${theme.icon} ${mg.name}`;
    container.appendChild(label);
  });
  minigameSelectorRendered = true;
}
function getSelectedMinigameIds() {
  return Array.from(document.querySelectorAll("#minigame-selector input[type=checkbox]:checked")).map(
    (el) => el.dataset.mgId
  );
}

document.getElementById("btn-ready").addEventListener("click", () => socket.emit("toggle-ready"));
document.getElementById("btn-start-game").addEventListener("click", () => {
  const totalRounds = Number(document.getElementById("input-rounds").value) || 10;
  socket.emit("start-game", { totalRounds, selectedMinigameIds: getSelectedMinigameIds() });
});

socket.on("lobby-update", (room) => {
  renderLobby(room);
});

// ---------- FLUXO DO JOGO ----------
socket.on("game-started", () => showScreen("game"));

socket.on("round-start", async ({ round, totalRounds, minigameId, minigameName, description, waitMs, explainMs }) => {
  const myToken = ++roundToken;
  showScreen("game");
  document.getElementById("game-round-label").textContent = `Rodada ${round}/${totalRounds}`;
  document.getElementById("game-minigame-label").textContent = "";
  clearCountdown();
  pendingMinigameEvents = [];

  const container = document.getElementById("minigame-container");

  setTheme(NEUTRAL_THEME);
  renderWaitScreen(container, waitMs);
  await sleep(waitMs);
  if (myToken !== roundToken) return;

  const theme = THEMES[minigameId] || DEFAULT_THEME;
  setTheme(theme);
  document.getElementById("game-minigame-label").textContent = `${theme.icon} ${minigameName}`;
  renderExplainScreen(container, theme, minigameName, description, explainMs);
  await sleep(explainMs);
  if (myToken !== roundToken) return;

  try {
    const mod = await import(`/minigames/${minigameId}/client.js`);
    if (myToken !== roundToken) return;
    currentMinigameModule = mod.default;
    currentMinigameModule.mount({
      container,
      socket,
      myId,
      sendAction: (data) => socket.emit("minigame-action", data),
    });
    const queued = pendingMinigameEvents;
    pendingMinigameEvents = [];
    queued.forEach((payload) => currentMinigameModule.onEvent?.(payload));
  } catch (err) {
    console.error(`Erro ao carregar minigame "${minigameId}":`, err);
    container.textContent = `Erro ao carregar o minigame "${minigameId}".`;
  }
});

function renderWaitScreen(container, durationMs) {
  container.innerHTML = `
    <div class="mg-wait-screen">
      <div class="mg-wait-icon">⏳</div>
      <p>Preparando o próximo minigame...</p>
      <p id="wait-timer" class="hint" style="font-size:1.1rem;"></p>
    </div>
  `;
  const el = container.querySelector("#wait-timer");
  let remaining = Math.ceil(durationMs / 1000);
  el.textContent = `${remaining}s`;
  const interval = setInterval(() => {
    remaining -= 1;
    if (el.isConnected) el.textContent = `${Math.max(0, remaining)}s`;
    if (remaining <= 0) clearInterval(interval);
  }, 1000);
}

function renderExplainScreen(container, theme, name, description, durationMs) {
  container.innerHTML = `
    <div class="mg-explain-screen">
      <div class="mg-explain-icon">${theme.icon}</div>
      <div class="mg-explain-title">${escapeHtml(name)}</div>
      <p class="mg-explain-desc">${escapeHtml(description || "")}</p>
      <p id="explain-timer" class="hint" style="margin-top:14px;"></p>
    </div>
  `;
  const el = container.querySelector("#explain-timer");
  let remaining = Math.ceil(durationMs / 1000);
  el.textContent = `Começando em ${remaining}s...`;
  const interval = setInterval(() => {
    remaining -= 1;
    if (el.isConnected) el.textContent = `Começando em ${Math.max(0, remaining)}s...`;
    if (remaining <= 0) clearInterval(interval);
  }, 1000);
}

socket.on("minigame-event", (payload) => {
  if (currentMinigameModule) currentMinigameModule.onEvent?.(payload);
  else pendingMinigameEvents.push(payload);
});

socket.on("round-end", () => {
  clearCountdown();
  currentMinigameModule?.unmount?.();
  currentMinigameModule = null;
});

// ---------- REVELAÇÃO FINAL (sincronizada pelo servidor — todos veem o mesmo, ao mesmo tempo) ----------
socket.on("final-reveal-step", ({ index, total, entry }) => {
  showScreen("final");
  const el = document.getElementById("final-content");
  const changesHtml = entry.changes.length
    ? entry.changes
        .map((c) => {
          const cls = c.delta > 0 ? "gain" : "loss";
          const sign = c.delta > 0 ? "+" : "";
          return `<li class="${cls}"><span class="pname"><span class="avatar-inline">${avatarImgHtml(c.id, 24)}</span> ${escapeHtml(c.name)}${c.id === myId ? " (você)" : ""}</span><span>${sign}${c.delta}</span></li>`;
        })
        .join("")
    : `<li>Ninguém ganhou ou perdeu ponto</li>`;

  el.innerHTML = `
    <p class="final-step-counter">Revelando resultados: ${index + 1}/${total}</p>
    <p class="final-step-title">Rodada ${entry.round} · ${escapeHtml(entry.minigameName)}</p>
    <ul class="final-step-list">${changesHtml}</ul>
  `;
});

socket.on("tiebreaker-needed", ({ players }) => {
  showScreen("final");
  const el = document.getElementById("final-content");
  const names = players.map((p) => `${avatarImgHtml(p.id, 24)} ${escapeHtml(p.name)}`).join(", ");
  el.innerHTML = `
    <h2>🤝 Empate!</h2>
    <p>${names} empataram em 1º lugar. Vão disputar um desempate...</p>
  `;
});

let tiebreakerSent = false;
let barInterval = null;

socket.on("tiebreaker-round-start", ({ game, players }) => {
  tiebreakerSent = false;
  showScreen("final");
  const el = document.getElementById("final-content");
  const amInIt = players.some((p) => p.id === myId);

  if (game === "rps") {
    el.innerHTML = `
      <div class="tiebreaker-icon">✊✋✌️</div>
      <h2>Pedra, Papel e Tesoura</h2>
      <p>${players.map((p) => `${avatarImgHtml(p.id, 24)} ${escapeHtml(p.name)}`).join(" vs ")}</p>
      ${
        amInIt
          ? `<div id="rps-options">
              <button data-v="pedra">✊ Pedra</button>
              <button data-v="papel">✋ Papel</button>
              <button data-v="tesoura">✌️ Tesoura</button>
            </div>`
          : `<p class="hint">Aguarde, você não está no desempate.</p>`
      }
    `;
    if (amInIt) {
      el.querySelectorAll("#rps-options button").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (tiebreakerSent) return;
          tiebreakerSent = true;
          socket.emit("minigame-action", { type: "tiebreaker-pick", value: btn.dataset.v });
          el.querySelectorAll("#rps-options button").forEach((b) => (b.disabled = true));
          btn.style.background = "#8aff8a";
        });
      });
    }
  } else {
    el.innerHTML = `
      <div class="tiebreaker-icon">📊</div>
      <h2>Contagem</h2>
      <p>${players.map((p) => `${avatarImgHtml(p.id, 24)} ${escapeHtml(p.name)}`).join(", ")}</p>
      <p>Pare a barra o mais perto de 100% que conseguir!</p>
      <div id="bar-track"><div id="bar-fill"></div></div>
      ${amInIt ? `<button id="bar-stop-btn" style="width:100%;">PARAR</button>` : `<p class="hint">Aguarde, você não está no desempate.</p>`}
    `;
    if (amInIt) {
      let value = 0;
      let dir = 1;
      const fillEl = el.querySelector("#bar-fill");
      barInterval = setInterval(() => {
        value += dir * 2;
        if (value >= 100) {
          value = 100;
          dir = -1;
        } else if (value <= 0) {
          value = 0;
          dir = 1;
        }
        if (fillEl.isConnected) fillEl.style.width = `${value}%`;
      }, 30);
      el.querySelector("#bar-stop-btn").addEventListener("click", () => {
        if (tiebreakerSent) return;
        tiebreakerSent = true;
        clearInterval(barInterval);
        socket.emit("minigame-action", { type: "tiebreaker-pick", value });
        el.querySelector("#bar-stop-btn").disabled = true;
        el.querySelector("#bar-stop-btn").textContent = `Parou em ${value}%`;
      });
    }
  }
});

socket.on("tiebreaker-round-result", ({ game, picks, winners }) => {
  if (barInterval) clearInterval(barInterval);
  const el = document.getElementById("final-content");
  const picksHtml = picks
    .map((p) => `<li>${avatarImgHtml(p.id, 24)} ${escapeHtml(p.name)}: ${escapeHtml(String(p.value))}</li>`)
    .join("");
  const winnersHtml = winners.map((w) => `${avatarImgHtml(w.id, 24)} ${escapeHtml(w.name)}`).join(", ");
  el.innerHTML = `
    <h2>Resultado do desempate</h2>
    <ul style="text-align:left;">${picksHtml}</ul>
    <p>${winners.length > 1 ? "Ainda empatados: " : "Vencedor: "}<b>${winnersHtml}</b></p>
    ${winners.length > 1 ? `<p class="hint">Vão jogar de novo...</p>` : ""}
  `;
});

socket.on("game-finished-ranking", ({ ranking }) => {
  showScreen("final");
  const el = document.getElementById("final-content");
  const rows = ranking
    .map(
      (p, i) =>
        `<li><span class="pname"><span class="avatar-inline">${avatarImgHtml(p.id, 24)}</span> ${i + 1}º ${escapeHtml(p.name)}${p.id === myId ? " (você)" : ""}</span><span>${p.score} pts</span></li>`
    )
    .join("");
  el.innerHTML = `
    <h2>🏆 Resultado Final</h2>
    <ul id="final-ranking-list">${rows}</ul>
    <p class="hint" style="margin-top:14px;">Voltando ao lobby...</p>
  `;
});

// Depois do resultado final, todo mundo volta pro MESMO lobby (não pra tela inicial).
socket.on("return-to-lobby", (room) => {
  minigameSelectorRendered = false; // permite re-escolher minigames na próxima partida
  enterLobby(room);
});

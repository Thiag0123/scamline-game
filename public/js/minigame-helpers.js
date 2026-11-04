// Utilitários compartilhados pelos clientes de minigame.
// O timer é sempre exibido no cabeçalho fixo (#game-timer), no topo da tela.

let countdownInterval = null;

export function clearCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = null;
  const hud = document.getElementById("game-timer");
  if (hud) hud.textContent = "";
}

// onTick é opcional, usado só quando o minigame precisa de alguma lógica extra
// no tick (ex: auto-enviar palpite quando o tempo zera). O texto do timer em si
// já é escrito automaticamente no cabeçalho, não precisa fazer isso no onTick.
export function startCountdown(durationMs, onTick) {
  clearCountdown();
  let remaining = Math.ceil(durationMs / 1000);
  const hud = document.getElementById("game-timer");

  const update = (s) => {
    if (hud) hud.textContent = `⏱ ${s}s`;
    onTick?.(s);
  };

  update(remaining);
  countdownInterval = setInterval(() => {
    remaining -= 1;
    update(Math.max(0, remaining));
    if (remaining <= 0) clearCountdown();
  }, 1000);
}

export function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// Renderiza uma lista de botões (um por jogador) pra votar/escolher um alvo.
// onPick(player) é chamado uma única vez, ao clicar. Mostra o avatar de cada um,
// se disponível (preenchido globalmente pelo app.js a partir do lobby).
export function renderPlayerButtonList(listEl, players, onPick) {
  listEl.innerHTML = "";
  let picked = false;
  players.forEach((p) => {
    const avatarHtml = window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 32) : "";
    const btn = document.createElement("button");
    btn.innerHTML = `${avatarHtml} ${escapeHtml(p.name)}`;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.addEventListener("click", () => {
      if (picked) return;
      picked = true;
      listEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
      btn.innerHTML = `✅ ${avatarHtml} ${escapeHtml(p.name)}`;
      onPick(p);
    });
    listEl.appendChild(btn);
  });
}

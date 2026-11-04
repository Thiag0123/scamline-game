// Minigame "Cores"
// Existem espaços coloridos. Cada jogador escolhe um. A cor com a MAIORIA ganha 1
// ponto pra quem estiver nela; minoria não ganha nada. Se todos escolherem a mesma
// cor, todos perdem 1 ponto.

const COLORS = ["Vermelho", "Azul", "Verde", "Amarelo", "Roxo"];
const DURATION_MS = 40000;
const REVEAL_DISPLAY_MS = 5000;

export default {
  id: "cores",
  name: "Cores",
  description: "Escolha um espaço colorido. Quem estiver na cor da MAIORIA ganha 1 ponto; minoria não ganha nada. Mas se todo mundo escolher a mesma cor, todos perdem 1 ponto.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = { choices: new Map(), timer: null, revealTimer: null };
    io.to(room.code).emit("minigame-event", { type: "color-prompt", colors: COLORS, durationMs: DURATION_MS });
    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type !== "choose-color") return;
    if (!COLORS.includes(data.color)) return;
    state.choices.set(playerId, data.color);
    if (state.choices.size === ctx.room.players.size) {
      if (state.timer) clearTimeout(state.timer);
      finalize(ctx);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const groups = new Map();
  for (const [pid, color] of state.choices.entries()) {
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(pid);
  }

  let maxSize = 0;
  for (const g of groups.values()) maxSize = Math.max(maxSize, g.length);

  const scoresDelta = {};
  const totalAnswered = state.choices.size;
  if (groups.size === 1 && maxSize > 1 && maxSize === totalAnswered) {
    for (const pid of state.choices.keys()) scoresDelta[pid] = -1;
  } else if (maxSize > 1) {
    for (const g of groups.values()) {
      if (g.length === maxSize) g.forEach((pid) => (scoresDelta[pid] = 1));
    }
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "color-result",
    choices: Array.from(state.choices.entries()).map(([id, color]) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      color,
    })),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

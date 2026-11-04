// Minigame "Cassino"
// Cada jogador tem sua própria máquina caça-níquel. Puxar a alavanca sorteia:
// positivo (+1), neutro (0) ou negativo (-1). Pode puxar quantas vezes quiser em
// 1min30 — os resultados acumulam (ex: 2 positivos seguidos = +2 no total).

const DURATION_MS = 50000; // 50 segundos

export default {
  id: "cassino",
  name: "Cassino",
  description: "Puxe a alavanca da sua máquina quantas vezes quiser em 50 segundos. Cada puxada sorteia positivo (+1), neutro (nada) ou negativo (-1) — os resultados acumulam.",
  minPlayers: 2,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = { totals: new Map(), timer: null };
    for (const pid of room.players.keys()) ctx._state.totals.set(pid, 0);

    io.to(room.code).emit("minigame-event", { type: "casino-start", durationMs: DURATION_MS });
    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type !== "pull-lever") return;
    const roll = Math.random();
    let outcome, delta;
    if (roll < 1 / 3) {
      outcome = "positive";
      delta = 1;
    } else if (roll < 2 / 3) {
      outcome = "neutral";
      delta = 0;
    } else {
      outcome = "negative";
      delta = -1;
    }
    state.totals.set(playerId, (state.totals.get(playerId) || 0) + delta);
    ctx.io.to(playerId).emit("minigame-event", {
      type: "pull-result",
      outcome,
      delta,
      total: state.totals.get(playerId),
    });
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function finalize(ctx) {
  const state = ctx._state;
  const scoresDelta = {};
  for (const [pid, total] of state.totals.entries()) {
    if (total !== 0) scoresDelta[pid] = total;
  }
  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "casino-result",
    results: Array.from(state.totals.entries()).map(([id, total]) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      total,
    })),
  });
  ctx._state.timer = setTimeout(() => ctx.finish(scoresDelta), 5000);
}

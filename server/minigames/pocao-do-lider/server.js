// Minigame "Poção do Líder"
// Todo mundo recebe uma poção que, se usada, vale +1. Mas a poção de quem está em 1º
// lugar no placar (no momento em que a rodada começa) está envenenada: se usar, -1.
// Ninguém sabe de antemão quem está envenenado — é surpresa.

const CHOICE_DURATION_MS = 60000; // 1 minuto pra decidir se usa a poção
const REVEAL_DISPLAY_MS = 5000;

export default {
  id: "pocao-do-lider",
  name: "Poção do Líder",
  description: "Todos podem usar uma poção que vale 1 ponto — mas a poção de quem está em 1º lugar no placar está envenenada (se houver empate no topo, todos os líderes empatados estão envenenados).",
  minPlayers: 2,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    let maxScore = -Infinity;
    for (const p of room.players.values()) maxScore = Math.max(maxScore, p.score);
    const leaders = new Set(
      Array.from(room.players.values())
        .filter((p) => p.score === maxScore)
        .map((p) => p.id)
    );

    ctx._state = { leaders, choices: new Map(), timer: null, revealTimer: null, done: false };

    io.to(room.code).emit("minigame-event", {
      type: "choice-prompt",
      durationMs: CHOICE_DURATION_MS,
    });

    ctx._state.timer = setTimeout(() => finalize(ctx), CHOICE_DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || data?.type !== "submit-choice") return;
    if (state.choices.has(playerId)) return;
    state.choices.set(playerId, !!data.use);
    if (state.choices.size === ctx.room.players.size) finalize(ctx);
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

  const scoresDelta = {};
  const results = [];
  for (const [pid, used] of state.choices.entries()) {
    if (!used) continue;
    const wasPoisoned = state.leaders.has(pid);
    scoresDelta[pid] = wasPoisoned ? -1 : 1;
    results.push({ id: pid, name: ctx.room.players.get(pid)?.name, poisoned: wasPoisoned });
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "result",
    results,
    leaderNames: Array.from(state.leaders).map((id) => ctx.room.players.get(id)?.name),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

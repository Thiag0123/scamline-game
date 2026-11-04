// Minigame "A Flor"
// Um jogador é sorteado e deve sair (fisicamente) e dar uma flor a alguém, que ganha
// 1 ponto. É obrigado a dar a flor — se não escolher a tempo, ele mesmo perde 1 ponto.

const ACTION_DURATION_MS = 60000; // 1 minuto
const REVEAL_DISPLAY_MS = 5000;

export default {
  id: "a-flor",
  name: "A Flor",
  description: "Um jogador sorteado deve sair fisicamente e dar uma flor a alguém (+1 ponto pra quem recebe). Se não escolher em 1 minuto, ele mesmo perde ponto.",
  minPlayers: 2,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const ids = Array.from(room.players.keys());
    const actorId = ids[Math.floor(Math.random() * ids.length)];
    ctx._state = { actorId, done: false, timer: null, revealTimer: null };

    const others = ids.filter((id) => id !== actorId).map((id) => ({ id, name: room.players.get(id)?.name }));
    io.to(actorId).emit("minigame-event", {
      type: "actor-prompt",
      players: others,
      durationMs: ACTION_DURATION_MS,
    });
    for (const id of others) {
      io.to(id.id).emit("minigame-event", {
        type: "waiting",
        actorName: room.players.get(actorId)?.name,
        durationMs: ACTION_DURATION_MS,
      });
    }

    ctx._state.timer = setTimeout(() => finalize(ctx, null, true), ACTION_DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || playerId !== state.actorId) return;
    if (data?.type === "pick-target") {
      if (!data.targetId || !ctx.room.players.has(data.targetId)) return;
      finalize(ctx, data.targetId, false);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function finalize(ctx, targetId, timedOut) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const scoresDelta = {};
  if (targetId) {
    scoresDelta[targetId] = 1;
  } else if (timedOut) {
    scoresDelta[state.actorId] = -1;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "result",
    actorName: ctx.room.players.get(state.actorId)?.name,
    targetName: targetId ? ctx.room.players.get(targetId)?.name : null,
    timedOut: !!timedOut,
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

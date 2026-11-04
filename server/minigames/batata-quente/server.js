// Minigame "Batata Quente"
// A batata começa com um jogador aleatório. Ele pode passar pra qualquer outro a
// qualquer momento. Num instante aleatório (segredo), a batata explode — quem estiver
// segurando perde 1 ponto e sai da rodada. Uma nova batata recomeça entre os que
// sobraram, repetindo até que metade dos jogadores tenha "explodido". Quem sobrar
// não perde nada.

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: "batata-quente",
  name: "Batata Quente",
  description: "A batata passa de mão em mão — passe pra qualquer um quando quiser. Ela explode num momento aleatório e secreto: quem estiver com ela perde 1 ponto e sai. Continua até metade dos jogadores explodir; o resto sobrevive sem perder nada.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room } = ctx;
    const ids = Array.from(room.players.keys());
    ctx._state = {
      alive: new Set(ids),
      burnedCount: 0,
      requiredBurns: Math.floor(ids.length / 2),
      holderId: null,
      timer: null,
    };
    startPotato(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (playerId !== state.holderId || data?.type !== "pass-potato") return;
    if (!state.alive.has(data.targetId) || data.targetId === playerId) return;
    state.holderId = data.targetId;
    announceHolder(ctx);
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function startPotato(ctx) {
  const state = ctx._state;
  const alive = Array.from(state.alive);
  state.holderId = alive[Math.floor(Math.random() * alive.length)];
  announceHolder(ctx);

  const fuseMs = 8000 + Math.floor(Math.random() * 15000); // 8 a 23s, segredo
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => explode(ctx), fuseMs);
}

function announceHolder(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  io.to(room.code).emit("minigame-event", {
    type: "potato-holder",
    holderId: state.holderId,
    holderName: room.players.get(state.holderId)?.name,
    alive: Array.from(state.alive).map((id) => ({ id, name: room.players.get(id)?.name })),
  });
}

function explode(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  const burnedId = state.holderId;
  state.alive.delete(burnedId);
  state.burnedCount += 1;

  io.to(room.code).emit("minigame-event", {
    type: "explosion",
    burnedName: room.players.get(burnedId)?.name,
  });

  if (state.burnedCount >= state.requiredBurns || state.alive.size <= 1) {
    ctx._state.timer = setTimeout(() => finalize(ctx), 3000);
    return;
  }

  ctx._state.timer = setTimeout(() => startPotato(ctx), 3000);
}

function finalize(ctx) {
  const state = ctx._state;
  const scoresDelta = {};
  for (const pid of ctx.room.players.keys()) {
    if (!state.alive.has(pid)) scoresDelta[pid] = -1;
  }
  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    survivors: Array.from(state.alive).map((id) => ctx.room.players.get(id)?.name),
  });
  ctx._state.timer = setTimeout(() => ctx.finish(scoresDelta), 5000);
}

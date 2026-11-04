// Minigame "TNT"
// Um jogador começa com a TNT (80% de chance de explodir se tentar desarmar agora).
// Ele escolhe: tentar desarmar (arrisca) ou passar a TNT pra alguém (a cada passada,
// a chance de explosão cai, ficando mais seguro pro próximo). Quem desarmar com sucesso: +1.

const INITIAL_EXPLODE_CHANCE = 90;
const EXPLODE_CHANCE_DECREASE = 10;
const MIN_EXPLODE_CHANCE = 10;
const TURN_DURATION_MS = 60000; // 1 minuto por turno
const MAX_PASSES = 8;

export default {
  id: "tnt",
  name: "TNT",
  description: "Um jogador começa segurando a TNT. Desarme (arriscado) ou passe adiante — a cada passada fica mais seguro pro próximo.",
  minPlayers: 2,
  maxPlayers: 5,

  start(ctx) {
    const { room } = ctx;
    const ids = Array.from(room.players.keys());
    const holderId = ids[Math.floor(Math.random() * ids.length)];
    ctx._state = {
      holderId,
      explodeChance: INITIAL_EXPLODE_CHANCE,
      passCount: 0,
      timer: null,
      done: false,
    };
    announceTurn(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || playerId !== state.holderId) return;

    if (data?.type === "defuse") {
      attemptDefuse(ctx);
    } else if (data?.type === "pass") {
      const targetId = data.targetId;
      if (!ctx.room.players.has(targetId) || targetId === playerId) return;
      passTnt(ctx, targetId);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function announceTurn(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  const others = Array.from(room.players.keys())
    .filter((id) => id !== state.holderId)
    .map((id) => ({ id, name: room.players.get(id)?.name }));

  io.to(state.holderId).emit("minigame-event", {
    type: "your-turn",
    explodeChance: state.explodeChance,
    players: others,
    durationMs: TURN_DURATION_MS,
    isLastChance: state.passCount >= MAX_PASSES,
  });
  for (const id of others.map((o) => o.id)) {
    io.to(id).emit("minigame-event", {
      type: "waiting-turn",
      holderName: room.players.get(state.holderId)?.name,
      explodeChance: state.explodeChance,
      durationMs: TURN_DURATION_MS,
    });
  }

  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    // Se não agir a tempo: se já passou muitas vezes, força desarme; senão passa pra alguém aleatório.
    if (state.passCount >= MAX_PASSES) {
      attemptDefuse(ctx);
    } else {
      const candidates = Array.from(ctx.room.players.keys()).filter((id) => id !== state.holderId);
      const randomTarget = candidates[Math.floor(Math.random() * candidates.length)];
      passTnt(ctx, randomTarget);
    }
  }, TURN_DURATION_MS);
}

function passTnt(ctx, targetId) {
  const state = ctx._state;
  state.holderId = targetId;
  state.passCount += 1;
  state.explodeChance = Math.max(MIN_EXPLODE_CHANCE, state.explodeChance - EXPLODE_CHANCE_DECREASE);
  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "passed",
    holderName: ctx.room.players.get(targetId)?.name,
    explodeChance: state.explodeChance,
  });
  announceTurn(ctx);
}

function attemptDefuse(ctx) {
  const state = ctx._state;
  if (state.done) return;
  if (state.timer) clearTimeout(state.timer);

  const successChance = 100 - state.explodeChance;
  const success = Math.random() * 100 < successChance;
  const holderId = state.holderId;
  const holderName = ctx.room.players.get(holderId)?.name;

  state.done = true;
  const scoresDelta = success ? { [holderId]: 1 } : {};

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "result",
    success,
    holderName,
  });

  state.timer = setTimeout(() => ctx.finish(scoresDelta), 5000);
}

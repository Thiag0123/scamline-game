// Minigame "Roleta Russa"
// Avatares em roda. As balas ficam num tambor embaralhado uma única vez no início
// (metade real, metade festim) — cada tiro consome a próxima bala do tambor, então
// EXATAMENTE metade dos jogadores leva um tiro real (perde 1 ponto) e a outra metade
// sobrevive. O placar de balas restantes (festim/real) é mostrado durante o jogo.
// Festim em si mesmo: atira de novo. Festim em outro: passa a arma. Real: quem levou
// o tiro perde 1 ponto e sai da roda; se atirou em si mesmo, a arma passa aleatoriamente.

const TURN_DURATION_MS = 25000;
const SHOT_REVEAL_DELAY_MS = 3000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function remainingCounts(state) {
  const remaining = state.chamber.slice(state.chamberIndex);
  const real = remaining.filter(Boolean).length;
  return { real, blank: remaining.length - real };
}

export default {
  id: "roleta-russa",
  name: "Roleta Russa",
  description: "Avatares em roda. O tambor tem metade das balas reais e metade de festim, embaralhadas — dá pra ver quantas de cada restam. Atire em si mesmo ou em outro. Festim: continua (em si mesmo) ou passa a arma (em outro). Real: quem levou perde 1 ponto e sai. Exatamente metade sobrevive.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const ids = Array.from(room.players.keys());
    const n = ids.length;
    const realCount = Math.floor(n / 2) || 1;
    const chamber = shuffle([
      ...Array.from({ length: realCount }, () => true),
      ...Array.from({ length: n - realCount }, () => false),
    ]);

    ctx._state = {
      alive: new Set(ids),
      hit: new Set(),
      holderId: ids[Math.floor(Math.random() * n)],
      chamber,
      chamberIndex: 0,
      requiredHits: realCount,
      timer: null,
      done: false,
    };

    io.to(room.code).emit("minigame-event", {
      type: "circle-setup",
      players: ids.map((id) => ({ id, name: room.players.get(id)?.name })),
    });

    announceTurn(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || playerId !== state.holderId || data?.type !== "shoot") return;
    const targetId = data.targetId;
    if (!state.alive.has(targetId)) return;
    fireShot(ctx, targetId);
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function announceTurn(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  const counts = remainingCounts(state);

  const aliveList = Array.from(state.alive).map((id) => ({ id, name: room.players.get(id)?.name }));
  io.to(state.holderId).emit("minigame-event", {
    type: "your-turn",
    players: aliveList,
    durationMs: TURN_DURATION_MS,
    remainingReal: counts.real,
    remainingBlank: counts.blank,
  });
  for (const pid of state.alive) {
    if (pid !== state.holderId) {
      io.to(pid).emit("minigame-event", {
        type: "waiting-turn",
        holderName: room.players.get(state.holderId)?.name,
        durationMs: TURN_DURATION_MS,
        remainingReal: counts.real,
        remainingBlank: counts.blank,
      });
    }
  }

  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    const candidates = Array.from(state.alive).filter((id) => id !== state.holderId);
    const target = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : state.holderId;
    fireShot(ctx, target);
  }, TURN_DURATION_MS);
}

function fireShot(ctx, targetId) {
  const { room, io } = ctx;
  const state = ctx._state;
  if (state.timer) clearTimeout(state.timer);

  const isReal = state.chamber[state.chamberIndex];
  state.chamberIndex += 1;
  const shooterId = state.holderId;
  const shotSelf = targetId === shooterId;
  const counts = remainingCounts(state);

  io.to(room.code).emit("minigame-event", {
    type: "shot-fired",
    shooterName: room.players.get(shooterId)?.name,
    targetName: room.players.get(targetId)?.name,
    shotSelf,
    isReal,
    remainingReal: counts.real,
    remainingBlank: counts.blank,
  });

  if (isReal) {
    state.alive.delete(targetId);
    state.hit.add(targetId);
  }

  state.timer = setTimeout(() => {
    if (isReal && state.hit.size >= state.requiredHits) {
      finalize(ctx);
      return;
    }
    if (!isReal && shotSelf) {
      announceTurn(ctx); // festim em si mesmo: continua
      return;
    }
    if (!isReal && !shotSelf) {
      state.holderId = targetId; // festim em outro: passa a arma
      announceTurn(ctx);
      return;
    }
    // real em outro: arma passa aleatoriamente entre os vivos
    const candidates = Array.from(state.alive);
    if (candidates.length === 0) {
      finalize(ctx);
      return;
    }
    state.holderId = candidates[Math.floor(Math.random() * candidates.length)];
    announceTurn(ctx);
  }, SHOT_REVEAL_DELAY_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const scoresDelta = {};
  for (const id of state.hit) scoresDelta[id] = -1;

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "game-over",
    hitNames: Array.from(state.hit).map((id) => ctx.room.players.get(id)?.name),
    survivorNames: Array.from(state.alive).map((id) => ctx.room.players.get(id)?.name),
  });

  ctx._state.timer = setTimeout(() => ctx.finish(scoresDelta), 5000);
}

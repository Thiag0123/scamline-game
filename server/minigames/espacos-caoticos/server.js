// Minigame "Espaços Caóticos"
// 25 plataformas na tela. Cada jogador escolhe uma, em segredo (ninguém vê onde os
// outros foram). Uma bomba explode na plataforma com MAIS jogadores (empate: sorteia
// uma entre as mais cheias). Quem estava lá é eliminado, e a plataforma sai de jogo.
// Repete até sobrar 1 jogador, que ganha 1 ponto.

const NUM_PLATFORMS = 25;
const CHOICE_DURATION_MS = 36000;
const REVEAL_DELAY_MS = 4000;
const FINAL_DELAY_MS = 5000;

export default {
  id: "espacos-caoticos",
  name: "Espaços Caóticos",
  description: "25 plataformas na tela. Escolha uma em segredo (obrigatório) — ninguém vê onde os outros foram. A bomba explode onde tiver mais gente, eliminando quem estava lá. Se todos escolherem plataformas diferentes, ninguém perde, mas uma plataforma é retirada. Continua até sobrar 1 jogador, que ganha 1 ponto.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room } = ctx;
    ctx._state = {
      alive: new Set(room.players.keys()),
      availablePlatforms: new Set(Array.from({ length: NUM_PLATFORMS }, (_, i) => i + 1)),
      choices: new Map(),
      timer: null,
    };
    runRound(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type !== "choose-platform") return;
    if (!state.alive.has(playerId)) return;
    if (state.choices.has(playerId)) return;
    const platform = Number(data.platform);
    if (!state.availablePlatforms.has(platform)) return;
    state.choices.set(playerId, platform);
    if (state.choices.size === state.alive.size) {
      if (state.timer) clearTimeout(state.timer);
      resolveRound(ctx);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function runRound(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;

  if (state.alive.size <= 1) {
    finalize(ctx);
    return;
  }

  state.choices = new Map();
  io.to(room.code).emit("minigame-event", {
    type: "choose-platform-start",
    platforms: Array.from(state.availablePlatforms).sort((a, b) => a - b),
    alive: Array.from(state.alive),
    durationMs: CHOICE_DURATION_MS,
  });

  state.timer = setTimeout(() => resolveRound(ctx), CHOICE_DURATION_MS);
}

function resolveRound(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  if (state.timer) clearTimeout(state.timer);

  // quem não escolheu a tempo recebe uma plataforma aleatória disponível
  const availableArr = Array.from(state.availablePlatforms);
  for (const pid of state.alive) {
    if (!state.choices.has(pid)) {
      state.choices.set(pid, availableArr[Math.floor(Math.random() * availableArr.length)]);
    }
  }

  const tally = new Map(); // platform -> [playerIds]
  for (const [pid, platform] of state.choices.entries()) {
    if (!tally.has(platform)) tally.set(platform, []);
    tally.get(platform).push(pid);
  }

  let maxCount = 0;
  for (const list of tally.values()) maxCount = Math.max(maxCount, list.length);

  if (maxCount === 1) {
    // Ninguém se agrupou: ninguém perde nessa rodada, mas uma plataforma é retirada.
    const chosenPlatforms = Array.from(tally.keys());
    const removedPlatform = chosenPlatforms[Math.floor(Math.random() * chosenPlatforms.length)];
    state.availablePlatforms.delete(removedPlatform);

    io.to(room.code).emit("minigame-event", {
      type: "bomb-result",
      bombedPlatform: removedPlatform,
      hitNames: [],
      noOneHit: true,
      remainingCount: state.alive.size,
    });

    state.timer = setTimeout(() => runRound(ctx), REVEAL_DELAY_MS);
    return;
  }

  const crowdedPlatforms = Array.from(tally.entries()).filter(([, list]) => list.length === maxCount);
  const [bombedPlatform, hitPlayersOriginal] = crowdedPlatforms[Math.floor(Math.random() * crowdedPlatforms.length)];
  let hitPlayers = hitPlayersOriginal.slice();

  state.availablePlatforms.delete(bombedPlatform);

  // Se a bomba pegaria todo mundo que restou, poupa 1 aleatório pra sempre sobrar um vencedor
  if (hitPlayers.length === state.alive.size) {
    const survivorIdx = Math.floor(Math.random() * hitPlayers.length);
    hitPlayers = hitPlayers.filter((_, i) => i !== survivorIdx);
  }

  for (const pid of hitPlayers) state.alive.delete(pid);

  io.to(room.code).emit("minigame-event", {
    type: "bomb-result",
    bombedPlatform,
    hitNames: hitPlayers.map((id) => room.players.get(id)?.name),
    remainingCount: state.alive.size,
  });

  state.timer = setTimeout(() => runRound(ctx), REVEAL_DELAY_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  const winnerId = Array.from(state.alive)[0];
  const scoresDelta = {};
  if (winnerId) scoresDelta[winnerId] = 1;

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "final-reveal",
    winnerName: winnerId ? ctx.room.players.get(winnerId)?.name : null,
  });

  ctx._state.timer = setTimeout(() => ctx.finish(scoresDelta), FINAL_DELAY_MS);
}

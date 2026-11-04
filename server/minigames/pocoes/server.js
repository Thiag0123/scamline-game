// Minigame "Poções"
// 15 poções na mesa, 1 é veneno. Jogadores bebem uma de cada vez, em ordem sorteada
// (que roda em loop até alguém beber o veneno). Cada um clica na poção que quer beber,
// tem 45s pra escolher. Se for segura, passa a vez pro próximo. Quem beber o veneno: -1.

const NUM_POTIONS = 15;
const CHOOSE_DURATION_MS = 45000;
const RESULT_DELAY_MS = 4000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: "pocoes",
  name: "Poções",
  description: `Existem ${NUM_POTIONS} poções na mesa, 1 é veneno. Um de cada vez (em ordem sorteada), clique na poção que quer beber. Quem beber o veneno perde 1 ponto.`,
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const turnOrder = shuffle(Array.from(room.players.keys()));
    const poisonIndex = Math.floor(Math.random() * NUM_POTIONS);

    ctx._state = {
      turnOrder,
      turnIndex: 0,
      poisonIndex,
      remainingPotions: Array.from({ length: NUM_POTIONS }, (_, i) => i), // índices ainda na mesa
      timer: null,
      resultTimer: null,
      done: false,
    };

    runTurn(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || data?.type !== "drink-potion") return;
    const currentPlayerId = state.turnOrder[state.turnIndex];
    if (playerId !== currentPlayerId) return;
    const potionIndex = Number(data.potionIndex);
    if (!state.remainingPotions.includes(potionIndex)) return;

    if (state.timer) clearTimeout(state.timer);
    resolveChoice(ctx, potionIndex);
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.resultTimer) clearTimeout(ctx._state.resultTimer);
  },
};

function runTurn(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  const currentPlayerId = state.turnOrder[state.turnIndex];

  io.to(room.code).emit("minigame-event", {
    type: "turn-start",
    currentPlayerId,
    currentPlayerName: room.players.get(currentPlayerId)?.name,
    remainingPotions: state.remainingPotions,
    totalPotions: NUM_POTIONS,
    durationMs: CHOOSE_DURATION_MS,
  });

  state.timer = setTimeout(() => {
    // não escolheu a tempo: bebe uma poção aleatória entre as restantes
    const random = state.remainingPotions[Math.floor(Math.random() * state.remainingPotions.length)];
    resolveChoice(ctx, random);
  }, CHOOSE_DURATION_MS);
}

function resolveChoice(ctx, potionIndex) {
  const { room, io } = ctx;
  const state = ctx._state;
  const currentPlayerId = state.turnOrder[state.turnIndex];
  const poisoned = potionIndex === state.poisonIndex;

  state.remainingPotions = state.remainingPotions.filter((i) => i !== potionIndex);

  io.to(room.code).emit("minigame-event", {
    type: "potion-result",
    playerName: room.players.get(currentPlayerId)?.name,
    potionIndex,
    poisoned,
  });

  if (poisoned) {
    state.done = true;
    state.resultTimer = setTimeout(() => ctx.finish({ [currentPlayerId]: -1 }), RESULT_DELAY_MS);
    return;
  }

  state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
  state.resultTimer = setTimeout(() => runTurn(ctx), 2000);
}

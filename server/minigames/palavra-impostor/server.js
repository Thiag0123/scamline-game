// Minigame "Impostor da Palavra"
// Todos recebem uma palavra secreta, exceto 1 (o impostor) que recebe uma palavra diferente
// (mas relacionada). Em 3 rodadas, cada jogador responde uma pergunta genérica sobre sua
// palavra, um de cada vez (todos veem a resposta de todos). No fim, todos votam em quem
// acham que tem a palavra diferente. Quem acerta: +1.

const WORD_PAIRS = [
  { main: "Cachorro", alt: "Gato" },
  { main: "Praia", alt: "Deserto" },
  { main: "Café", alt: "Chá" },
  { main: "Futebol", alt: "Vôlei" },
  { main: "Chuva", alt: "Neve" },
  { main: "Guitarra", alt: "Violão" },
  { main: "Pizza", alt: "Hambúrguer" },
  { main: "Avião", alt: "Trem" },
  { main: "Sol", alt: "Lua" },
  { main: "Leão", alt: "Tigre" },
  { main: "Livro", alt: "Revista" },
  { main: "Montanha", alt: "Vale" },
  { main: "Espada", alt: "Escudo" },
  { main: "Chocolate", alt: "Baunilha" },
  { main: "Rio", alt: "Mar" },
  { main: "Bicicleta", alt: "Moto" },
  { main: "Inverno", alt: "Verão" },
  { main: "Caneta", alt: "Lápis" },
];

const ROUND_PROMPTS = [
  "Descreva sua palavra com um adjetivo (sem dizer ela diretamente).",
  "Onde você encontraria isso?",
  "Para que serve ou o que se faz com isso?",
];

const TURN_DURATION_MS = 60000; // 1 minuto por turno
const VOTE_DURATION_MS = 105000; // 45s originais + 1 minuto extra pedido
const REVEAL_DISPLAY_MS = 6000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: "palavra-impostor",
  name: "Impostor da Palavra",
  description: "Todos recebem uma palavra secreta, exceto 1 impostor (que não sabe que é o impostor). Respondam perguntas em turnos por 3 rodadas e descubram quem tem a palavra diferente — se desconfiar de si mesmo, vote em você.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room } = ctx;
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const ids = Array.from(room.players.keys());
    const impostorId = ids[Math.floor(Math.random() * ids.length)];
    const turnOrder = shuffle(ids);

    ctx._state = {
      pair,
      impostorId,
      turnOrder,
      roundIndex: 0,
      turnIndex: 0,
      votes: new Map(),
      phase: "turns",
      timer: null,
      revealTimer: null,
      done: false,
    };

    for (const pid of ids) {
      ctx.io.to(pid).emit("minigame-event", {
        type: "your-word",
        word: pid === impostorId ? pair.alt : pair.main,
      });
    }

    runTurn(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done) return;

    if (state.phase === "turns" && data?.type === "submit-turn-answer") {
      const currentPlayerId = state.turnOrder[state.turnIndex];
      if (playerId !== currentPlayerId) return;
      if (state.timer) clearTimeout(state.timer);
      broadcastTurnAnswer(ctx, playerId, String(data.text || "").slice(0, 150));
      advanceTurn(ctx);
      return;
    }

    if (state.phase === "voting" && data?.type === "vote") {
      if (state.votes.has(playerId)) return;
      if (!ctx.room.players.has(data.targetId)) return;
      state.votes.set(playerId, data.targetId);
      if (state.votes.size === ctx.room.players.size) finalize(ctx);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function runTurn(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  const currentPlayerId = state.turnOrder[state.turnIndex];

  io.to(room.code).emit("minigame-event", {
    type: "turn-start",
    round: state.roundIndex + 1,
    totalRounds: ROUND_PROMPTS.length,
    prompt: ROUND_PROMPTS[state.roundIndex],
    currentPlayerId,
    currentPlayerName: room.players.get(currentPlayerId)?.name,
    durationMs: TURN_DURATION_MS,
  });

  state.timer = setTimeout(() => {
    broadcastTurnAnswer(ctx, currentPlayerId, "(não respondeu a tempo)");
    advanceTurn(ctx);
  }, TURN_DURATION_MS);
}

function broadcastTurnAnswer(ctx, playerId, text) {
  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "turn-answer",
    playerName: ctx.room.players.get(playerId)?.name,
    text,
  });
}

function advanceTurn(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.turnIndex += 1;
  if (state.turnIndex >= state.turnOrder.length) {
    state.turnIndex = 0;
    state.roundIndex += 1;
  }
  if (state.roundIndex >= ROUND_PROMPTS.length) {
    startVoting(ctx);
  } else {
    runTurn(ctx);
  }
}

function startVoting(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  state.phase = "voting";

  const players = Array.from(room.players.values()).map((p) => ({ id: p.id, name: p.name }));
  io.to(room.code).emit("minigame-event", {
    type: "voting-start",
    players,
    durationMs: VOTE_DURATION_MS,
  });

  state.timer = setTimeout(() => finalize(ctx), VOTE_DURATION_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const scoresDelta = {};
  for (const [voterId, targetId] of state.votes.entries()) {
    if (targetId === state.impostorId) scoresDelta[voterId] = 1;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    impostorName: ctx.room.players.get(state.impostorId)?.name,
    mainWord: state.pair.main,
    altWord: state.pair.alt,
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

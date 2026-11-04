// Minigame "Desenhos"
// Todos desenham (1min30). Depois, uma rodada por artista: mostra 3 desenhos (o dele +
// 2 de outros) e o nome do artista — todo mundo (menos o próprio artista) tem 30s pra
// adivinhar qual é o desenho dele. O artista mais adivinhado (mas não por todos) +1.
// Quem mais acertou no total +1.

const DRAW_DURATION_MS = 90000; // 1min30
const GUESS_DURATION_MS = 30000;
const REVEAL_DELAY_MS = 4000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: "desenhos",
  name: "Desenhos",
  description: "Todos desenham algo em 1min30. Depois, um por um: mostramos 3 desenhos e o nome de um artista — adivinhe qual desenho é dele em 30s. O artista mais adivinhado (mas não por todos) ganha ponto. Quem mais acertar também ganha.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = {
      drawings: new Map(),
      timer: null,
      phase: "drawing",
      guessOrder: [],
      roundIndex: 0,
      currentOptions: null,
      roundGuesses: new Map(),
      correctPerArtist: new Map(), // artistId -> quantidade de acertos
      correctPerGuesser: new Map(), // guesserId -> total de acertos
    };

    io.to(room.code).emit("minigame-event", { type: "draw-start", durationMs: DRAW_DURATION_MS });
    ctx._state.timer = setTimeout(() => startGuessingPhase(ctx), DRAW_DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.phase === "drawing" && data?.type === "submit-drawing") {
      if (typeof data.dataUrl !== "string" || data.dataUrl.length > 400000) return;
      state.drawings.set(playerId, data.dataUrl);
      if (state.drawings.size === ctx.room.players.size) {
        if (state.timer) clearTimeout(state.timer);
        startGuessingPhase(ctx);
      }
      return;
    }
    if (state.phase === "guessing" && data?.type === "submit-guess") {
      const artistId = state.guessOrder[state.roundIndex];
      if (playerId === artistId) return;
      if (state.roundGuesses.has(playerId)) return;
      state.roundGuesses.set(playerId, data.optionId);
      const expected = ctx.room.players.size - 1;
      if (state.roundGuesses.size === expected) {
        if (state.timer) clearTimeout(state.timer);
        finishGuessRound(ctx);
      }
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function startGuessingPhase(ctx) {
  const { room } = ctx;
  const state = ctx._state;
  state.phase = "guessing";
  // Só entram na rodada de adivinhação quem realmente desenhou algo.
  state.guessOrder = shuffle(Array.from(state.drawings.keys()));
  state.roundIndex = 0;
  runGuessRound(ctx);
}

function runGuessRound(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;

  if (state.roundIndex >= state.guessOrder.length) {
    finalize(ctx);
    return;
  }

  const artistId = state.guessOrder[state.roundIndex];
  const allArtists = state.guessOrder;
  const others = allArtists.filter((id) => id !== artistId);
  const decoyIds = shuffle(others).slice(0, Math.min(2, others.length));

  const options = shuffle([
    { optionId: artistId, dataUrl: state.drawings.get(artistId) },
    ...decoyIds.map((id) => ({ optionId: id, dataUrl: state.drawings.get(id) })),
  ]);

  state.currentOptions = options;
  state.roundGuesses = new Map();

  const artistName = room.players.get(artistId)?.name;
  for (const pid of room.players.keys()) {
    if (pid === artistId) {
      io.to(pid).emit("minigame-event", { type: "guess-wait", artistName, durationMs: GUESS_DURATION_MS });
    } else {
      io.to(pid).emit("minigame-event", {
        type: "guess-round",
        artistName,
        options: options.map((o) => ({ optionId: o.optionId, dataUrl: o.dataUrl })),
        durationMs: GUESS_DURATION_MS,
      });
    }
  }

  state.timer = setTimeout(() => finishGuessRound(ctx), GUESS_DURATION_MS);
}

function finishGuessRound(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  const artistId = state.guessOrder[state.roundIndex];

  let correctCount = 0;
  for (const [guesserId, guessedOptionId] of state.roundGuesses.entries()) {
    if (guessedOptionId === artistId) {
      correctCount += 1;
      state.correctPerGuesser.set(guesserId, (state.correctPerGuesser.get(guesserId) || 0) + 1);
    }
  }
  state.correctPerArtist.set(artistId, correctCount);

  io.to(room.code).emit("minigame-event", {
    type: "guess-round-result",
    artistName: room.players.get(artistId)?.name,
    correctCount,
    totalGuessers: state.roundGuesses.size,
  });

  state.roundIndex += 1;
  state.timer = setTimeout(() => runGuessRound(ctx), REVEAL_DELAY_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  const scoresDelta = {};

  // Artista mais adivinhado, mas não por 100% dos que tentaram adivinhar.
  let bestArtist = null;
  let bestCount = -1;
  for (const artistId of state.guessOrder) {
    const correctCount = state.correctPerArtist.get(artistId) || 0;
    const totalGuessers = ctx.room.players.size - 1;
    if (correctCount === totalGuessers) continue; // todos acertaram, não vale
    if (correctCount > bestCount) {
      bestCount = correctCount;
      bestArtist = artistId;
    }
  }
  if (bestArtist && bestCount > 0) scoresDelta[bestArtist] = (scoresDelta[bestArtist] || 0) + 1;

  // Quem mais acertou adivinhações no total.
  let bestGuesser = null;
  let bestGuesserCount = 0;
  for (const [guesserId, count] of state.correctPerGuesser.entries()) {
    if (count > bestGuesserCount) {
      bestGuesserCount = count;
      bestGuesser = guesserId;
    }
  }
  if (bestGuesser) scoresDelta[bestGuesser] = (scoresDelta[bestGuesser] || 0) + 1;

  ctx.finish(scoresDelta);
}

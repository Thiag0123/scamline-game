// Minigame "Vermelho ou Verde"
// Rodadas em duplas (todo mundo enfrenta todo mundo uma vez, tipo rodízio). Em cada
// dupla, os dois apertam verde ou vermelho (36s) ao mesmo tempo:
//   Verde + Verde = 3 pontos internos pra cada um
//   Vermelho + Vermelho = 1 ponto interno pra cada um
//   Verde vs Vermelho = quem apertou verde não ganha nada, quem apertou vermelho ganha 5
// No fim, quem tiver o maior total de pontos internos ganha 1 ponto de verdade.

const ROUND_DURATION_MS = 36000;
const RESULT_DELAY_MS = 4000;
const FINAL_DELAY_MS = 6000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Rodízio (circle method): cada jogador enfrenta cada outro exatamente uma vez.
function roundRobinSchedule(n) {
  const isOdd = n % 2 !== 0;
  const list = [...Array(n).keys()];
  if (isOdd) list.push(-1); // -1 = folga
  const total = list.length;
  const rounds = [];
  let current = list.slice();
  for (let r = 0; r < total - 1; r++) {
    const pairs = [];
    for (let i = 0; i < total / 2; i++) {
      const a = current[i];
      const b = current[total - 1 - i];
      if (a !== -1 && b !== -1) pairs.push([a, b]);
    }
    rounds.push(pairs);
    const fixed = current[0];
    const rest = current.slice(1);
    rest.unshift(rest.pop());
    current = [fixed, ...rest];
  }
  return rounds;
}

export default {
  id: "vermelho-ou-verde",
  name: "Vermelho ou Verde",
  description: "Em duplas (todo mundo enfrenta todo mundo), aperte verde ou vermelho. Verde+Verde: 3 pra cada. Vermelho+Vermelho: 1 pra cada. Diferente: quem apertou verde não ganha nada, quem apertou vermelho ganha 5. No fim, quem tiver mais pontos acumulados ganha 1 ponto de verdade.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room } = ctx;
    const ids = shuffle(Array.from(room.players.keys()));
    const schedule = roundRobinSchedule(ids.length);

    ctx._state = {
      idxToPlayer: ids,
      schedule,
      roundIndex: 0,
      internalScore: new Map(ids.map((id) => [id, 0])),
      currentChoices: new Map(),
      currentPairs: new Map(), // playerId -> partnerId (só quem tem dupla nessa rodada)
      timer: null,
    };

    runRound(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type !== "press-button") return;
    if (!state.currentPairs.has(playerId)) return;
    if (data.color !== "green" && data.color !== "red") return;
    state.currentChoices.set(playerId, data.color); // pode mudar de ideia até o tempo acabar
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function runRound(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;

  if (state.roundIndex >= state.schedule.length) {
    finalize(ctx);
    return;
  }

  const pairs = state.schedule[state.roundIndex];
  state.currentChoices = new Map();
  state.currentPairs = new Map();

  for (const [ia, ib] of pairs) {
    const pa = state.idxToPlayer[ia];
    const pb = state.idxToPlayer[ib];
    state.currentPairs.set(pa, pb);
    state.currentPairs.set(pb, pa);

    io.to(pa).emit("minigame-event", {
      type: "pair-start",
      partnerName: room.players.get(pb)?.name,
      durationMs: ROUND_DURATION_MS,
    });
    io.to(pb).emit("minigame-event", {
      type: "pair-start",
      partnerName: room.players.get(pa)?.name,
      durationMs: ROUND_DURATION_MS,
    });
  }

  for (const pid of state.idxToPlayer) {
    if (!state.currentPairs.has(pid)) {
      io.to(pid).emit("minigame-event", { type: "bye-round", durationMs: ROUND_DURATION_MS });
    }
  }

  state.timer = setTimeout(() => resolveRound(ctx), ROUND_DURATION_MS);
}

function resolveRound(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  if (state.timer) clearTimeout(state.timer);

  const processed = new Set();
  const results = [];
  for (const [a, b] of state.currentPairs.entries()) {
    if (processed.has(a) || processed.has(b)) continue;
    processed.add(a);
    processed.add(b);

    const choiceA = state.currentChoices.get(a) || "red";
    const choiceB = state.currentChoices.get(b) || "red";
    let scoreA = 0;
    let scoreB = 0;
    if (choiceA === "green" && choiceB === "green") {
      scoreA = 3;
      scoreB = 3;
    } else if (choiceA === "red" && choiceB === "red") {
      scoreA = 1;
      scoreB = 1;
    } else if (choiceA === "green" && choiceB === "red") {
      scoreA = 0;
      scoreB = 5;
    } else {
      scoreA = 5;
      scoreB = 0;
    }
    state.internalScore.set(a, state.internalScore.get(a) + scoreA);
    state.internalScore.set(b, state.internalScore.get(b) + scoreB);

    results.push({
      nameA: room.players.get(a)?.name,
      nameB: room.players.get(b)?.name,
      choiceA,
      choiceB,
      scoreA,
      scoreB,
    });

    io.to(a).emit("minigame-event", { type: "pair-result", yourChoice: choiceA, theirChoice: choiceB, yourScore: scoreA });
    io.to(b).emit("minigame-event", { type: "pair-result", yourChoice: choiceB, theirChoice: choiceA, yourScore: scoreB });
  }

  state.roundIndex += 1;
  state.timer = setTimeout(() => runRound(ctx), RESULT_DELAY_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  let maxScore = -Infinity;
  for (const s of state.internalScore.values()) maxScore = Math.max(maxScore, s);
  const winners = Array.from(state.internalScore.entries())
    .filter(([, s]) => s === maxScore)
    .map(([id]) => id);

  const scoresDelta = {};
  winners.forEach((id) => (scoresDelta[id] = 1));

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "final-reveal",
    scores: Array.from(state.internalScore.entries()).map(([id, s]) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      score: s,
    })),
    winnerNames: winners.map((id) => ctx.room.players.get(id)?.name),
  });

  ctx._state.timer = setTimeout(() => ctx.finish(scoresDelta), FINAL_DELAY_MS);
}

// Minigame "Informante do Quintal"
// Sorteia-se uma verdade secreta (pode sair no quintal? sim/não) e um jogador "informado"
// que sabe a verdade e faz uma declaração pública (pode mentir, tem 1 minuto pra decidir).
// Direto depois (sem debate), cada outro jogador tem 1 minuto pra decidir em que acredita.
// Quem acerta a verdade: +1, quem erra: -1. O informado ganha +1 se a maioria acertou, -1 se não.

const INFORM_DURATION_MS = 60000; // 1 minuto pro informante decidir
const DECIDE_DURATION_MS = 60000; // 1 minuto pra decidir em que acreditar
const REVEAL_DISPLAY_MS = 6000;

export default {
  id: "informante-do-quintal",
  name: "Informante do Quintal",
  description: "Um jogador sabe se pode sair no quintal e pode mentir sobre isso (1 min pra decidir). Os outros têm 1 min pra decidir em que acreditar. Quem acerta a verdade ganha ponto. O informante ganha ponto se a MAIORIA seguir a instrução dele (mesmo que seja mentira).",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const truth = Math.random() < 0.5;
    const ids = Array.from(room.players.keys());
    const informedId = ids[Math.floor(Math.random() * ids.length)];

    ctx._state = {
      truth,
      informedId,
      claim: null,
      beliefs: new Map(),
      phase: "inform",
      timer: null,
      done: false,
    };

    io.to(informedId).emit("minigame-event", {
      type: "inform-prompt",
      truth,
      durationMs: INFORM_DURATION_MS,
    });
    for (const id of ids) {
      if (id !== informedId) {
        io.to(id).emit("minigame-event", {
          type: "waiting-informant",
          informedName: room.players.get(informedId)?.name,
          durationMs: INFORM_DURATION_MS,
        });
      }
    }

    ctx._state.timer = setTimeout(() => {
      if (ctx._state.claim === null) announceClaim(ctx, truth); // não respondeu: assume que falou a verdade
    }, INFORM_DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done) return;

    if (state.phase === "inform" && playerId === state.informedId && data?.type === "submit-statement") {
      if (state.claim !== null) return;
      announceClaim(ctx, !!data.claim);
      return;
    }

    if (state.phase === "decide" && playerId !== state.informedId && data?.type === "submit-belief") {
      if (state.beliefs.has(playerId)) return;
      state.beliefs.set(playerId, !!data.belief);
      const expectedCount = ctx.room.players.size - 1;
      if (state.beliefs.size === expectedCount) finalize(ctx);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function announceClaim(ctx, claim) {
  const { room, io } = ctx;
  const state = ctx._state;
  if (state.phase !== "inform") return;
  state.claim = claim;
  if (state.timer) clearTimeout(state.timer);

  io.to(room.code).emit("minigame-event", {
    type: "statement-announced",
    informedName: room.players.get(state.informedId)?.name,
    claim,
  });

  startDecidePhase(ctx);
}

function startDecidePhase(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  state.phase = "decide";

  for (const pid of room.players.keys()) {
    if (pid === state.informedId) {
      io.to(pid).emit("minigame-event", { type: "decide-wait", durationMs: DECIDE_DURATION_MS });
    } else {
      io.to(pid).emit("minigame-event", { type: "decide-start", durationMs: DECIDE_DURATION_MS });
    }
  }

  state.timer = setTimeout(() => finalize(ctx), DECIDE_DURATION_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const scoresDelta = {};
  let matchCount = 0;
  let followCount = 0;
  let totalDeciders = 0;
  for (const [pid, belief] of state.beliefs.entries()) {
    totalDeciders += 1;
    if (belief === state.truth) {
      scoresDelta[pid] = 1;
      matchCount += 1;
    } else {
      scoresDelta[pid] = -1;
    }
    if (belief === state.claim) followCount += 1;
  }

  if (totalDeciders > 0) {
    // O informante ganha ponto se a MAIORIA seguiu a instrução (claim) dele,
    // não necessariamente se acertaram a verdade.
    scoresDelta[state.informedId] = followCount > totalDeciders / 2 ? 1 : -1;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    truth: state.truth,
    informedName: ctx.room.players.get(state.informedId)?.name,
    claim: state.claim,
  });

  state.timer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

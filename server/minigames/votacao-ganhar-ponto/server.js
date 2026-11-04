// Minigame "Votação: Ganhar Ponto"
// Todos votam em alguém (não pode votar em si mesmo). Quem receber MAIS votos
// ganha 1 ponto. Em caso de empate no topo, todos os empatados ganham 1 ponto.

const VOTE_DURATION_MS = 80000; // 1 minuto e 20 segundos
const REVEAL_DISPLAY_MS = 5000; // tempo pra ver o resultado da votação antes de encerrar

export default {
  id: "votacao-ganhar-ponto",
  name: "Votação: Ganhar Ponto",
  description: "Vote em quem merece ganhar 1 ponto. Quem levar mais votos, ganha. É obrigatório votar — quem não votar a tempo perde 1 ponto.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = { votes: new Map(), timer: null, revealTimer: null, done: false };

    const playersInfo = Array.from(room.players.values()).map((p) => ({ id: p.id, name: p.name }));
    io.to(room.code).emit("minigame-event", {
      type: "voting-start",
      mode: "gain",
      players: playersInfo,
      durationMs: VOTE_DURATION_MS,
    });

    ctx._state.timer = setTimeout(() => finalizeVoting(ctx), VOTE_DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || data?.type !== "vote") return;
    if (state.votes.has(playerId)) return;
    if (data.targetId === playerId) return;
    if (!ctx.room.players.has(data.targetId)) return;

    state.votes.set(playerId, data.targetId);
    broadcastLiveTally(ctx);
    if (state.votes.size === ctx.room.players.size) finalizeVoting(ctx);
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function broadcastLiveTally(ctx) {
  const state = ctx._state;
  const tally = new Map();
  for (const targetId of state.votes.values()) {
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  }
  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "live-tally",
    tally: Array.from(ctx.room.players.keys()).map((id) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      count: tally.get(id) || 0,
    })),
    votesIn: state.votes.size,
    votesTotal: ctx.room.players.size,
  });
}

function finalizeVoting(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const tally = new Map();
  for (const targetId of state.votes.values()) {
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  }

  let maxVotes = 0;
  for (const count of tally.values()) maxVotes = Math.max(maxVotes, count);

  const scoresDelta = {};
  if (maxVotes > 0) {
    for (const [targetId, count] of tally.entries()) {
      if (count === maxVotes) scoresDelta[targetId] = 1;
    }
  }

  const tallyResultIds = Object.keys(scoresDelta); // só quem ganhou/perdeu pela votação em si

  // Voto obrigatório: quem não votou a tempo perde 1 ponto também (separado do resultado da votação).
  const didNotVoteIds = [];
  for (const pid of ctx.room.players.keys()) {
    if (!state.votes.has(pid)) {
      scoresDelta[pid] = (scoresDelta[pid] || 0) - 1;
      didNotVoteIds.push(pid);
    }
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "voting-result",
    tally: Array.from(tally.entries()).map(([id, count]) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      count,
    })),
    winners: tallyResultIds,
    didNotVote: didNotVoteIds.map((pid) => ctx.room.players.get(pid)?.name),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

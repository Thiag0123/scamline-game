// Minigame "Máscara Diferente"
// Um jogador é sorteado secretamente como "a máscara diferente" — NEM ELE SABE.
// Todos conversam livremente (com quem quiser, na hora que quiser, em segredo) e podem
// votar em quem acham que é a qualquer momento (o voto pode mudar até o tempo acabar).
// Duração fixa de 3 minutos. Quem acertar o voto final: +1 (mesmo que vote em si mesmo).

const DURATION_MS = 180000; // 3 minutos
const REVEAL_DISPLAY_MS = 6000;

export default {
  id: "mascara-diferente",
  name: "Máscara Diferente",
  description: "Alguém tem a máscara diferente — nem essa pessoa sabe quem é! Converse livremente e em segredo com quem quiser, e vote em quem acha que é a qualquer momento (dá pra mudar de ideia até o tempo acabar). Se desconfiar de você mesmo, pode votar em você.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const ids = Array.from(room.players.keys());
    const chosenId = ids[Math.floor(Math.random() * ids.length)];
    ctx._state = { chosenId, votes: new Map(), timer: null, revealTimer: null };

    const playersInfo = ids.map((id) => ({ id, name: room.players.get(id)?.name }));
    io.to(room.code).emit("minigame-event", {
      type: "session-start",
      players: playersInfo,
      durationMs: DURATION_MS,
    });

    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type === "chat-message") {
      const targetId = data.targetId;
      if (!ctx.room.players.has(targetId) || targetId === playerId) return;
      ctx.io.to(targetId).emit("minigame-event", {
        type: "chat-message",
        fromId: playerId,
        fromName: ctx.room.players.get(playerId)?.name,
        text: String(data.text || "").slice(0, 300),
      });
      return;
    }
    if (data?.type === "vote") {
      if (!ctx.room.players.has(data.targetId)) return;
      state.votes.set(playerId, data.targetId); // pode votar em qualquer um, inclusive si mesmo
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const scoresDelta = {};
  for (const [voterId, targetId] of state.votes.entries()) {
    if (targetId === state.chosenId) scoresDelta[voterId] = 1;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    chosenName: ctx.room.players.get(state.chosenId)?.name,
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

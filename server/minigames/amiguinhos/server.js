// Minigame "Amiguinhos"
// Escolha um jogador no quadro (pode mudar de ideia). Se alguém te escolher, você
// ganha 1 ponto (não importa quantos — é tudo ou nada). Chat livre, separado por
// pessoa, pra tentar convencer os outros a te escolherem.

const DURATION_MS = 65000; // 65 segundos
const REVEAL_DISPLAY_MS = 6000;

export default {
  id: "amiguinhos",
  name: "Amiguinhos",
  description: "Escolha um jogador no quadro (pode mudar quando quiser). Se alguém escolher você, ganha 1 ponto. Converse livremente e em segredo com quem quiser pra tentar convencer os outros.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = { choices: new Map(), timer: null, revealTimer: null };

    const playersInfo = Array.from(room.players.values()).map((p) => ({ id: p.id, name: p.name }));
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
    if (data?.type === "choose") {
      if (!ctx.room.players.has(data.targetId) || data.targetId === playerId) return;
      state.choices.set(playerId, data.targetId);
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

  const chosenIds = new Set(state.choices.values());
  const scoresDelta = {};
  for (const id of chosenIds) scoresDelta[id] = 1;

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    choices: Array.from(state.choices.entries()).map(([voterId, targetId]) => ({
      voterName: ctx.room.players.get(voterId)?.name,
      targetName: ctx.room.players.get(targetId)?.name,
    })),
    chosenNames: Array.from(chosenIds).map((id) => ctx.room.players.get(id)?.name),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

// Minigame "Palavra em Comum"
// Todos escrevem uma palavra livre (sem categoria) tentando combinar com os outros.
// Podem conversar livremente, separado por pessoa, durante os 3 minutos, e mudar a
// palavra quantas vezes quiser. Quem ficar na maioria (mesma palavra) ganha 1 ponto,
// minoria perde 1.

const DURATION_MS = 180000; // 3 minutos
const REVEAL_DISPLAY_MS = 5000;

function normalize(word) {
  return String(word || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default {
  id: "palavra-em-comum",
  name: "Palavra em Comum",
  description: "Escreva uma palavra livre (sem categoria) tentando combinar com os outros. Converse livremente e em segredo com quem quiser, e mude sua palavra quando quiser. Quem ficar na maioria ganha 1 ponto, a minoria perde 1. Mas se TODO MUNDO escrever a mesma palavra, todos perdem ponto.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = { words: new Map(), timer: null, revealTimer: null };

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
    if (data?.type === "submit-word") {
      const word = String(data.word || "").slice(0, 40);
      if (!word.trim()) return;
      state.words.set(playerId, word);
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

  const groups = new Map();
  for (const [pid, word] of state.words.entries()) {
    const key = normalize(word);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pid);
  }

  let maxSize = 0;
  for (const g of groups.values()) maxSize = Math.max(maxSize, g.length);

  const scoresDelta = {};
  const totalAnswered = state.words.size;
  if (groups.size === 1 && maxSize > 1 && maxSize === totalAnswered) {
    // Todo mundo escreveu a mesma palavra: todos perdem ponto (sem graça nenhuma).
    for (const pid of state.words.keys()) scoresDelta[pid] = -1;
  } else if (maxSize > 1) {
    for (const g of groups.values()) {
      const delta = g.length === maxSize ? 1 : -1;
      g.forEach((pid) => (scoresDelta[pid] = delta));
    }
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "word-result",
    words: Array.from(state.words.entries()).map(([id, word]) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      word,
    })),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

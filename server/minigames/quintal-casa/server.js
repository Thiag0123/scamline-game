// Minigame "Quintal ou Casa"
// Cada jogador escolhe secretamente "Quintal" ou "Casa" (pode mudar de ideia quantas
// vezes quiser). Podem conversar livremente, separado por pessoa, durante os 3 minutos
// fixos (cronômetro sincronizado pra todos). Se o número de jogadores no quintal for
// PAR: quintal -1, casa +1. Se for ÍMPAR: quintal +1, casa -1. Quem não escolher é "casa".

const DURATION_MS = 180000; // no mínimo 3 minutos, fixo
const REVEAL_DELAY_MS = 6000;

export default {
  id: "quintal-casa",
  name: "Quintal ou Casa",
  description: "Escolha entre Quintal ou Casa (pode mudar quando quiser). Converse livremente e em segredo com quem quiser. A quantidade de gente no quintal (par ou ímpar) decide quem ganha e quem perde ponto. Dura 3 minutos fixos, cronômetro igual pra todos.",
  minPlayers: 2,
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

    ctx._state.timer = setTimeout(() => finalizeChoice(ctx), DURATION_MS);
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
      if (data.place !== "quintal" && data.place !== "casa") return;
      state.choices.set(playerId, data.place);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function finalizeChoice(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const results = new Map();
  for (const pid of ctx.room.players.keys()) {
    results.set(pid, state.choices.get(pid) || "casa");
  }

  const quintalCount = Array.from(results.values()).filter((v) => v === "quintal").length;
  const quintalIsEven = quintalCount % 2 === 0;

  const scoresDelta = {};
  for (const [pid, place] of results.entries()) {
    if (place === "quintal") {
      scoresDelta[pid] = quintalIsEven ? -1 : 1;
    } else {
      scoresDelta[pid] = quintalIsEven ? 1 : -1;
    }
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "choice-reveal",
    results: Array.from(results.entries()).map(([id, place]) => ({
      id,
      name: ctx.room.players.get(id)?.name,
      place,
    })),
    quintalCount,
    quintalIsEven,
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DELAY_MS);
}

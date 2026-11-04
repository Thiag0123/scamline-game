// Minigame "Símbolos"
// Todos recebem um naipe secreto (♠♥♦♣), mas só conseguem ver o naipe dos OUTROS,
// nunca o próprio. Ganha ponto quem adivinhar corretamente seu próprio naipe.

const SUITS = ["♠", "♥", "♦", "♣"];
const DURATION_MS = 45000;
const REVEAL_DISPLAY_MS = 5000;

export default {
  id: "simbolos",
  name: "Símbolos",
  description: "Todos têm um naipe secreto — você vê o naipe dos outros, mas não o seu. Adivinhe qual é o seu entre os 4 naipes (♠♥♦♣) pra ganhar ponto.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const ids = Array.from(room.players.keys());
    const assignment = new Map(); // playerId -> naipe
    ids.forEach((id) => assignment.set(id, SUITS[Math.floor(Math.random() * SUITS.length)]));

    ctx._state = { assignment, guesses: new Map(), timer: null, revealTimer: null };

    for (const pid of ids) {
      const others = ids
        .filter((id) => id !== pid)
        .map((id) => ({ id, name: room.players.get(id)?.name, suit: assignment.get(id) }));
      io.to(pid).emit("minigame-event", {
        type: "symbols-start",
        others,
        options: SUITS,
        durationMs: DURATION_MS,
      });
    }

    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type !== "submit-guess") return;
    if (state.guesses.has(playerId)) return;
    if (!SUITS.includes(data.suit)) return;
    state.guesses.set(playerId, data.suit);
    if (state.guesses.size === ctx.room.players.size) {
      if (state.timer) clearTimeout(state.timer);
      finalize(ctx);
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
  const reveal = [];
  for (const [pid, actual] of state.assignment.entries()) {
    const guess = state.guesses.get(pid);
    if (guess === actual) scoresDelta[pid] = 1;
    reveal.push({ id: pid, name: ctx.room.players.get(pid)?.name, suit: actual });
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", { type: "symbols-reveal", reveal });
  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

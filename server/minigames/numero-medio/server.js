// Minigame "Número Médio"
// Cada jogador escreve um número. Quem escreveu o número do meio (a mediana) ganha
// 1 ponto. Com número par de jogadores, os dois do meio dividem o ponto se ambos
// estiverem igualmente perto da média entre eles (ou o mais próximo leva sozinho).

const DURATION_MS = 45000;
const REVEAL_DISPLAY_MS = 5000;

export default {
  id: "numero-medio",
  name: "Número Médio",
  description: "Escreva qualquer número, sem limite. Quem escrever o número do meio entre todos (a mediana) ganha 1 ponto.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    ctx._state = { numbers: new Map(), timer: null, revealTimer: null };
    io.to(room.code).emit("minigame-event", { type: "number-prompt", durationMs: DURATION_MS });
    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type !== "submit-number") return;
    const num = Number(data.number);
    if (Number.isNaN(num)) return;
    state.numbers.set(playerId, num);
    if (state.numbers.size === ctx.room.players.size) {
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

  const entries = Array.from(state.numbers.entries()); // [playerId, number]
  const sorted = entries.slice().sort((a, b) => a[1] - b[1]);
  const scoresDelta = {};

  if (sorted.length > 0) {
    if (sorted.length % 2 === 1) {
      const [winnerId] = sorted[(sorted.length - 1) / 2];
      scoresDelta[winnerId] = 1;
    } else {
      const midA = sorted[sorted.length / 2 - 1];
      const midB = sorted[sorted.length / 2];
      const avg = (midA[1] + midB[1]) / 2;
      const diffA = Math.abs(midA[1] - avg);
      const diffB = Math.abs(midB[1] - avg);
      if (diffA === diffB) {
        scoresDelta[midA[0]] = 1;
        scoresDelta[midB[0]] = 1;
      } else if (diffA < diffB) {
        scoresDelta[midA[0]] = 1;
      } else {
        scoresDelta[midB[0]] = 1;
      }
    }
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "number-result",
    numbers: entries.map(([id, num]) => ({ id, name: ctx.room.players.get(id)?.name, number: num })),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

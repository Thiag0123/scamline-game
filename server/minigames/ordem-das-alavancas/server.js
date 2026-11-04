// Minigame "Ordem das Alavancas"
// Existe uma ordem secreta de 4 alavancas (A, B, C, D). Cada jogador recebe 4 dicas
// sobre a ordem (3 verdadeiras + 1 falsa, embaralhadas). Trocam mensagens livremente,
// separadas por pessoa (sem misturar conversas), e podem ajustar o palpite de ordem a
// qualquer momento durante os 3 minutos. Pontuação por alavanca: +1 na posição certa,
// -1 na posição errada.

const LEVERS = ["A", "B", "C", "D"];
const ORDINALS = ["primeira", "segunda", "terceira", "última"];
const DURATION_MS = 180000; // 3 minutos
const REVEAL_DISPLAY_MS = 6000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTrueStatements(secretOrder) {
  const statements = [];
  LEVERS.forEach((lever) => {
    const pos = secretOrder.indexOf(lever) + 1;
    statements.push(`Alavanca ${lever} é a ${ORDINALS[pos - 1]}.`);
  });
  for (let i = 0; i < LEVERS.length; i++) {
    for (let j = i + 1; j < LEVERS.length; j++) {
      const a = LEVERS[i];
      const b = LEVERS[j];
      const posA = secretOrder.indexOf(a);
      const posB = secretOrder.indexOf(b);
      if (posA < posB) statements.push(`Alavanca ${a} vem antes da ${b}.`);
      else statements.push(`Alavanca ${b} vem antes da ${a}.`);
    }
  }
  return statements;
}

function buildFalseStatement(secretOrder) {
  const lever = LEVERS[Math.floor(Math.random() * LEVERS.length)];
  const actualPos = secretOrder.indexOf(lever) + 1;
  let wrongPos;
  do {
    wrongPos = 1 + Math.floor(Math.random() * 4);
  } while (wrongPos === actualPos);
  return `Alavanca ${lever} é a ${ORDINALS[wrongPos - 1]}.`;
}

function isValidPermutation(order) {
  if (!Array.isArray(order) || order.length !== 4) return false;
  const set = new Set(order);
  return LEVERS.every((l) => set.has(l)) && set.size === 4;
}

export default {
  id: "ordem-das-alavancas",
  name: "Ordem das Alavancas",
  description: "Existe uma ordem secreta de 4 alavancas. Vocês recebem dicas (3 verdadeiras, 1 falsa) e trocam mensagens livremente, separadas por pessoa. Ajustem o palpite de ordem quando quiser — vale até o tempo acabar. +1 por alavanca na posição certa, -1 por alavanca errada.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const secretOrder = shuffle(LEVERS);
    const trueStatements = buildTrueStatements(secretOrder);

    ctx._state = {
      secretOrder,
      currentGuess: new Map(), // playerId -> [ordem palpitada]
      timer: null,
      revealTimer: null,
    };

    for (const pid of room.players.keys()) {
      const picks = shuffle(trueStatements).slice(0, 3);
      const hints = shuffle([...picks, buildFalseStatement(secretOrder)]);
      io.to(pid).emit("minigame-event", {
        type: "session-start",
        hints,
        levers: LEVERS,
        durationMs: DURATION_MS,
        players: Array.from(room.players.values())
          .filter((p) => p.id !== pid)
          .map((p) => ({ id: p.id, name: p.name })),
      });
    }

    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type === "chat-message") {
      const targetId = data.targetId;
      if (!ctx.room.players.has(targetId) || targetId === playerId) return;
      const fromName = ctx.room.players.get(playerId)?.name ?? "?";
      ctx.io.to(targetId).emit("minigame-event", {
        type: "chat-message",
        fromId: playerId,
        fromName,
        text: String(data.text || "").slice(0, 300),
      });
      return;
    }
    if (data?.type === "submit-order") {
      if (!isValidPermutation(data.order)) return;
      state.currentGuess.set(playerId, data.order);
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
  for (const pid of ctx.room.players.keys()) {
    const guess = state.currentGuess.get(pid);
    if (!guess) continue;
    let delta = 0;
    guess.forEach((lever, idx) => {
      delta += lever === state.secretOrder[idx] ? 1 : -1;
    });
    scoresDelta[pid] = delta;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    secretOrder: state.secretOrder,
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

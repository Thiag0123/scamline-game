// Minigame "Salas Secretas"
// Cada jogador recebe uma sala secreta (1..N). Durante os 3 minutos, qualquer um pode
// clicar em qualquer número de sala (exceto a própria) e abrir uma conversa anônima com
// quem estiver lá — pode ir e voltar entre conversas livremente, cada uma separada.
// A votação (achar quem é quem) fica aberta o tempo todo e pode mudar até o fim.

const DURATION_MS = 180000; // 3 minutos
const POINTS_PER_CORRECT_GUESS = 20;
const REVEAL_DISPLAY_MS = 6000;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: "salas-secretas",
  name: "Salas Secretas",
  description: "Cada um recebe uma sala secreta. Clique em qualquer número de sala pra conversar com quem estiver lá — pode ir e voltar entre conversas livremente, todas separadas. Tente adivinhar quem é quem: seu palpite vale o que estiver marcado quando os 3 minutos acabarem.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const playerIds = shuffle(Array.from(room.players.keys()));
    const n = playerIds.length;

    const roomAssignment = new Map(); // playerId -> número da sala (1..n)
    playerIds.forEach((pid, idx) => roomAssignment.set(pid, idx + 1));

    ctx._state = {
      playerIds,
      roomAssignment,
      guesses: new Map(), // playerId -> { targetPlayerId: salaPalpitada }
      timer: null,
      revealTimer: null,
    };

    for (const pid of playerIds) {
      io.to(pid).emit("minigame-event", {
        type: "session-start",
        yourRoom: roomAssignment.get(pid),
        numRooms: n,
        players: playerIds
          .filter((otherId) => otherId !== pid)
          .map((otherId) => ({ id: otherId, name: room.players.get(otherId)?.name })),
        durationMs: DURATION_MS,
      });
    }

    ctx._state.timer = setTimeout(() => finalize(ctx), DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (data?.type === "chat-message") {
      const toRoom = Number(data.toRoom);
      const senderRoom = state.roomAssignment.get(playerId);
      if (!senderRoom || toRoom === senderRoom) return;
      const recipientId = state.playerIds.find((pid) => state.roomAssignment.get(pid) === toRoom);
      if (!recipientId) return;
      ctx.io.to(recipientId).emit("minigame-event", {
        type: "chat-message",
        fromRoom: senderRoom,
        text: String(data.text || "").slice(0, 300),
      });
      return;
    }
    if (data?.type === "submit-guess") {
      state.guesses.set(playerId, data.guesses || {});
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
  for (const pid of state.playerIds) {
    const myGuesses = state.guesses.get(pid) || {};
    let correct = 0;
    for (const targetId of state.playerIds) {
      if (targetId === pid) continue;
      const guessed = Number(myGuesses[targetId]);
      const actual = state.roomAssignment.get(targetId);
      if (guessed === actual) correct += 1;
    }
    scoresDelta[pid] = correct * POINTS_PER_CORRECT_GUESS;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "reveal",
    rooms: state.playerIds.map((pid) => ({
      id: pid,
      name: ctx.room.players.get(pid)?.name,
      room: state.roomAssignment.get(pid),
    })),
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

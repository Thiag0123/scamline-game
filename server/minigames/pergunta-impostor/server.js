// Minigame "A Pergunta Diferente"
// Todos recebem a mesma pergunta, exceto 1 jogador (o impostor) que recebe uma pergunta
// diferente. Todos respondem, as respostas são reveladas juntas, e todos votam em quem
// acham que é o impostor. Quem acerta: +1.

const QUESTION_PAIRS = [
  { main: "Qual é a sua cor favorita?", alt: "Qual é a cor que você mais odeia?" },
  { main: "Qual comida você comeria todos os dias?", alt: "Qual comida você nunca comeria?" },
  { main: "Pra onde você viajaria amanhã?", alt: "Pra onde você nunca viajaria?" },
  { main: "Qual filme você recomendaria?", alt: "Qual filme você não recomendaria?" },
  { main: "Qual seu animal favorito?", alt: "Qual animal te dá mais medo?" },
  { main: "O que você faria com 1 milhão de reais?", alt: "O que você nunca faria mesmo com 1 milhão de reais?" },
  { main: "Qual sua estação do ano favorita?", alt: "Qual estação você mais odeia?" },
  { main: "Qual profissão você admira?", alt: "Qual profissão você nunca teria?" },
  { main: "Qual série você maratonaria de novo?", alt: "Qual série você nunca terminaria?" },
  { main: "Qual seu superpoder favorito?", alt: "Qual superpoder você não gostaria de ter?" },
  { main: "Qual esporte você jogaria?", alt: "Qual esporte você nunca praticaria?" },
  { main: "Qual música te anima?", alt: "Qual música te irrita?" },
  { main: "Qual seu doce favorito?", alt: "Qual doce você não suporta?" },
  { main: "Onde você gostaria de morar?", alt: "Onde você nunca moraria?" },
  { main: "Qual seria seu pet ideal?", alt: "Qual animal você nunca teria em casa?" },
  { main: "Qual app você mais usa?", alt: "Qual app você deletaria imediatamente?" },
  { main: "Qual seu clima favorito?", alt: "Qual clima você mais odeia?" },
  { main: "Qual celebridade você conheceria?", alt: "Qual celebridade você evitaria conhecer?" },
];

const ANSWER_DURATION_MS = 40000; // tempo pra responder
const VOTE_DURATION_MS = 110000; // 50s originais + 1 minuto extra pedido
const REVEAL_DISPLAY_MS = 6000;

export default {
  id: "pergunta-impostor",
  name: "A Pergunta Diferente",
  description: "Um jogador recebe uma pergunta diferente dos demais (ele mesmo não sabe disso). Respondam e descubram quem é — inclusive se desconfiar de si mesmo, você pode votar em você.",
  minPlayers: 3,
  maxPlayers: 5,

  start(ctx) {
    const { room, io } = ctx;
    const pair = QUESTION_PAIRS[Math.floor(Math.random() * QUESTION_PAIRS.length)];
    const ids = Array.from(room.players.keys());
    const impostorId = ids[Math.floor(Math.random() * ids.length)];

    ctx._state = {
      pair,
      impostorId,
      answers: new Map(),
      votes: new Map(),
      phase: "answer",
      timer: null,
      revealTimer: null,
      done: false,
    };

    for (const pid of ids) {
      io.to(pid).emit("minigame-event", {
        type: "question-prompt",
        question: pid === impostorId ? pair.alt : pair.main,
        durationMs: ANSWER_DURATION_MS,
      });
    }

    ctx._state.timer = setTimeout(() => startVoting(ctx), ANSWER_DURATION_MS);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done) return;

    if (state.phase === "answer" && data?.type === "submit-answer") {
      if (state.answers.has(playerId)) return;
      state.answers.set(playerId, String(data.text || "").slice(0, 150));
      if (state.answers.size === ctx.room.players.size) startVoting(ctx);
      return;
    }

    if (state.phase === "voting" && data?.type === "vote") {
      if (state.votes.has(playerId)) return;
      if (!ctx.room.players.has(data.targetId)) return;
      state.votes.set(playerId, data.targetId);
      if (state.votes.size === ctx.room.players.size) finalize(ctx);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
    if (ctx._state?.revealTimer) clearTimeout(ctx._state.revealTimer);
  },
};

function startVoting(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  if (state.phase !== "answer") return;
  state.phase = "voting";
  if (state.timer) clearTimeout(state.timer);

  const answersList = Array.from(room.players.keys()).map((id) => ({
    id,
    name: room.players.get(id)?.name,
    answer: state.answers.get(id) || "(não respondeu)",
  }));

  io.to(room.code).emit("minigame-event", {
    type: "answers-reveal",
    mainQuestion: state.pair.main,
    altQuestion: state.pair.alt,
    answers: answersList,
    durationMs: VOTE_DURATION_MS,
  });

  state.timer = setTimeout(() => finalize(ctx), VOTE_DURATION_MS);
}

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  const scoresDelta = {};
  for (const [voterId, targetId] of state.votes.entries()) {
    if (targetId === state.impostorId) scoresDelta[voterId] = 1;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "impostor-reveal",
    impostorName: ctx.room.players.get(state.impostorId)?.name,
    altQuestion: state.pair.alt,
  });

  ctx._state.revealTimer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

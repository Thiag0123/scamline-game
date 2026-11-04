// Minigame "Quiz Geral"
// 5 perguntas de múltipla escolha, sorteadas de um banco. Quem acertar mais: +1
// (empate no topo: todos os empatados ganham).

const QUESTION_BANK = [
  { text: "Qual é o maior planeta do sistema solar?", options: ["Terra", "Júpiter", "Saturno", "Marte"], correct: 1 },
  { text: "Quantos lados tem um hexágono?", options: ["5", "6", "7", "8"], correct: 1 },
  { text: "Qual é a capital da França?", options: ["Londres", "Roma", "Paris", "Berlim"], correct: 2 },
  { text: "Quem pintou a Mona Lisa?", options: ["Van Gogh", "Da Vinci", "Picasso", "Monet"], correct: 1 },
  { text: "Qual é o maior oceano do mundo?", options: ["Atlântico", "Índico", "Ártico", "Pacífico"], correct: 3 },
  { text: "Em que ano começou a Segunda Guerra Mundial?", options: ["1935", "1939", "1941", "1945"], correct: 1 },
  { text: "Qual é o metal líquido à temperatura ambiente?", options: ["Ferro", "Mercúrio", "Ouro", "Chumbo"], correct: 1 },
  { text: "Quantos ossos tem o corpo humano adulto?", options: ["186", "206", "226", "246"], correct: 1 },
  { text: "Qual é o rio mais longo do mundo?", options: ["Nilo", "Amazonas", "Yangtzé", "Mississippi"], correct: 1 },
  { text: "Quem escreveu Dom Casmurro?", options: ["José de Alencar", "Machado de Assis", "Clarice Lispector", "Graciliano Ramos"], correct: 1 },
  { text: "Qual gás os humanos exalam ao respirar?", options: ["Oxigênio", "Hidrogênio", "Gás carbônico", "Nitrogênio"], correct: 2 },
  { text: "Qual país tem o formato de uma bota?", options: ["Espanha", "Grécia", "Itália", "Portugal"], correct: 2 },
  { text: "Quantos minutos tem uma partida de futebol (sem prorrogação)?", options: ["80", "90", "100", "120"], correct: 1 },
  { text: "Qual é o menor país do mundo?", options: ["Mônaco", "San Marino", "Vaticano", "Liechtenstein"], correct: 2 },
  { text: "Quem foi o primeiro presidente do Brasil?", options: ["Getúlio Vargas", "Deodoro da Fonseca", "Dom Pedro II", "Juscelino Kubitschek"], correct: 1 },
  { text: "Qual é o maior mamífero do mundo?", options: ["Elefante africano", "Baleia azul", "Girafa", "Tubarão-baleia"], correct: 1 },
  { text: "Quantos continentes existem?", options: ["5", "6", "7", "8"], correct: 2 },
  { text: "Qual elemento químico tem símbolo 'O'?", options: ["Ouro", "Oxigênio", "Ósmio", "Osso"], correct: 1 },
  { text: "Em que país fica a Torre Eiffel?", options: ["Itália", "Espanha", "França", "Alemanha"], correct: 2 },
  { text: "Qual é a moeda oficial do Japão?", options: ["Yuan", "Won", "Iene", "Rúpia"], correct: 2 },
  { text: "Quantos jogadores tem um time de vôlei em quadra?", options: ["5", "6", "7", "11"], correct: 1 },
  { text: "Qual desses NÃO é um planeta do sistema solar?", options: ["Vênus", "Plutão", "Marte", "Netuno"], correct: 1 },
  { text: "Quem escreveu Romeu e Julieta?", options: ["Shakespeare", "Dante", "Molière", "Cervantes"], correct: 0 },
  { text: "Qual é o osso mais longo do corpo humano?", options: ["Úmero", "Fêmur", "Tíbia", "Fíbula"], correct: 1 },
];

const NUM_QUESTIONS = 5;
const QUESTION_DURATION_MS = 20000; // tempo pra pensar em cada pergunta
const REVEAL_DISPLAY_MS = 6000;
const NEXT_QUESTION_DELAY_MS = 2500;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  id: "quiz-geral",
  name: "Quiz Geral",
  description: "5 perguntas de conhecimentos gerais. Quem acertar mais, ganha ponto.",
  minPlayers: 2,
  maxPlayers: 5,

  start(ctx) {
    const questions = shuffle(QUESTION_BANK).slice(0, NUM_QUESTIONS);
    ctx._state = {
      questions,
      index: 0,
      answers: new Map(), // playerId -> array de respostas certas (bool por questão)
      correctCount: new Map(),
      timer: null,
      done: false,
    };
    for (const pid of ctx.room.players.keys()) ctx._state.correctCount.set(pid, 0);
    askQuestion(ctx);
  },

  onAction(ctx, playerId, data) {
    const state = ctx._state;
    if (state.done || data?.type !== "submit-answer") return;
    if (data.index !== state.index) return;
    if (state.answers.has(playerId)) return;

    state.answers.set(playerId, data.choice);
    const q = state.questions[state.index];
    if (data.choice === q.correct) {
      state.correctCount.set(playerId, (state.correctCount.get(playerId) || 0) + 1);
    }

    if (state.answers.size === ctx.room.players.size) {
      if (state.timer) clearTimeout(state.timer);
      revealAndAdvance(ctx);
    }
  },

  end(ctx) {
    if (ctx._state?.timer) clearTimeout(ctx._state.timer);
  },
};

function askQuestion(ctx) {
  const { room, io } = ctx;
  const state = ctx._state;
  state.answers = new Map();
  const q = state.questions[state.index];

  io.to(room.code).emit("minigame-event", {
    type: "question",
    index: state.index,
    total: state.questions.length,
    text: q.text,
    options: q.options,
    durationMs: QUESTION_DURATION_MS,
  });

  state.timer = setTimeout(() => revealAndAdvance(ctx), QUESTION_DURATION_MS);
}

function revealAndAdvance(ctx) {
  const state = ctx._state;
  const q = state.questions[state.index];
  ctx.io.to(ctx.room.code).emit("minigame-event", {
    type: "question-result",
    index: state.index,
    correct: q.correct,
  });
  state.timer = setTimeout(() => nextQuestion(ctx), NEXT_QUESTION_DELAY_MS);
}

function nextQuestion(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.index += 1;
  if (state.index >= state.questions.length) {
    finalize(ctx);
  } else {
    askQuestion(ctx);
  }
}

function finalize(ctx) {
  const state = ctx._state;
  if (state.done) return;
  state.done = true;
  if (state.timer) clearTimeout(state.timer);

  let maxCorrect = 0;
  for (const c of state.correctCount.values()) maxCorrect = Math.max(maxCorrect, c);

  const scoresDelta = {};
  const results = [];
  for (const [pid, count] of state.correctCount.entries()) {
    results.push({ id: pid, name: ctx.room.players.get(pid)?.name, correct: count });
    if (maxCorrect > 0 && count === maxCorrect) scoresDelta[pid] = 1;
  }

  ctx.io.to(ctx.room.code).emit("minigame-event", { type: "quiz-result", results });
  state.timer = setTimeout(() => ctx.finish(scoresDelta), REVEAL_DISPLAY_MS);
}

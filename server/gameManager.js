// gameManager.js
// Orquestra a partida: sequência de rodadas (sem repetir minigame até esgotar o pool),
// tela de espera + explicação antes de cada minigame, pontuação acumulada (só revelada
// no final, sincronizada pro servidor pra todos verem a mesma coisa ao mesmo tempo),
// desempate via minigame extra, e retorno ao lobby (não à tela inicial) ao terminar.

import { listMinigames, getMinigame } from "./minigameManager.js";

const roundTimers = new Map();
const safetyTimers = new Map();
const beginTimers = new Map();
const revealTimers = new Map();
const tiebreakerTimers = new Map();

const SAFETY_TIMEOUT_MS = 5 * 60 * 1000;
const WAIT_BEFORE_START_MS = 10000;
const EXPLAIN_DURATION_MS = 15000;
const REVEAL_STEP_DURATION_MS = 6000; // quanto tempo cada rodada fica visível na revelação final
const TIEBREAKER_ROUND_MS = 12000; // tempo de cada rodada de desempate

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickMinigameQueue(room, totalRounds, selectedMinigameIds) {
  const available = listMinigames();
  let pool = available.filter(
    (mg) => room.players.size >= mg.minPlayers && room.players.size <= mg.maxPlayers
  );
  if (Array.isArray(selectedMinigameIds) && selectedMinigameIds.length > 0) {
    const selectedSet = new Set(selectedMinigameIds);
    const filtered = pool.filter((mg) => selectedSet.has(mg.id));
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) pool = available;

  const queue = [];
  let lastId = null;
  while (queue.length < totalRounds) {
    const batch = shuffle(pool);
    if (lastId && batch.length > 1 && batch[0].id === lastId) {
      const swapIdx = 1 + Math.floor(Math.random() * (batch.length - 1));
      [batch[0], batch[swapIdx]] = [batch[swapIdx], batch[0]];
    }
    for (const mg of batch) {
      if (queue.length >= totalRounds) break;
      queue.push(mg.id);
    }
    lastId = queue[queue.length - 1];
  }
  return queue;
}

function startGame(io, room, { totalRounds = 10, selectedMinigameIds = [] } = {}) {
  room.state = "playing";
  room.round = 0;
  room.maxRounds = totalRounds;
  room.minigameQueue = pickMinigameQueue(room, totalRounds, selectedMinigameIds);
  room.history = [];
  for (const p of room.players.values()) p.score = 0;

  io.to(room.code).emit("game-started", { totalRounds: room.maxRounds });
  nextRound(io, room);
}

function nextRound(io, room) {
  room.round += 1;
  if (room.round > room.maxRounds) {
    finishGame(io, room);
    return;
  }

  const minigameId = room.minigameQueue[room.round - 1];
  const minigame = getMinigame(minigameId);
  if (!minigame) {
    console.error(`Minigame "${minigameId}" não encontrado, pulando rodada.`);
    nextRound(io, room);
    return;
  }

  room.currentMinigame = { id: minigameId, def: minigame };

  io.to(room.code).emit("round-start", {
    round: room.round,
    totalRounds: room.maxRounds,
    minigameId: minigame.id,
    minigameName: minigame.name,
    description: minigame.description || "",
    waitMs: WAIT_BEFORE_START_MS,
    explainMs: EXPLAIN_DURATION_MS,
  });

  const beginTimer = setTimeout(() => beginMinigame(io, room), WAIT_BEFORE_START_MS + EXPLAIN_DURATION_MS);
  beginTimers.set(room.code, beginTimer);
}

function beginMinigame(io, room) {
  const entry = room.currentMinigame;
  if (!entry) return;
  const minigame = entry.def;

  const ctx = { room, io, finish: (scoresDelta = {}) => finishRound(io, room, scoresDelta) };
  entry.ctx = ctx;

  io.to(room.code).emit("minigame-begin", {});
  minigame.start(ctx);

  if (minigame.durationMs) {
    const timer = setTimeout(() => finishRound(io, room, {}), minigame.durationMs);
    roundTimers.set(room.code, timer);
  }

  const safetyTimer = setTimeout(() => {
    console.warn(`[gameManager] Rodada ${room.round} (${entry.id}) excedeu o limite de segurança, encerrando.`);
    finishRound(io, room, {});
  }, SAFETY_TIMEOUT_MS);
  safetyTimers.set(room.code, safetyTimer);
}

function finishRound(io, room, scoresDelta) {
  if (!room.currentMinigame) return;

  clearRoomTimers(room.code);
  const minigameName = room.currentMinigame?.def?.name ?? "?";

  if (room.currentMinigame?.def?.end) {
    try {
      room.currentMinigame.def.end(room.currentMinigame.ctx);
    } catch (err) {
      console.error("Erro no end() do minigame:", err);
    }
  }

  for (const [playerId, delta] of Object.entries(scoresDelta)) {
    const player = room.players.get(playerId);
    if (player) player.score = Math.max(0, player.score + delta);
  }

  room.history.push({
    round: room.round,
    minigameName,
    changes: Object.entries(scoresDelta)
      .filter(([, delta]) => delta !== 0)
      .map(([playerId, delta]) => ({
        id: playerId,
        name: room.players.get(playerId)?.name ?? "?",
        delta,
      })),
  });

  room.currentMinigame = null;
  io.to(room.code).emit("round-end", { round: room.round });
  setTimeout(() => nextRound(io, room), 300);
}

function clearRoomTimers(roomCode) {
  for (const map of [roundTimers, safetyTimers, beginTimers, revealTimers, tiebreakerTimers]) {
    const t = map.get(roomCode);
    if (t) clearTimeout(t);
    map.delete(roomCode);
  }
}

// ---------- FIM DE PARTIDA: revelação sincronizada + desempate + volta ao lobby ----------

function finishGame(io, room) {
  room.state = "finished";
  revealHistoryStep(io, room, 0);
}

// Revela a história rodada por rodada, controlada pelo SERVIDOR (não pelo cliente),
// pra garantir que todos os jogadores vejam exatamente a mesma coisa ao mesmo tempo.
function revealHistoryStep(io, room, index) {
  if (index >= room.history.length) {
    resolveRankingWithTiebreakers(io, room);
    return;
  }
  io.to(room.code).emit("final-reveal-step", {
    index,
    total: room.history.length,
    entry: room.history[index],
  });
  const timer = setTimeout(() => revealHistoryStep(io, room, index + 1), REVEAL_STEP_DURATION_MS);
  revealTimers.set(room.code, timer);
}

function resolveRankingWithTiebreakers(io, room) {
  const players = Array.from(room.players.values());
  const maxScore = Math.max(...players.map((p) => p.score));
  const tiedForFirst = players.filter((p) => p.score === maxScore);
  if (tiedForFirst.length <= 1) {
    announceFinalRanking(io, room);
    return;
  }

  io.to(room.code).emit("tiebreaker-needed", {
    players: tiedForFirst.map((p) => ({ id: p.id, name: p.name })),
  });

  setTimeout(() => runTiebreaker(io, room, tiedForFirst.map((p) => p.id)), 3000);
}

function runTiebreaker(io, room, tiedIds) {
  const game = Math.random() < 0.5 ? "rps" : "bar";
  const candidates = tiedIds.map((id) => room.players.get(id)).filter(Boolean);
  const names = candidates.map((p) => ({ id: p.id, name: p.name }));

  io.to(room.code).emit("tiebreaker-round-start", { game, players: names });

  const picks = new Map(); // playerId -> escolha (rps: "pedra"|"papel"|"tesoura"; bar: número 0-100)
  const state = { done: false };

  const handler = (io2, room2, playerId, data) => {
    if (state.done) return;
    if (!tiedIds.includes(playerId)) return;
    if (data?.type === "tiebreaker-pick") {
      picks.set(playerId, data.value);
      if (picks.size === tiedIds.length) resolve();
    }
  };
  room._tiebreakerHandler = handler;

  const timer = setTimeout(resolve, TIEBREAKER_ROUND_MS);
  tiebreakerTimers.set(room.code, timer);

  function resolve() {
    if (state.done) return;
    state.done = true;
    clearTimeout(timer);
    tiebreakerTimers.delete(room.code);
    room._tiebreakerHandler = null;

    let winners;
    if (game === "rps") {
      winners = resolveRPS(tiedIds, picks);
    } else {
      winners = resolveBar(tiedIds, picks);
    }

    io.to(room.code).emit("tiebreaker-round-result", {
      game,
      picks: Array.from(picks.entries()).map(([id, value]) => ({
        id,
        name: room.players.get(id)?.name,
        value,
      })),
      winners: winners.map((id) => ({ id, name: room.players.get(id)?.name })),
    });

    setTimeout(() => {
      if (winners.length === 1) {
        announceFinalRanking(io, room, winners[0]);
      } else {
        runTiebreaker(io, room, winners);
      }
    }, 4000);
  }
}

function resolveRPS(ids, picks) {
  const beats = { pedra: "tesoura", papel: "pedra", tesoura: "papel" };
  const resolvedMoves = new Map();
  const movesUsed = new Set();
  for (const id of ids) {
    const move = picks.get(id) || ["pedra", "papel", "tesoura"][Math.floor(Math.random() * 3)];
    resolvedMoves.set(id, move);
    movesUsed.add(move);
  }
  if (movesUsed.size === 1 || movesUsed.size === 3) {
    return ids; // empate total (todos iguais, ou os 3 tipos presentes) -> repete
  }
  // exatamente 2 tipos em jogo: um bate o outro
  const [moveA, moveB] = Array.from(movesUsed);
  const winningMove = beats[moveA] === moveB ? moveA : moveB;
  return ids.filter((id) => resolvedMoves.get(id) === winningMove);
}

function resolveBar(ids, picks) {
  let best = null;
  let bestDiff = Infinity;
  let winners = [];
  for (const id of ids) {
    const value = typeof picks.get(id) === "number" ? picks.get(id) : Math.random() * 100;
    const diff = Math.abs(100 - value);
    if (diff < bestDiff - 0.001) {
      bestDiff = diff;
      winners = [id];
    } else if (Math.abs(diff - bestDiff) < 0.001) {
      winners.push(id);
    }
  }
  return winners.length ? winners : ids;
}

function announceFinalRanking(io, room, tiebreakWinnerId) {
  let ranking = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));

  if (tiebreakWinnerId) {
    // reordena colocando o vencedor do desempate em 1º
    ranking = [
      ranking.find((p) => p.id === tiebreakWinnerId),
      ...ranking.filter((p) => p.id !== tiebreakWinnerId),
    ];
  }

  io.to(room.code).emit("game-finished-ranking", { ranking });

  // Volta todo mundo pro lobby (não pra tela inicial), pronto pra outra partida.
  setTimeout(() => {
    room.state = "lobby";
    room.currentMinigame = null;
    room.history = [];
    for (const p of room.players.values()) {
      p.ready = false;
      p.score = 0;
    }
    io.to(room.code).emit("return-to-lobby", roomToLobbyStateInline(room));
  }, 6000);
}

function roomToLobbyStateInline(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.connected,
      ready: p.ready,
      avatar: p.avatar,
    })),
  };
}

function handlePlayerAction(io, room, playerId, data) {
  if (room._tiebreakerHandler) {
    room._tiebreakerHandler(io, room, playerId, data);
    return;
  }
  const mg = room.currentMinigame;
  if (!mg || !mg.ctx) return;
  try {
    mg.def.onAction(mg.ctx, playerId, data);
  } catch (err) {
    console.error("Erro no onAction() do minigame:", err);
  }
}

export { startGame, handlePlayerAction };

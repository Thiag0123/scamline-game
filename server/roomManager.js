// roomManager.js
// Controla as salas (lobbies): criação, entrada, saída, e o estado de cada jogador.

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem letras ambíguas (I, O)
const MAX_PLAYERS = 5;
const AVATARS = Array.from({ length: 16 }, (_, i) => `avatar-${String(i + 1).padStart(2, "0")}.png`);

const rooms = new Map(); // code -> room

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom(hostSocketId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId: hostSocketId,
    state: "lobby", // lobby | playing | finished
    players: new Map(), // socketId -> player
    round: 0,
    maxRounds: 0,
    minigameQueue: [],
    currentMinigame: null, // { id, moduleInstance }
    history: [],
  };
  room.players.set(hostSocketId, makePlayer(hostSocketId, hostName));
  rooms.set(code, room);
  return room;
}

function makePlayer(id, name) {
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  return { id, name, score: 0, connected: true, ready: false, avatar };
}

function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: "Sala não encontrada." };
  if (room.state !== "lobby") return { error: "A partida já começou." };
  if (room.players.size >= MAX_PLAYERS) return { error: "Sala cheia (máx. 5 jogadores)." };
  room.players.set(socketId, makePlayer(socketId, name));
  return { room };
}

function leaveRoom(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) {
      room.players.delete(socketId);
      // Se o host saiu, passa a liderança para o próximo jogador
      if (room.hostId === socketId) {
        const next = room.players.keys().next();
        if (!next.done) room.hostId = next.value;
      }
      // Sala vazia -> remove
      if (room.players.size === 0) {
        rooms.delete(room.code);
      }
      return room;
    }
  }
  return null;
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

function getRoom(code) {
  return rooms.get(code);
}

function setAvatar(socketId, avatar) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  const player = room.players.get(socketId);
  if (!player) return null;
  if (!AVATARS.includes(avatar)) return null;
  player.avatar = avatar;
  return room;
}

function roomToLobbyState(room) {
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

export {
  MAX_PLAYERS,
  AVATARS,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomBySocket,
  getRoom,
  setAvatar,
  roomToLobbyState,
};

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import {
  MAX_PLAYERS,
  AVATARS,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomBySocket,
  getRoom,
  setAvatar,
  roomToLobbyState,
} from "./roomManager.js";
import { loadMinigames, listMinigames } from "./minigameManager.js";
import { startGame, handlePlayerAction } from "./gameManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(path.join(__dirname, "..", "public")));

io.on("connection", (socket) => {
  socket.on("create-room", ({ name }, cb) => {
    const playerName = (name || "Jogador").trim().slice(0, 20);
    const room = createRoom(socket.id, playerName);
    socket.join(room.code);
    cb?.({ ok: true, room: roomToLobbyState(room) });
  });

  socket.on("join-room", ({ code, name }, cb) => {
    const playerName = (name || "Jogador").trim().slice(0, 20);
    const result = joinRoom((code || "").toUpperCase(), socket.id, playerName);
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    socket.join(result.room.code);
    cb?.({ ok: true, room: roomToLobbyState(result.room) });
    io.to(result.room.code).emit("lobby-update", roomToLobbyState(result.room));
  });

  socket.on("list-avatars", (cb) => cb?.(AVATARS));

  socket.on("set-avatar", ({ avatar } = {}) => {
    const room = setAvatar(socket.id, avatar);
    if (room) io.to(room.code).emit("lobby-update", roomToLobbyState(room));
  });

  socket.on("toggle-ready", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.ready = !player.ready;
    io.to(room.code).emit("lobby-update", roomToLobbyState(room));
  });

  socket.on("list-minigames", (cb) => {
    cb?.(
      listMinigames().map((mg) => ({
        id: mg.id,
        name: mg.name,
        description: mg.description || "",
        minPlayers: mg.minPlayers,
        maxPlayers: mg.maxPlayers,
      }))
    );
  });

  socket.on("start-game", ({ totalRounds, selectedMinigameIds } = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return; // só o host inicia
    if (room.players.size < 2) return; // precisa de pelo menos 2 (ideal: 5)
    startGame(io, room, { totalRounds: totalRounds || 10, selectedMinigameIds });
  });

  socket.on("minigame-action", (data) => {
    const room = getRoomBySocket(socket.id);
    if (!room || (room.state !== "playing" && room.state !== "finished")) return;
    handlePlayerAction(io, room, socket.id, data);
  });

  socket.on("disconnect", () => {
    const room = leaveRoom(socket.id);
    if (room) {
      io.to(room.code).emit("lobby-update", roomToLobbyState(room));
    }
  });
});

const PORT = process.env.PORT || 3000;

loadMinigames().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
});

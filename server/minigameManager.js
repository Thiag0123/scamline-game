// minigameManager.js
// Descobre automaticamente os minigames dentro de server/minigames/<id>/server.js
// e expõe uma interface padrão para o orquestrador de rodadas usar.
//
// INTERFACE que cada minigame precisa exportar (default export):
// {
//   id: "nome-unico",
//   name: "Nome bonito exibido na tela",
//   minPlayers: 2,
//   maxPlayers: 5,
//   durationMs: 10000,               // tempo da rodada (opcional, o próprio minigame pode terminar antes)
//   start(ctx),                      // chamado quando a rodada começa
//   onAction(ctx, playerId, data),   // chamado quando um jogador envia uma ação
//   end(ctx)                         // opcional: limpeza ao terminar (timers, etc)
// }
//
// "ctx" (contexto) fornecido pelo manager para o minigame:
// {
//   room,                  // objeto da sala
//   io,                     // instância do socket.io (pra emitir eventos)
//   finish(scoresDelta)     // chame quando o minigame acabar. scoresDelta = { [playerId]: pontos }
// }

import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIGAMES_DIR = path.join(__dirname, "minigames");

const registry = new Map(); // id -> module

async function loadMinigames() {
  const folders = readdirSync(MINIGAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of folders) {
    try {
      const modUrl = path.join(MINIGAMES_DIR, folder, "server.js");
      const mod = await import(`file://${modUrl}`);
      const def = mod.default;
      if (!def || !def.id) {
        console.warn(`[minigameManager] Ignorando "${folder}": export default inválido.`);
        continue;
      }
      registry.set(def.id, def);
      console.log(`[minigameManager] Minigame carregado: ${def.id} (${def.name})`);
    } catch (err) {
      console.error(`[minigameManager] Erro ao carregar "${folder}":`, err);
    }
  }
}

function listMinigames() {
  return Array.from(registry.values());
}

function getMinigame(id) {
  return registry.get(id);
}

export { loadMinigames, listMinigames, getMinigame };

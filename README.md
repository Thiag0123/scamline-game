# Jogo da Escamação

Jogo multiplayer de minigames para navegador, feito com Node.js, Express e Socket.IO.

## Executar localmente

Requer Node.js e npm.

```bash
npm ci
npm start
```

Abra `http://localhost:3000` no navegador. Para testar com outras pessoas na mesma rede, use o endereço IP local desta máquina e a porta `3000`.

## Publicar no Render

1. Envie esta pasta do projeto para um repositório GitHub. O `node_modules/` e arquivos `.env` são ignorados pelo Git.
2. No Render, crie um **Blueprint** e conecte o repositório.
3. Se o repositório contiver esta aplicação dentro de uma subpasta, configure essa subpasta como **Root Directory**. O `render.yaml` precisa estar na raiz selecionada.
4. O Blueprint usa `npm ci` para instalar dependências e `npm start` para iniciar o servidor. Após o deploy, abra a URL HTTPS gerada pelo Render.
5. Teste criar uma sala, entrar usando o código em outro navegador/dispositivo e concluir uma partida.

O endpoint `/health` é usado pelo Render para verificar se o servidor está respondendo. O plano gratuito pode suspender o serviço após períodos sem uso e causar demora na primeira conexão; confira os limites e preços atuais do Render.

## Observações

- Salas e partidas ficam na memória do processo; reiniciar ou publicar uma nova versão encerra partidas em andamento.
- Mantenha uma única instância do servidor: múltiplas instâncias não compartilham o estado das salas.

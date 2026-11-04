import { clearCountdown, escapeHtml, renderPlayerButtonList } from "/js/minigame-helpers.js";

let els = {};
let sendActionRef = null;
let myIdRef = null;

export default {
  mount({ container, sendAction, myId }) {
    sendActionRef = sendAction;
    myIdRef = myId;
    els.container = container;
    container.innerHTML = `<p class="hint">Preparando a batata...</p>`;
  },

  onEvent(payload) {
    const container = els.container;
    if (!container) return;

    if (payload.type === "potato-holder") {
      const isMe = payload.holderId === myIdRef;
      const avatarsHtml = payload.alive
        .map((p) => window.__avatarImgHtml ? window.__avatarImgHtml(p.id, 46) : "")
        .join(" ");
      container.innerHTML = `
        <p style="font-size:2rem;">🥔</p>
        <p>${avatarsHtml}</p>
        <p>${isMe ? "<b>Você está com a batata!</b> Passe pra alguém antes que exploda." : `<b>${escapeHtml(payload.holderName)}</b> está com a batata...`}</p>
        ${isMe ? `<div id="pass-list" style="text-align:left;"></div>` : ""}
      `;
      if (isMe) {
        const others = payload.alive.filter((p) => p.id !== myIdRef);
        renderPlayerButtonList(container.querySelector("#pass-list"), others, (p) =>
          sendActionRef({ type: "pass-potato", targetId: p.id })
        );
      }
    } else if (payload.type === "explosion") {
      const msg = document.createElement("p");
      msg.style.fontSize = "1.2rem";
      msg.innerHTML = `💥 <b>${escapeHtml(payload.burnedName)}</b> explodiu com a batata e perdeu 1 ponto!`;
      container.prepend(msg);
    } else if (payload.type === "reveal") {
      container.innerHTML = `<p>Sobreviventes: <b>${escapeHtml((payload.survivors || []).join(", "))}</b></p>`;
    }
  },

  unmount() {
    clearCountdown();
    els = {};
    sendActionRef = null;
    myIdRef = null;
  },
};

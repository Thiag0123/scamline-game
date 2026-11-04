// multichat-ui.js
// Componente reutilizável: lista de contatos à esquerda + conversa ativa à direita.
// Cada contato tem sua própria thread de mensagens, sem misturar. Usado por vários
// minigames que precisam de "conversar com quem quiser, na hora que quiser".

import { escapeHtml } from "./minigame-helpers.js";

export function createMultiChatUI({ container, contacts, onSend, initialActiveId }) {
  const threads = new Map(); // contactId -> [{fromMe, text}]
  contacts.forEach((c) => threads.set(c.id, []));
  let activeId = initialActiveId ?? (contacts[0] && contacts[0].id);

  container.innerHTML = `
    <div class="mchat-wrap">
      <div class="mchat-contacts" id="mchat-contacts"></div>
      <div class="mchat-thread">
        <div class="mchat-messages" id="mchat-messages"></div>
        <div class="mchat-input-row">
          <input id="mchat-input" type="text" placeholder="Mensagem..." maxlength="250" />
          <button id="mchat-send">➤</button>
        </div>
      </div>
    </div>
  `;

  const contactsEl = container.querySelector("#mchat-contacts");
  const messagesEl = container.querySelector("#mchat-messages");
  const inputEl = container.querySelector("#mchat-input");
  const sendBtn = container.querySelector("#mchat-send");

  function renderContacts() {
    contactsEl.innerHTML = "";
    contacts.forEach((c) => {
      const div = document.createElement("div");
      div.className = "mchat-contact" + (c.id === activeId ? " active" : "") + (c.unread ? " unread" : "");
      div.innerHTML = c.labelHtml || escapeHtml(c.label || "");
      div.addEventListener("click", () => {
        activeId = c.id;
        c.unread = false;
        renderContacts();
        renderMessages();
      });
      contactsEl.appendChild(div);
    });
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    const thread = threads.get(activeId) || [];
    thread.forEach((m) => {
      const div = document.createElement("div");
      div.innerHTML = m.fromMe
        ? `<b style="color:#8aff8a">Você:</b> ${escapeHtml(m.text)}`
        : `<b style="color:#ffb84d">${escapeHtml(m.fromLabel || "Outro")}:</b> ${escapeHtml(m.text)}`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function send() {
    const text = inputEl.value.trim();
    if (!text || !activeId) return;
    threads.get(activeId).push({ fromMe: true, text });
    onSend(activeId, text);
    inputEl.value = "";
    renderMessages();
  }

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => e.key === "Enter" && send());

  renderContacts();
  renderMessages();

  return {
    // Chamado quando uma mensagem chega de outro jogador/sala.
    receiveMessage(contactId, fromLabel, text) {
      if (!threads.has(contactId)) threads.set(contactId, []);
      threads.get(contactId).push({ fromMe: false, fromLabel, text });
      const contact = contacts.find((c) => c.id === contactId);
      if (contact && contactId !== activeId) contact.unread = true;
      renderContacts();
      if (contactId === activeId) renderMessages();
    },
  };
}

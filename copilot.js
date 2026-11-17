import { aiApiBaseUrl, auth } from './firebase.js';

const $ = (selector) => document.querySelector(selector);
const panel = $('#copilotPanel');
const messagesElement = $('#copilotMessages');
const form = $('#copilotForm');
const input = $('#copilotInput');
const status = $('#copilotStatus');
const sendButton = $('#copilotSend');
const conversation = [];
const greeting = 'Pergunte sobre bloqueios, lançamento ou distribuição de tarefas.';
let boardId = window.kanbanActiveBoardId || null;

function showPanel(show) {
  panel.hidden = !show;
  $('#copilotToggle').setAttribute('aria-expanded', String(show));
  if (show) input.focus();
}

function addMessage(role, text) {
  const message = document.createElement('p');
  message.className = `copilot-message ${role}`;
  message.textContent = text;
  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function setStatus(text, isError = false) {
  status.textContent = text;
  status.classList.toggle('is-error', isError);
}

function resetConversation() {
  conversation.length = 0;
  messagesElement.replaceChildren();
  addMessage('assistant', greeting);
}

function apiUrl(path) {
  return `${aiApiBaseUrl}${path}`;
}

$('#copilotToggle').addEventListener('click', () => showPanel(panel.hidden));
$('#copilotClose').addEventListener('click', () => showPanel(false));

window.addEventListener('kanban:board-change', (event) => {
  const nextBoardId = event.detail?.boardId || null;
  if (boardId !== nextBoardId) resetConversation();
  boardId = nextBoardId;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = input.value.trim();
  const user = auth.currentUser;
  if (!question) return;
  if (!user) {
    setStatus('Entre para usar o assistente.', true);
    return;
  }
  if (!boardId) {
    setStatus('O quadro ainda está carregando. Tente novamente em instantes.', true);
    return;
  }

  let historyChars = 4_000;
  const history = conversation.slice(-6).reverse().map((message) => {
    const text = message.text.slice(0, Math.min(1_200, historyChars));
    historyChars -= text.length;
    return { role: message.role, text };
  }).reverse().filter((message) => message.text);
  conversation.push({ role: 'user', text: question });
  addMessage('user', question);
  input.value = '';
  sendButton.disabled = true;
  setStatus('Consultando o quadro...');

  try {
    const token = await user.getIdToken();
    const response = await fetch(apiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ boardId, question, history })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível consultar o assistente.');
    }
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) {
      throw new Error('O assistente retornou uma resposta vazia. Tente novamente.');
    }
    conversation.push({ role: 'assistant', text: payload.reply });
    if (conversation.length > 30) conversation.splice(0, conversation.length - 30);
    addMessage('assistant', payload.reply);
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Falha ao falar com o assistente. Tente novamente.', true);
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});
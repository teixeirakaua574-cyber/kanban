import { aiApiBaseUrl, auth, db } from './firebase.js';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $ = (selector) => document.querySelector(selector);
const routeParts = window.location.pathname.split('/').filter(Boolean);
const taskId = decodeURIComponent(routeParts.length > 1 && routeParts[routeParts.length - 2] === 'tasks'
  ? routeParts[routeParts.length - 1]
  : new URLSearchParams(window.location.search).get('id') || '');
let currentUser = null;
let task = null;
let board = null;
let comments = [];
let unsubscribeTask = null;
let unsubscribeBoard = null;
let unsubscribeComments = null;
let isCreatingAccount = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showMessage(message, isError = false) {
  const element = $('#taskMessage');
  element.textContent = message;
  element.classList.toggle('is-error', isError);
  element.hidden = !message;
}

function editor() {
  const role = board?.members?.[currentUser?.uid];
  return role === 'OWNER' || role === 'EDITOR';
}

function hasMention(text, email) {
  const normalizedText = text.toLowerCase();
  const mention = `@${email.toLowerCase()}`;
  let start = normalizedText.indexOf(mention);
  while (start !== -1) {
    const before = normalizedText[start - 1];
    const after = normalizedText[start + mention.length];
    if ((!before || /[\s([{]/.test(before)) && (!after || /[\s,.;:!?)}\]]/.test(after))) {
      return true;
    }
    start = normalizedText.indexOf(mention, start + mention.length);
  }
  return false;
}

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Agora';
  return timestamp.toDate().toLocaleString('pt-BR');
}

function renderTask() {
  if (!task || !board) return;
  const column = board.columns?.find((item) => item.id === task.status);
  $('#taskBoardName').textContent = `${board.name} · ${column?.name || task.status}`;
  $('#taskDetails').innerHTML = `
    <h1>${esc(task.title)}</h1>
    <p class="task-detail-description">${esc(task.description || 'Sem descrição.')}</p>
    <div class="task-meta">
      <span class="meta-badge">${esc(Number(task.storyPoints) || 0)} story points</span>
      <span class="meta-badge">Prioridade: ${esc(task.priority || 'normal')}</span>
      <span class="assignee-badge">Responsável: ${esc(board.emails?.[task.assigneeId] || 'Sem responsável')}</span>
      ${task.dueDate ? `<span class="meta-badge">Prazo: ${esc(task.dueDate)}</span>` : ''}
    </div>`;

  const dodItems = Array.isArray(board.dod) ? board.dod : [];
  $('#taskDodList').innerHTML = dodItems.map((item) => `<li>${esc(item)}</li>`).join('')
    || '<li>O dono ainda não definiu critérios.</li>';
  const lastColumn = board.columns?.[board.columns.length - 1];
  const inFinalColumn = task.status === lastColumn?.id;
  $('#taskDodControl').hidden = !editor();
  $('#taskDodCheckbox').checked = Boolean(task.dodComplete);
  $('#taskDodCheckbox').disabled = inFinalColumn;
  $('#aiSubtasksSection').hidden = !editor();
  $('#commentForm').hidden = !editor();
}

function renderComments() {
  $('#commentsList').innerHTML = comments.map((comment) => `
    <article class="comment-card">
      <div class="comment-heading">
        <strong>${esc(comment.authorEmail || 'Membro')}</strong>
        <time>${esc(formatDate(comment.at))}</time>
      </div>
      <p>${esc(comment.text)}</p>
    </article>`).join('') || '<p class="task-list-empty">Ainda não há comentários.</p>';
}

function listenToTask() {
  if (!taskId) {
    showMessage('O endereço não contém um ID de tarefa válido.', true);
    return;
  }
  unsubscribeTask = onSnapshot(doc(db, 'tasks', taskId), (snapshot) => {
    if (!snapshot.exists()) {
      showMessage('A tarefa não existe ou você não tem acesso.', true);
      return;
    }
    task = { id: snapshot.id, ...snapshot.data() };
    if (!unsubscribeBoard || board?.id !== task.boardId) {
      if (unsubscribeBoard) unsubscribeBoard();
      if (unsubscribeComments) unsubscribeComments();
      unsubscribeBoard = onSnapshot(doc(db, 'boards', task.boardId), (boardSnapshot) => {
        if (!boardSnapshot.exists()) {
          showMessage('O quadro não existe mais ou você perdeu o acesso.', true);
          return;
        }
        board = { id: boardSnapshot.id, ...boardSnapshot.data() };
        renderTask();
      }, (error) => {
        console.error(error);
        showMessage('Não foi possível carregar o quadro desta tarefa.', true);
      });
      unsubscribeComments = onSnapshot(
        query(collection(db, 'tasks', task.id, 'comments'), orderBy('at', 'asc')),
        (commentSnapshot) => {
          comments = commentSnapshot.docs.map((commentDoc) => ({
            id: commentDoc.id,
            ...commentDoc.data()
          }));
          renderComments();
        },
        (error) => {
          console.error(error);
          showMessage('Não foi possível carregar os comentários.', true);
        }
      );
    }
    renderTask();
  }, (error) => {
    console.error(error);
    showMessage('Não foi possível abrir esta tarefa. Verifique sua permissão.', true);
  });
}

function showMentionSuggestions() {
  const input = $('#commentText');
  const beforeCursor = input.value.slice(0, input.selectionStart);
  const atIndex = beforeCursor.lastIndexOf('@');
  const suggestions = $('#mentionSuggestions');
  if (atIndex < 0 || !board || !editor()) {
    suggestions.hidden = true;
    return;
  }
  const fragment = beforeCursor.slice(atIndex + 1).toLowerCase();
  if (/\s/.test(fragment)) {
    suggestions.hidden = true;
    return;
  }
  const members = Object.entries(board.members || {}).map(([uid]) => ({
    uid,
    email: board.emails?.[uid] || ''
  })).filter((member) => member.email.toLowerCase().startsWith(fragment));
  if (!members.length) {
    suggestions.hidden = true;
    return;
  }
  suggestions.innerHTML = members.map((member) => `
    <button class="mention-option" type="button" data-mention-uid="${esc(member.uid)}" data-mention-email="${esc(member.email)}">
      @${esc(member.email)}
    </button>`).join('');
  suggestions.dataset.start = String(atIndex);
  suggestions.dataset.end = String(input.selectionStart);
  suggestions.hidden = false;
}

async function submitComment(event) {
  event.preventDefault();
  if (!editor()) return;
  const input = $('#commentText');
  const text = input.value.trim();
  if (!text) {
    showMessage('Escreva um comentário antes de enviar.', true);
    return;
  }
  const mentioned = Object.entries(board.members || {}).map(([uid]) => ({
    uid,
    email: board.emails?.[uid] || ''
  })).filter((member) => member.email
    && hasMention(text, member.email));
  const mentions = [...new Set(mentioned.map((member) => member.uid))];
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, 'tasks', task.id, 'comments'));
  batch.set(commentRef, {
    text,
    authorId: currentUser.uid,
    authorEmail: currentUser.email || '',
    at: serverTimestamp(),
    mentions
  });
  mentioned.forEach((member) => {
    if (member.uid === currentUser.uid) return;
    batch.set(doc(collection(db, 'users', member.uid, 'notifications')), {
      text: `${currentUser.email || 'Um membro'} mencionou você na tarefa "${task.title}".`,
      taskId: task.id,
      boardId: board.id,
      read: false,
      at: serverTimestamp()
    });
  });
  try {
    await batch.commit();
    input.value = '';
    $('#mentionSuggestions').hidden = true;
    showMessage('Comentário enviado.');
  } catch (error) {
    console.error(error);
    showMessage(`Não foi possível enviar o comentário: ${error.message || 'erro inesperado.'}`, true);
  }
}

$('#commentText').addEventListener('input', showMentionSuggestions);
$('#commentText').addEventListener('click', showMentionSuggestions);
$('#mentionSuggestions').addEventListener('click', (event) => {
  const option = event.target.closest('[data-mention-uid]');
  if (!option) return;
  const input = $('#commentText');
  const start = Number($('#mentionSuggestions').dataset.start);
  const end = Number($('#mentionSuggestions').dataset.end);
  input.setRangeText(`@${option.dataset.mentionEmail} `, start, end, 'end');
  $('#mentionSuggestions').hidden = true;
  input.focus();
});
$('#commentForm').addEventListener('submit', submitComment);

$('#taskDodCheckbox').addEventListener('change', async (event) => {
  if (!editor() || !task) return;
  try {
    await updateDoc(doc(db, 'tasks', task.id), { dodComplete: event.target.checked });
  } catch (error) {
    console.error(error);
    showMessage(`Não foi possível atualizar a DoD: ${error.message || 'erro inesperado.'}`, true);
  }
});

$('#generateSubtasksButton').addEventListener('click', async () => {
  if (!editor() || !task || !currentUser) return;
  const button = $('#generateSubtasksButton');
  const message = $('#aiSubtasksMessage');
  const list = $('#aiSubtasksList');
  button.disabled = true;
  message.textContent = 'Gerando sugestões...';
  message.classList.remove('is-error');
  list.replaceChildren();

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(`${aiApiBaseUrl}/api/ai/subtasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ taskId: task.id })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível gerar as subtarefas.');
    if (!Array.isArray(payload.subtasks) || payload.subtasks.length === 0) {
      throw new Error('O assistente não retornou sugestões. Tente novamente.');
    }

    payload.subtasks.forEach((subtask) => {
      if (typeof subtask !== 'string') return;
      const item = document.createElement('li');
      item.textContent = subtask;
      list.appendChild(item);
    });
    message.textContent = list.childElementCount ? 'Sugestões prontas; revise antes de usar.' : 'Nenhuma sugestão válida foi retornada.';
  } catch (error) {
    console.error(error);
    message.textContent = error.message || 'Falha ao gerar sugestões. Tente novamente.';
    message.classList.add('is-error');
  } finally {
    button.disabled = false;
  }
});

function setTaskAuthMode(createAccount) {
  isCreatingAccount = createAccount;
  $('#taskConfirmPasswordField').hidden = !createAccount;
  $('#taskConfirmPassword').required = createAccount;
  $('#taskConfirmPassword').value = '';
  $('#taskLoginPassword').autocomplete = createAccount ? 'new-password' : 'current-password';
  $('#taskAuthSubmitButton').textContent = createAccount ? 'Criar conta' : 'Entrar';
  $('#taskAuthModeButton').textContent = createAccount
    ? 'Já tem uma conta? Entrar'
    : 'Ainda não tem conta? Criar conta';
  $('#taskLoginMessage').textContent = '';
}

$('#taskAuthModeButton').addEventListener('click', () => setTaskAuthMode(!isCreatingAccount));
$('#taskLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#taskLoginEmail').value.trim().toLowerCase();
  const password = $('#taskLoginPassword').value;
  if (isCreatingAccount && password !== $('#taskConfirmPassword').value) {
    $('#taskLoginMessage').textContent = 'As senhas não correspondem.';
    return;
  }
  const submitButton = $('#taskAuthSubmitButton');
  submitButton.disabled = true;
  $('#taskAuthModeButton').disabled = true;
  try {
    if (isCreatingAccount) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    $('#taskLoginMessage').textContent = '';
  } catch (error) {
    console.error(error);
    const messages = {
      'auth/email-already-in-use': 'Este email já está cadastrado. Entre ou use outro email.',
      'auth/invalid-email': 'Digite um endereço de email válido.',
      'auth/weak-password': 'A senha é muito fraca. Use pelo menos 6 caracteres.',
      'auth/operation-not-allowed': 'O cadastro por email e senha não está habilitado no Firebase Authentication.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
      'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente novamente.',
      'auth/invalid-credential': 'Email ou senha incorretos.'
    };
    $('#taskLoginMessage').textContent = messages[error.code]
      || `Não foi possível ${isCreatingAccount ? 'criar a conta' : 'entrar'}. Tente novamente.`;
  } finally {
    submitButton.disabled = false;
    $('#taskAuthModeButton').disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  $('#taskLogin').hidden = Boolean(user);
  $('#taskPage').hidden = !user;
  if (user && !unsubscribeTask) listenToTask();
  if (!user) {
    [unsubscribeTask, unsubscribeBoard, unsubscribeComments].forEach((unsubscribe) => {
      if (unsubscribe) unsubscribe();
    });
    unsubscribeTask = null;
    unsubscribeBoard = null;
    unsubscribeComments = null;
  }
});

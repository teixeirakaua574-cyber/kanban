import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB5JqSrNI2fX8uaCxrsWhwCkEFFSjgtRgM',
  authDomain: 'kanban-3ca38.firebaseapp.com',
  projectId: 'kanban-3ca38',
  storageBucket: 'kanban-3ca38.firebasestorage.app',
  messagingSenderId: '467468722923',
  appId: '1:467468722923:web:8e3f88206d5dc17ca9d4ae',
  measurementId: 'G-38F3MMJ1BN'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Persistência
      const STORAGE_KEY = 'kanban-board-v1';
      const THEME_KEY = 'kanban-board-theme';
      const statusOrder = ['todo', 'doing', 'done'];

      let tasks = [];
      let draggedTaskId = null;
      let themePreference = 'system';
      let activeUserId = null;
      let activeBoardId = null;
      let unsubscribeTasks = null;
      let authStateVersion = 0;

      const loginScreen = document.getElementById('loginScreen');
      const appShell = document.getElementById('appShell');
      const loginForm = document.getElementById('loginForm');
      const loginEmailInput = document.getElementById('loginEmail');
      const loginPasswordInput = document.getElementById('loginPassword');
      const togglePasswordBtn = document.getElementById('togglePasswordBtn');
      const loginMessage = document.getElementById('loginMessage');
      const logoutBtn = document.getElementById('logoutBtn');
      const taskListEls = Array.from(document.querySelectorAll('.task-list'));
      const modalEl = document.getElementById('taskModal');
      const taskForm = document.getElementById('taskForm');
      const taskTitleInput = document.getElementById('taskTitle');
      const taskDescriptionInput = document.getElementById('taskDescription');
      const titleErrorEl = document.getElementById('taskTitleError');
      const themeToggleBtn = document.getElementById('themeToggle');
      const addTaskBtn = document.getElementById('addTaskBtn');
      const closeModalBtn = document.getElementById('closeModalBtn');
      const cancelTaskBtn = document.getElementById('cancelTaskBtn');
      const confirmPasswordField = document.getElementById('confirmPasswordField');
      const confirmPasswordInput = document.getElementById('confirmPassword');
      const authSubmitButton = document.getElementById('authSubmitButton');
      const authModeButton = document.getElementById('authModeButton');
      let isCreatingAccount = false;

      function showApp() {
        loginScreen.hidden = true;
        appShell.hidden = false;
      }

      function showLogin() {
        appShell.hidden = true;
        loginScreen.hidden = false;
        requestAnimationFrame(() => loginEmailInput.focus());
      }

      function showAppMessage(message, isError = false) {
        const element = document.getElementById('appMessage');
        element.textContent = message;
        element.classList.toggle('is-error', isError);
        element.hidden = !message;
      }

      togglePasswordBtn.addEventListener('click', () => {
        const isPasswordHidden = loginPasswordInput.type === 'password';
        loginPasswordInput.type = isPasswordHidden ? 'text' : 'password';
        togglePasswordBtn.textContent = isPasswordHidden ? 'Ocultar' : 'Mostrar';
        togglePasswordBtn.setAttribute('aria-label', isPasswordHidden ? 'Ocultar senha' : 'Mostrar senha');
        togglePasswordBtn.setAttribute('aria-pressed', String(isPasswordHidden));
      });

      function setAuthMode(createAccount) {
        isCreatingAccount = createAccount;
        confirmPasswordField.hidden = !createAccount;
        confirmPasswordInput.required = createAccount;
        confirmPasswordInput.value = '';
        loginPasswordInput.autocomplete = createAccount ? 'new-password' : 'current-password';
        authSubmitButton.textContent = createAccount ? 'Criar conta' : 'Entrar';
        authModeButton.textContent = createAccount
          ? 'Já tem uma conta? Entrar'
          : 'Ainda não tem conta? Criar conta';
        loginMessage.textContent = '';
      }

      function getAuthErrorMessage(error) {
        const messages = {
          'auth/email-already-in-use': 'Este email já está cadastrado. Entre ou use outro email.',
          'auth/invalid-email': 'Digite um endereço de email válido.',
          'auth/weak-password': 'A senha é muito fraca. Use pelo menos 6 caracteres.',
          'auth/operation-not-allowed': 'O cadastro por email e senha não está habilitado no Firebase Authentication.',
          'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
          'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente novamente.',
          'auth/invalid-credential': 'Email ou senha incorretos.'
        };
        return messages[error.code] || `Não foi possível ${isCreatingAccount ? 'criar a conta' : 'entrar'}. Tente novamente.`;
      }

      authModeButton.addEventListener('click', () => setAuthMode(!isCreatingAccount));

      function getLoginErrorMessage(error) {
        const messages = {
          'auth/invalid-credential': 'Email ou senha incorretos.',
          'auth/invalid-email': 'Digite um email válido.',
          'auth/user-disabled': 'Esta conta está desativada.',
          'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
          'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
          'auth/configuration-not-found': 'Configure o Firebase Authentication e habilite o acesso por email e senha no Console Firebase.',
          'auth/operation-not-allowed': 'Ative o acesso por email e senha no Firebase Authentication.'
        };

        return messages[error.code] || 'Não foi possível entrar. Tente novamente.';
      }

      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = loginEmailInput.value.trim().toLowerCase();
        const password = loginPasswordInput.value;

        if (isCreatingAccount && password !== confirmPasswordInput.value) {
          loginMessage.textContent = 'As senhas não correspondem.';
          return;
        }

        authSubmitButton.disabled = true;
        authModeButton.disabled = true;
        authSubmitButton.textContent = isCreatingAccount ? 'Criando conta...' : 'Entrando...';

        try {
          if (isCreatingAccount) {
            await createUserWithEmailAndPassword(auth, email, password);
          } else {
            await signInWithEmailAndPassword(auth, email, password);
          }
          loginMessage.textContent = '';
          loginForm.reset();
          setAuthMode(false);
        } catch (error) {
          loginMessage.textContent = isCreatingAccount
            ? getAuthErrorMessage(error)
            : getLoginErrorMessage(error);
        } finally {
          authSubmitButton.disabled = false;
          authModeButton.disabled = false;
          authSubmitButton.textContent = isCreatingAccount ? 'Criar conta' : 'Entrar';
        }
      });

      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
          await signOut(auth);
        } catch (error) {
          loginMessage.textContent = 'Não foi possível encerrar a sessão. Tente novamente.';
        } finally {
          logoutBtn.disabled = false;
        }
      });

      function safeStorageGet(key) {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.warn('Não foi possível acessar o localStorage:', error);
          return null;
        }
      }

      function safeStorageSet(key, value) {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.warn('Não foi possível salvar no localStorage:', error);
        }
      }

      function getTasksStorageKey(userId = activeUserId) {
        if (!userId) {
          throw new Error('Não é possível acessar tarefas sem uma sessão autenticada.');
        }
        return `${STORAGE_KEY}:${userId}`;
      }

      function loadTasks(userId = activeUserId) {
        const raw = safeStorageGet(getTasksStorageKey(userId));

        if (!raw) {
          tasks = [];
          return tasks;
        }

        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            tasks = parsed.filter((task) => task && typeof task === 'object' && !Array.isArray(task));
            return tasks;
          }

          console.warn('Os dados salvos para esta conta não são uma lista de tarefas.');
          tasks = [];
          return tasks;
        } catch (error) {
          console.warn('Dados de tarefas inválidos no localStorage:', error);
          tasks = [];
          return tasks;
        }
      }

      function migrationMarkerKey(userId) {
        return `${STORAGE_KEY}:migrated:${userId}`;
      }

      async function ensurePersonalBoard(user) {
        const boardsSnapshot = await getDocs(query(
          collection(db, 'boards'),
          where('memberIds', 'array-contains', user.uid)
        ));
        const ownedBoard = boardsSnapshot.docs.find((boardDoc) => (
          boardDoc.data().ownerId === user.uid
        ));
        if (ownedBoard) return ownedBoard.id;

        const boardId = `personal-${encodeURIComponent(user.uid)}`;
        const boardRef = doc(db, 'boards', boardId);
        try {
          await setDoc(boardRef, {
            name: 'Meu quadro',
            ownerId: user.uid,
            members: { [user.uid]: 'OWNER' },
            memberIds: [user.uid],
            emails: { [user.uid]: user.email || '' },
            columns: [
              { id: 'todo', name: 'A Fazer', wip: 0 },
              { id: 'doing', name: 'Em Andamento', wip: 0 },
              { id: 'done', name: 'Concluído', wip: 0 }
            ],
            dod: []
          });
          return boardId;
        } catch (error) {
          const retrySnapshot = await getDocs(query(
            collection(db, 'boards'),
            where('memberIds', 'array-contains', user.uid)
          ));
          const concurrentlyCreatedBoard = retrySnapshot.docs.find((boardDoc) => (
            boardDoc.data().ownerId === user.uid
          ));
          if (concurrentlyCreatedBoard) return concurrentlyCreatedBoard.id;
          throw error;
        }
      }

      async function migrateLocalTasks(boardId, userId, version) {
        const markerKey = migrationMarkerKey(userId);
        const migrationState = safeStorageGet(markerKey);
        if (migrationState === 'done') return;

        const cloudTasks = await getDocs(query(
          collection(db, 'tasks'),
          where('boardId', '==', boardId)
        ));
        if (version !== authStateVersion) return;
        const importPrefix = `local-import-${encodeURIComponent(userId)}-`;
        const localTasks = loadTasks(userId);
        if (!localTasks.length) {
          safeStorageSet(markerKey, 'done');
          return;
        }

        const existingIds = new Set(cloudTasks.docs.map((taskDoc) => taskDoc.id));
        const alreadyImported = localTasks.every((task, index) => (
          existingIds.has(`${importPrefix}${index}`)
        ));
        if (alreadyImported) {
          safeStorageSet(markerKey, 'done');
          return;
        }

        safeStorageSet(markerKey, 'in-progress');
        for (let offset = 0; offset < localTasks.length; offset += 450) {
          if (version !== authStateVersion) return;
          const batch = writeBatch(db);
          const chunk = localTasks.slice(offset, offset + 450);
          chunk.forEach((task, index) => {
            const taskIndex = offset + index;
            const status = statusOrder.includes(task.status) ? task.status : 'todo';
            const taskId = `local-import-${encodeURIComponent(userId)}-${taskIndex}`;
            batch.set(doc(db, 'tasks', taskId), {
              boardId,
              title: String(task.title || 'Sem título'),
              description: String(task.description || ''),
              status,
              assigneeId: '',
              dueDate: '',
              priority: 'normal',
              labels: [],
              checklist: [],
              storyPoints: 0,
              acceptance: '',
              sprintId: '',
              dodComplete: status === 'done' || Boolean(task.dodComplete),
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        }
        safeStorageSet(markerKey, 'done');
      }

      function loadThemePreference() {
        const storedTheme = safeStorageGet(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (storedTheme === 'light' || storedTheme === 'dark') {
          themePreference = storedTheme;
        } else {
          themePreference = prefersDark ? 'dark' : 'light';
        }

        applyTheme(themePreference);
      }

      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themePreference = theme;
        safeStorageSet(THEME_KEY, theme);

        const isDark = theme === 'dark';
        themeToggleBtn.setAttribute('aria-pressed', String(isDark));
        themeToggleBtn.textContent = isDark ? '☀️ Claro' : '🌙 Escuro';
        themeToggleBtn.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
      }

      function openModal() {
        modalEl.classList.add('open');
        modalEl.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => taskTitleInput.focus());
      }

      function closeModal() {
        modalEl.classList.remove('open');
        modalEl.setAttribute('aria-hidden', 'true');
        taskForm.reset();
        titleErrorEl.textContent = '';
      }

      function showTitleError(message) {
        titleErrorEl.textContent = message;
        taskTitleInput.setAttribute('aria-invalid', 'true');
        taskTitleInput.focus();
      }

      function clearTitleError() {
        titleErrorEl.textContent = '';
        taskTitleInput.removeAttribute('aria-invalid');
      }

      function getTaskById(taskId) {
        return tasks.find((task) => task.id === taskId);
      }

      async function updateTaskStatus(taskId, nextStatus) {
        const task = getTaskById(taskId);
        if (!task || !activeBoardId) return;
        if (nextStatus === statusOrder[statusOrder.length - 1] && !task.dodComplete) {
          showAppMessage('Marque “DoD cumprida” antes de mover a tarefa para Concluído.', true);
          return;
        }
        try {
          await updateDoc(doc(db, 'tasks', taskId), { status: nextStatus });
          showAppMessage('');
        } catch (error) {
          console.error(error);
          showAppMessage(`Não foi possível mover a tarefa: ${error.message}`, true);
        }
      }

      async function updateTaskDod(taskId, completed) {
        if (!activeBoardId) return;
        try {
          await updateDoc(doc(db, 'tasks', taskId), { dodComplete: completed });
          showAppMessage('');
        } catch (error) {
          console.error(error);
          showAppMessage(`Não foi possível atualizar a DoD: ${error.message}`, true);
        }
      }

      async function deleteTask(taskId) {
        if (!activeBoardId) return;
        try {
          await deleteDoc(doc(db, 'tasks', taskId));
          showAppMessage('');
        } catch (error) {
          console.error(error);
          showAppMessage(`Não foi possível excluir a tarefa: ${error.message}`, true);
        }
      }

      function buildPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'task-list-empty';
        placeholder.textContent = 'Nenhuma tarefa aqui.';
        return placeholder;
      }

      function createTaskCard(task) {
        const card = document.createElement('article');
        card.className = 'task-card';
        card.draggable = true;
        card.dataset.id = task.id;
        card.setAttribute('aria-label', `Tarefa: ${task.title}`);

        const cardHeader = document.createElement('div');
        cardHeader.className = 'task-card-header';

        const title = document.createElement('h3');
        title.textContent = task.title;

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-button';
        deleteButton.setAttribute('aria-label', `Excluir tarefa ${task.title}`);
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', () => {
          if (window.confirm(`Excluir a tarefa "${task.title}"?`)) {
            deleteTask(task.id);
          }
        });

        cardHeader.appendChild(title);
        cardHeader.appendChild(deleteButton);

        const description = document.createElement('p');
        description.className = 'task-description';
        description.textContent = task.description && task.description.trim() ? task.description : 'Sem descrição.';

        const actionRow = document.createElement('div');
        actionRow.className = 'task-card-actions';

        const moveGroup = document.createElement('div');
        moveGroup.className = 'move-group';

        const leftButton = document.createElement('button');
        leftButton.type = 'button';
        leftButton.className = 'move-button';
        leftButton.setAttribute('aria-label', `Mover tarefa ${task.title} para a coluna anterior`);
        leftButton.textContent = '‹';
        leftButton.disabled = task.status === statusOrder[0];
        leftButton.addEventListener('click', () => {
          const currentIndex = statusOrder.indexOf(task.status);
          if (currentIndex > 0) {
            updateTaskStatus(task.id, statusOrder[currentIndex - 1]);
          }
        });

        const rightButton = document.createElement('button');
        rightButton.type = 'button';
        rightButton.className = 'move-button';
        rightButton.setAttribute('aria-label', `Mover tarefa ${task.title} para a próxima coluna`);
        rightButton.textContent = '›';
        rightButton.disabled = task.status === statusOrder[statusOrder.length - 1];
        rightButton.addEventListener('click', () => {
          const currentIndex = statusOrder.indexOf(task.status);
          if (currentIndex < statusOrder.length - 1) {
            updateTaskStatus(task.id, statusOrder[currentIndex + 1]);
          }
        });

        const metaBadge = document.createElement('span');
        metaBadge.className = 'meta-badge';
        metaBadge.textContent = task.status === 'todo' ? 'A fazer' : task.status === 'doing' ? 'Andamento' : 'Concluído';

        const dodLabel = document.createElement('label');
        dodLabel.className = 'dod-checkbox';
        const dodCheckbox = document.createElement('input');
        dodCheckbox.type = 'checkbox';
        dodCheckbox.checked = Boolean(task.dodComplete);
        dodCheckbox.disabled = task.status === statusOrder[statusOrder.length - 1];
        dodCheckbox.addEventListener('change', () => updateTaskDod(task.id, dodCheckbox.checked));
        dodLabel.append(dodCheckbox, document.createTextNode(' DoD cumprida'));

        moveGroup.appendChild(leftButton);
        moveGroup.appendChild(rightButton);
        actionRow.appendChild(moveGroup);
        actionRow.appendChild(metaBadge);
        actionRow.appendChild(dodLabel);

        card.appendChild(cardHeader);
        card.appendChild(description);
        card.appendChild(actionRow);

        card.addEventListener('dragstart', (event) => {
          draggedTaskId = task.id;
          card.classList.add('dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', task.id);
        });

        card.addEventListener('dragend', () => {
          draggedTaskId = null;
          card.classList.remove('dragging');
          taskListEls.forEach((column) => column.classList.remove('drop-target'));
        });

        return card;
      }

      function renderBoard() {
        const grouped = {
          todo: [],
          doing: [],
          done: []
        };

        tasks.forEach((task) => {
          if (grouped[task.status]) {
            grouped[task.status].push(task);
          }
        });

        taskListEls.forEach((list) => {
          const status = list.dataset.status;
          const statusTasks = grouped[status] || [];
          list.innerHTML = '';

          if (!statusTasks.length) {
            list.appendChild(buildPlaceholder());
          } else {
            statusTasks.forEach((task) => {
              list.appendChild(createTaskCard(task));
            });
          }
        });

        document.getElementById('count-todo').textContent = grouped.todo.length;
        document.getElementById('count-doing').textContent = grouped.doing.length;
        document.getElementById('count-done').textContent = grouped.done.length;
      }

      // Drag and drop
      taskListEls.forEach((list) => {
        list.addEventListener('dragover', (event) => {
          event.preventDefault();
          list.classList.add('drop-target');
        });

        list.addEventListener('dragleave', (event) => {
          const currentTarget = event.currentTarget;
          const nextTarget = event.relatedTarget;

          if (!nextTarget || !currentTarget.contains(nextTarget)) {
            currentTarget.classList.remove('drop-target');
          }
        });

        list.addEventListener('drop', (event) => {
          event.preventDefault();
          list.classList.remove('drop-target');

          if (!draggedTaskId) {
            return;
          }

          const targetStatus = list.dataset.status;
          const taskToMove = getTaskById(draggedTaskId);

          if (!taskToMove || taskToMove.status === targetStatus) {
            draggedTaskId = null;
            return;
          }

          updateTaskStatus(taskToMove.id, targetStatus);
          draggedTaskId = null;
        });
      });

      // Ações do modal
      addTaskBtn.addEventListener('click', openModal);
      closeModalBtn.addEventListener('click', closeModal);
      cancelTaskBtn.addEventListener('click', closeModal);

      modalEl.addEventListener('click', (event) => {
        if (event.target === modalEl) {
          closeModal();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalEl.classList.contains('open')) {
          closeModal();
        }
      });

      taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = taskTitleInput.value.trim();
        const description = taskDescriptionInput.value.trim();

        if (!activeBoardId) {
          showTitleError('Seu quadro ainda está carregando. Tente novamente.');
          return;
        }

        if (!title) {
          showTitleError('O título é obrigatório.');
          return;
        }

        const taskRef = doc(collection(db, 'tasks'));
        try {
          await setDoc(taskRef, {
            boardId: activeBoardId,
            title,
            description,
            status: statusOrder[0],
            assigneeId: '',
            dueDate: '',
            priority: 'normal',
            labels: [],
            checklist: [],
            storyPoints: 0,
            acceptance: '',
            sprintId: '',
            dodComplete: false,
            createdAt: serverTimestamp()
          });
          clearTitleError();
          closeModal();
          showAppMessage('');
        } catch (error) {
          console.error(error);
          showAppMessage(`Não foi possível salvar a tarefa: ${error.message}`, true);
        }
      });

      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = themePreference === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
      });

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (safeStorageGet(THEME_KEY) === null) {
          applyTheme(event.matches ? 'dark' : 'light');
        }
      });

      async function startUserSession(user, version) {
        try {
          const boardId = await ensurePersonalBoard(user);
          if (version !== authStateVersion) return;
          activeBoardId = boardId;
          window.kanbanActiveBoardId = boardId;
          window.dispatchEvent(new CustomEvent('kanban:board-change', { detail: { boardId } }));

          await migrateLocalTasks(boardId, user.uid, version);
          if (version !== authStateVersion) return;

          unsubscribeTasks = onSnapshot(
            query(collection(db, 'tasks'), where('boardId', '==', boardId)),
            (snapshot) => {
              if (version !== authStateVersion) return;
              tasks = snapshot.docs.map((taskDoc) => ({
                id: taskDoc.id,
                ...taskDoc.data()
              }));
              renderBoard();
              addTaskBtn.disabled = false;
              showAppMessage('');
              showApp();
            },
            (error) => {
              if (version !== authStateVersion) return;
              console.error(error);
              addTaskBtn.disabled = true;
              showAppMessage(`Não foi possível carregar as tarefas do Firestore: ${error.message}`, true);
              showApp();
            }
          );
        } catch (error) {
          if (version !== authStateVersion) return;
          console.error(error);
          addTaskBtn.disabled = true;
          showAppMessage(`Não foi possível inicializar seu quadro no Firestore: ${error.message}`, true);
          showApp();
        }
      }

      // Inicialização
      loadThemePreference();

      onAuthStateChanged(auth, (user) => {
        authStateVersion += 1;
        const version = authStateVersion;
        if (unsubscribeTasks) {
          unsubscribeTasks();
          unsubscribeTasks = null;
        }

        if (user) {
          activeUserId = user.uid;
          activeBoardId = null;
          window.kanbanActiveBoardId = null;
          tasks = [];
          addTaskBtn.disabled = true;
          showLogin();
          loginMessage.textContent = 'Carregando seu quadro...';
          showAppMessage('');
          startUserSession(user, version);
        } else {
          activeUserId = null;
          activeBoardId = null;
          window.kanbanActiveBoardId = null;
          window.dispatchEvent(new CustomEvent('kanban:board-change', { detail: { boardId: null } }));
          tasks = [];
          addTaskBtn.disabled = true;
          showAppMessage('');
          renderBoard();
          showLogin();
        }
      });

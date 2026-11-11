import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

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

// Persistência
      const STORAGE_KEY = 'kanban-board-v1';
      const THEME_KEY = 'kanban-board-theme';
      const statusOrder = ['todo', 'doing', 'done'];

      const defaultTasks = [
        {
          id: 'sample-1',
          title: 'Revisar o briefing do cliente',
          description: 'Confirmar requisitos, prazos e entregáveis antes da primeira reunião.',
          status: 'todo'
        },
        {
          id: 'sample-2',
          title: 'Preparar protótipo da homepage',
          description: 'Definir estrutura visual e esquema de navegação principal.',
          status: 'doing'
        }
      ];

      let tasks = [];
      let draggedTaskId = null;
      let themePreference = 'system';

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

      function showApp() {
        loginScreen.hidden = true;
        appShell.hidden = false;
      }

      function showLogin() {
        appShell.hidden = true;
        loginScreen.hidden = false;
        requestAnimationFrame(() => loginEmailInput.focus());
      }

      togglePasswordBtn.addEventListener('click', () => {
        const isPasswordHidden = loginPasswordInput.type === 'password';
        loginPasswordInput.type = isPasswordHidden ? 'text' : 'password';
        togglePasswordBtn.textContent = isPasswordHidden ? 'Ocultar' : 'Mostrar';
        togglePasswordBtn.setAttribute('aria-label', isPasswordHidden ? 'Ocultar senha' : 'Mostrar senha');
        togglePasswordBtn.setAttribute('aria-pressed', String(isPasswordHidden));
      });

      const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

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

        if (!email || !password) {
          loginMessage.textContent = 'Informe seu email e sua senha.';
          return;
        }

        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Entrando...';

        try {
          await signInWithEmailAndPassword(auth, email, password);
          loginMessage.textContent = '';
          loginForm.reset();
        } catch (error) {
          loginMessage.textContent = getLoginErrorMessage(error);
        } finally {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = 'Entrar';
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

      function createTaskId() {
        if (window.crypto && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }

        return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      function loadTasks() {
        const raw = safeStorageGet(STORAGE_KEY);

        if (!raw) {
          tasks = defaultTasks.map((task) => ({ ...task }));
          saveTasks();
          return tasks;
        }

        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            tasks = parsed;
            return tasks;
          }

          tasks = defaultTasks.map((task) => ({ ...task }));
          saveTasks();
          return tasks;
        } catch (error) {
          console.warn('Dados de tarefas inválidos no localStorage:', error);
          tasks = defaultTasks.map((task) => ({ ...task }));
          saveTasks();
          return tasks;
        }
      }

      function saveTasks() {
        const payload = JSON.stringify(tasks);
        safeStorageSet(STORAGE_KEY, payload);
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

      function updateTaskStatus(taskId, nextStatus) {
        tasks = tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          return { ...task, status: nextStatus };
        });

        saveTasks();
        renderBoard();
      }

      function deleteTask(taskId) {
        tasks = tasks.filter((task) => task.id !== taskId);
        saveTasks();
        renderBoard();
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
        deleteButton.addEventListener('click', () => deleteTask(task.id));

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

        moveGroup.appendChild(leftButton);
        moveGroup.appendChild(rightButton);
        actionRow.appendChild(moveGroup);
        actionRow.appendChild(metaBadge);

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

      taskForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const title = taskTitleInput.value.trim();
        const description = taskDescriptionInput.value.trim();

        if (!title) {
          showTitleError('O título é obrigatório.');
          return;
        }

        const newTask = {
          id: createTaskId(),
          title: title,
          description: description,
          status: 'todo'
        };

        tasks.unshift(newTask);
        saveTasks();
        renderBoard();
        closeModal();
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

      // Inicialização
      loadTasks();
      loadThemePreference();
      renderBoard();

      onAuthStateChanged(auth, (user) => {
        if (user) {
          showApp();
        } else {
          showLogin();
        }
      });

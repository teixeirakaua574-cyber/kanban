# Kanban AI Co-pilot

Backend Express que verifica o Firebase ID token, valida a associação do usuário ao quadro, lê tarefas/atividades no Firestore e só então envia contexto ao Gemini. O navegador chama somente `/api/ai/chat` e `/api/ai/subtasks`; a chave Gemini permanece no servidor.

## Variáveis e execução local

1. Instale dependências com `npm install`.
2. Copie `server/.env.example` para `server/.env` e preencha `GEMINI_API_KEY`.
3. Configure credenciais Firebase Admin usando `GOOGLE_APPLICATION_CREDENTIALS` (arquivo de serviço fora do repositório) ou `FIREBASE_SERVICE_ACCOUNT_JSON`; use `FIREBASE_PROJECT_ID=kanban-3ca38`.
4. Ajuste `ALLOWED_ORIGINS` para a origem local do Hosting e execute `npm start`.
5. Sirva o frontend pelo Firebase Hosting Emulator. Se o backend não estiver na mesma origem, configure `<meta name="kanban-api-url" content="http://localhost:3000">` em `index.html` e `task.html`.

Variáveis principais: `PORT`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` ou `FIREBASE_SERVICE_ACCOUNT_JSON`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS`, `AI_RATE_LIMIT`, `AI_RATE_WINDOW_MS`, `AI_MAX_CARDS` e `AI_MAX_PROMPT_CHARS`. Nunca versione `server/.env` ou a chave de serviço.

## Testes

Execute `npm test`. Os cenários HTTP usam Firestore e Gemini simulados; não enviam dados do projeto nem exigem uma chave Gemini real.

## Deploy

**Render:** crie um Web Service neste repositório, com Build Command `npm install` e Start Command `npm start`; cadastre as variáveis de ambiente e segredos no painel e inclua a origem real do Hosting em `ALLOWED_ORIGINS`.

**Cloud Run:** conceda à service account do serviço acesso mínimo de leitura a Firestore e guarde a chave Gemini em Secret Manager; implante com `gcloud run deploy kanban-ai --source . --region us-central1 --set-env-vars=FIREBASE_PROJECT_ID=kanban-3ca38,ALLOWED_ORIGINS=https://SEU_HOSTING --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,FIREBASE_SERVICE_ACCOUNT_JSON=firebase-admin-json:latest`. Configure a URL pública do serviço nos dois meta tags do frontend.

## Demonstração

1. Com um quadro preenchido, pergunte **“O que está travado?”** e confira cards em andamento/atrasados.
2. Pergunte **“O que falta para lançar?”** e confira tarefas ainda não concluídas.
3. Pergunte **“Quem tem mais tarefas?”** e confira a distribuição calculada pelo backend.
4. Abra uma tarefa como OWNER/EDITOR, clique em **Gerar subtarefas** e revise as sugestões; elas não são salvas automaticamente.

## Riscos restantes e mitigação

- **Prompt injection em títulos/descrições/histórico:** o backend os marca como dados não confiáveis e limita tamanho, mas instruções do prompt não são uma barreira perfeita; mantenha saída como sugestão, não execute ações com texto gerado e considere revisão humana.
- **Custo/abuso:** o limite atual é em memória por processo e reinicia com o servidor; em múltiplas instâncias use rate limit compartilhado (Redis/API Gateway), Firebase App Check, quotas e alertas de orçamento Gemini.
- **Dados enviados à IA:** títulos, descrições, responsáveis, prazos, atividade recente e histórico são enviados ao Google Gemini; remova/redija conteúdo sensível e informe os usuários antes de ativar o recurso.
- **Acesso privilegiado:** Firebase Admin ignora Firestore Rules; por isso o backend valida token, associação ao quadro e papel em cada endpoint. Não remova essas verificações.
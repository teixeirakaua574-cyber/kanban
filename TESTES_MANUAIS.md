# Checklist manual

## Preparação

- [ ] Publique `firestore.rules` no projeto Firebase (`firebase deploy --only firestore:rules`).
- [ ] Confirme que Authentication com email/senha e Firestore estão habilitados.
- [ ] Na tela de login, crie uma conta com email válido e senha de pelo menos 6 caracteres; confirme que senhas diferentes e emails duplicados exibem erro.
- [ ] Saia e entre com a conta criada; confirme que um quadro privado é criado em `boards/{id}`.
- [ ] Na mesma sessão do navegador, crie tarefas em uma conta, saia, crie/entre em outra e confirme que nenhuma tarefa da primeira conta aparece; volte à primeira e confirme que suas tarefas continuam lá.
- [ ] Com a conta antiga que já tinha tarefas locais, entre uma vez e confirme que as tarefas dela são importadas para `tasks` no Firestore, sem importar tarefas de outra conta.
- [ ] Crie dois usuários de teste: **dono** e **leitor**; anote o UID e email do leitor.
- [ ] Abra uma sessão normal como dono e outra janela anônima como leitor.

## Permissões, convite e remoção

- [ ] Como dono, crie um quadro, convide o leitor usando o UID e email da conta e confira a notificação recebida.
- [ ] Como leitor, confira que o quadro aparece e que as tarefas são somente leitura: criação, edição, movimentação, atribuição, DoD e comentários não devem ser permitidos.
- [ ] Como dono, remova o leitor e confirme que o quadro deixa de aparecer para ele e que leituras/escritas posteriores são negadas pelas regras.
- [ ] Reconvide o leitor com o papel **Editor** e confirme que pode editar tarefas, mas não sprints, membros ou Definition of Done.

## Quadro, tarefas e Scrum

- [ ] Crie, mova e exclua uma tarefa; confirme os documentos em `tasks` com o `boardId` do quadro e recarregue para verificar a persistência.
- [ ] Mantenha duas sessões da mesma conta abertas e confirme que alterações de tarefa chegam em tempo real pela assinatura Firestore.
- [ ] Crie uma sprint planejada e ative-a; confirme que outra sprint ativa é encerrada.
- [ ] Crie tarefas com story points, responsável e sprint; confirme a notificação de atribuição e o responsável no card.
- [ ] Arraste uma tarefa para o backlog e do backlog para uma sprint; repita usando o seletor de sprint no card.
- [ ] Filtre por sprint ativa e confirme que as tarefas de outras sprints não aparecem nas colunas.
- [ ] Confira as somas de story points por coluna e por sprint.
- [ ] Defina critérios na Definition of Done; sem marcar “DoD cumprida”, tente mover uma tarefa para a última coluna e confirme que a interface e as regras recusam a operação.
- [ ] Confirme que o leitor não consegue alterar sprints nem DoD, mesmo tentando gravar diretamente pelo SDK.

## Rota da tarefa, comentários e notificações

- [ ] Abra uma tarefa pelo link do card; confirme que a URL `/tasks/{id}` funciona diretamente em nova aba e após recarregar.
- [ ] Como dono, atribua uma tarefa ao leitor e confirme que ele recebe notificação; confira o responsável no card.
- [ ] Como dono, escreva comentário com `@` e selecione o leitor na sugestão; confirme que o comentário exibe autor e data e que o leitor recebe notificação.
- [ ] Confirme que texto contendo HTML em títulos, descrições, comentários e notificações aparece como texto, sem executar marcação ou scripts.
- [ ] Marque uma notificação como lida e confirme que o contador do sino diminui.
- [ ] Com as duas sessões abertas, crie/edite uma tarefa como dono e confirme a atualização em tempo real no navegador do leitor.

## Limite WIP

- [ ] Se `wip` for maior que zero, tente mover uma tarefa para uma coluna cheia: a interface deve bloquear a ação.
- [ ] As regras Firestore não conseguem contar de forma confiável os documentos de tarefas para impor WIP; para proteção contra clientes modificados, valide a movimentação numa Cloud Function transacional.

## Índices Firestore

- [ ] As consultas implementadas usam apenas filtros simples por `memberIds` ou `boardId`, coleções sem filtro e `orderBy(at)` isolado para notificações/comentários; não devem exigir índice composto. Confirme no Console Firebase caso outras consultas sejam adicionadas.

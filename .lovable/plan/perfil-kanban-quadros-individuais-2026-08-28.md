# Perfil Kanban — quadros individuais

Novo perfil de acesso "Kanban" que libera o menu **Tarefas** para usuários comuns, cada um com seu próprio quadro, totalmente separado do quadro da equipe de TI.

## Regras

- Perfil **Kanban** pode ser atribuído a qualquer usuário na tela Admin > Usuários (somado aos perfis existentes).
- Usuário **Admin/Técnico**: continua vendo apenas o quadro compartilhado da equipe de TI (comportamento atual, sem alteração).
- Usuário **não-TI com perfil Kanban**: vê o menu Tarefas e um quadro pessoal, isolado — não enxerga colunas nem cards da equipe, e ninguém enxerga os dele.
- No primeiro acesso, o quadro pessoal é criado automaticamente com as colunas **A Fazer**, **Em andamento** e **Concluído** (a última marcada como final, permitindo finalizar tarefas).
- Histórico de tarefas finalizadas segue a mesma separação por dono.
- Sem perfil Kanban e sem ser TI: menu Tarefas permanece oculto e a rota continua bloqueada.

## Banco de dados

- Adicionar valor `kanban` ao enum `app_role`.
- Adicionar coluna `owner_id uuid` em `task_columns` e em `tasks`:
  - `NULL` = quadro compartilhado da equipe de TI (todos os dados atuais permanecem assim).
  - preenchido = quadro pessoal daquele usuário.
- Substituir as políticas RLS atuais das duas tabelas por:
  - TI (técnico/admin): acesso total às linhas com `owner_id IS NULL`.
  - Qualquer usuário com perfil `kanban`: acesso total às linhas com `owner_id = auth.uid()`.
- Índices em `owner_id` nas duas tabelas.

## Alterações no código

- `src/hooks/use-permissions.ts`: expor `isKanban` e `canUseTarefas` (TI ou Kanban), além de `boardOwnerId` (null para TI, id do usuário para Kanban).
- `src/components/app-shell.tsx`: exibir o grupo "Tarefas" quando `canUseTarefas`.
- `src/components/tarefas/tarefas-board.tsx`: filtrar consultas de colunas/tarefas pelo dono do quadro (`is('owner_id', null)` ou `eq('owner_id', uid)`) e gravar `owner_id` em toda criação de coluna/tarefa; criar as três colunas padrão quando o quadro pessoal estiver vazio.
- `src/routes/_authenticated/tarefas.index.tsx` e `tarefas.historico.tsx`: liberar acesso para TI ou Kanban e aplicar o mesmo filtro por dono no histórico.
- `src/routes/_authenticated/admin/usuarios.tsx`: incluir "Kanban" na lista de perfis atribuíveis.
- Seleção de responsável no card: no quadro pessoal, restringir ao próprio usuário.

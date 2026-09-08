# Kanban por departamento + Kanban individual

Cada usuário passa a escolher, no topo da tela Tarefas, qual quadro está vendo:

- **Meu Kanban** — pessoal, isolado (já existe hoje para o perfil Kanban).
- **Kanban do meu departamento** — compartilhado por todos os usuários daquele departamento.
- **Equipe de TI** — quadro compartilhado atual, visível apenas para técnicos e admins.

## Regras

- O departamento vem do cadastro do usuário (campo Departamento do perfil), casado com a tabela Departamentos.
- Qualquer usuário que pertença a um departamento vê e edita o Kanban desse departamento (criar, mover, editar, finalizar e excluir tarefas e colunas).
- Usuário sem departamento definido não vê a opção de quadro de departamento.
- O menu **Tarefas** passa a aparecer para: TI, perfil Kanban, ou qualquer usuário com departamento cadastrado.
- No primeiro acesso de um quadro (pessoal ou de departamento) sem colunas, são criadas automaticamente **A Fazer**, **Em andamento** e **Concluído** (última marcada como final).
- Histórico de finalizadas respeita o quadro selecionado.
- Responsável do card: no quadro de departamento, lista os usuários do mesmo departamento; no pessoal, apenas o próprio usuário; no de TI, a equipe de TI (comportamento atual).

## Banco de dados

- Nova coluna `department_id uuid` (referência a `departments`) em `task_columns` e `tasks`.
- Escopo de cada linha passa a ser: `owner_id` preenchido = quadro pessoal; `department_id` preenchido = quadro do departamento; ambos nulos = quadro da equipe de TI.
- Função auxiliar (security definer) que retorna o id do departamento do usuário logado, comparando `profiles.departamento` com `departments.nome`.
- Políticas de segurança atualizadas nas duas tabelas:
  - TI: acesso total às linhas sem dono e sem departamento.
  - Perfil Kanban: acesso total às próprias linhas (`owner_id = auth.uid()`).
  - Qualquer autenticado: acesso total às linhas cujo `department_id` seja o departamento dele.
- Índices em `department_id` nas duas tabelas.

## Alterações no código

- `src/hooks/use-permissions.ts`: expor `departmentId` do usuário e `canUseTarefas` incluindo quem tem departamento.
- Novo hook/estado de "quadro ativo" (`meu` | `departamento` | `ti`), persistido em `localStorage`, que produz o par `{ owner_id, department_id }` usado nas consultas.
- `src/components/tarefas/tarefas-board.tsx`: seletor de quadro no cabeçalho; todas as consultas e inserções (colunas, tarefas, reordenação) passam a filtrar/gravar `owner_id` + `department_id` do quadro ativo; criação automática das colunas padrão também para quadro de departamento.
- `src/routes/_authenticated/tarefas.historico.tsx`: mesmo seletor/filtro por quadro.
- `src/components/app-shell.tsx`: exibir Tarefas conforme a nova regra de acesso.

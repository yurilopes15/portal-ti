# Remover perfil Kanban + Perfis e Permissões

## 1. Fim do perfil "Kanban"

- Quem hoje está com o perfil Kanban passa a ser Usuário (nenhum acesso é perdido: o menu Tarefas fica liberado para todos).
- "Kanban" some da lista de perfis na tela Admin > Usuários, dos filtros e das etiquetas.
- O menu **Tarefas** continua visível para todos os perfis (cada um com seu quadro pessoal; TI e departamentos com os seus).
- Observação: o valor antigo permanece registrado internamente no banco (o Postgres não permite apagar um valor de lista já criado), mas deixa de aparecer e de ser atribuível em qualquer tela.

## 2. Perfis (Configurações > Segurança > Perfis)

Nova tela para criar e gerenciar perfis:

- Lista dos perfis com nome, descrição, nível base e quantidade de usuários.
- Criar, editar e excluir perfis personalizados. Os três perfis nativos (Usuário, Técnico, Admin) não podem ser excluídos nem ter o nível base alterado.
- Cada perfil novo escolhe um **nível base** (Usuário, Técnico ou Admin) que define as regras de segurança dos dados no banco. As permissões marcadas restringem o que aparece e o que pode ser feito dentro dessa base.
- Ao excluir um perfil, os usuários dele voltam para "Usuário".
- Em Admin > Usuários, o seletor de perfil passa a listar também os perfis personalizados.

## 3. Permissões (Configurações > Segurança > Permissões)

- Escolhe-se um perfil e marca-se, por módulo, o que ele pode: **Ver / Criar / Editar / Excluir**.
- Módulos: Dashboard, Chamados, Tarefas, Inventário, Base de Conhecimento, Reservas, Toners, Usuários, Configurações.
- Perfis nativos vêm pré-marcados com o comportamento atual do sistema e podem ser ajustados; o perfil Admin mantém tudo marcado e bloqueado, para nunca ficar sem acesso.
- Menus, botões de criar/editar/excluir e o acesso às páginas passam a respeitar essas marcações.

## Detalhes técnicos

Banco (migração):

- `roles`: `id`, `slug`, `nome`, `descricao`, `base_role app_role`, `is_system boolean`, timestamps. Seed com usuario/tecnico/admin como `is_system`.
- `role_permissions`: `role_id`, `module text`, `can_view/can_create/can_edit/can_delete boolean`, único por (`role_id`, `module`). Seed refletindo as permissões atuais.
- `user_roles` ganha `role_id uuid references roles(id)`; a coluna `role app_role` continua existindo e é preenchida com o `base_role`, para que todas as políticas RLS e a função `has_role` sigam funcionando sem alteração.
- Backfill: `update user_roles set role='usuario' where role='kanban'` e `role_id` apontando para o perfil nativo correspondente.
- GRANTs para `authenticated` (leitura) e `service_role`; RLS: leitura para autenticados, escrita apenas para admin (`has_role(auth.uid(),'admin')`).

Código:

- `src/lib/roles.functions.ts` (novo): server functions de admin para criar/editar/excluir perfis e salvar permissões, usando `requireSupabaseAuth` + verificação de admin, com registro em `log_admin_action`.
- `src/lib/admin-users.functions.ts`: `role` deixa de ser enum fixo e passa a aceitar `role_id`; grava `role_id` + `role = base_role`. Remove "kanban" dos schemas.
- `src/hooks/use-permissions.ts`: busca o perfil e suas permissões do usuário logado e expõe `can(module, action)` além das flags atuais (mantidas, agora derivadas das permissões). Remove `isKanban`.
- `src/hooks/use-auth.ts`: remove `"kanban"` de `AppRole`; `src/lib/format.ts`: remove o rótulo.
- `src/routes/_authenticated/admin/seguranca.tsx` (novo): abas "Perfis" e "Permissões", ancoradas por hash (`#perfis`, `#permissoes`).
- `src/components/app-shell.tsx`: itens Perfis e Permissões deixam de ser "em breve" e apontam para a nova rota; "Regras de Acesso" continua como em breve; visibilidade dos menus passa por `can(module, 'view')`.
- `src/routes/_authenticated/admin/usuarios.tsx`: seletor e filtro de perfil carregados da tabela `roles`.

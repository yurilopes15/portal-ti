# Documentação do Sistema — Portal TI Slotter

> Documentação fiel ao estado atual do sistema. Não contém sugestões de melhorias, roadmap, ideias futuras ou orientações de deploy.

---

## 1. Visão geral do sistema

O **Portal TI Slotter** é um sistema interno (web app) usado pela equipe de TI da Slotter e pelos demais colaboradores para centralizar a operação de suporte técnico, controle de ativos, conhecimento interno e reservas de recursos compartilhados.

### O que o sistema faz hoje
- Permite que qualquer usuário autenticado **abra chamados** (Help Desk) para a equipe de TI.
- Permite que a TI **gerencie esses chamados** (atribuição, status, prioridade, comentários, anexos, histórico).
- Mantém um **inventário de equipamentos de TI** (computadores, monitores, impressoras, telefones, equipamentos de rede, celulares).
- Mantém uma **Base de Conhecimento** com artigos e categorias.
- Gerencia **reservas de salas e equipamentos** compartilhados, com calendário e regras de bloqueio.
- Controla **usuários, perfis (roles), departamentos** e listas auxiliares (categorias, prioridades, status, fabricantes, sistemas operacionais).
- Envia **notificações in-app** para criação de chamados, atribuições, mudança de status e comentários.
- Mantém **log de auditoria** e suporte a **soft-delete/restauração** para entidades críticas.

### Objetivo principal
Centralizar a operação de TI da empresa em um único portal: chamados, ativos, conhecimento e reservas, com controle de permissões por perfil.

### O que NÃO faz (escopo atual)
- **Não existe módulo Financeiro** (não há receitas, despesas, parcelas, contas a pagar/receber ou qualquer entidade financeira no banco ou na UI).
- Não há integração com sistemas externos.
- Não há app mobile nativo (é um web app responsivo).

---

## 2. Stack e organização técnica

- **Frontend / Framework**: TanStack Start v1 (React 19, Vite 7).
- **Roteamento**: TanStack Router com file-based routing em `src/routes/`.
- **Estado de servidor**: TanStack Query.
- **UI**: Tailwind CSS v4 + shadcn/ui.
- **Backend gerenciado**: Supabase (Auth, Postgres, Storage, RLS).
- **Camada server-side da aplicação**: TanStack Server Functions (`createServerFn`) em `src/lib/*.functions.ts` e middleware de auth Supabase.
- **Notificações UI**: `sonner` (toasts) + componente próprio `NotificationsBell`.

### Organização de pastas relevante
```
src/
  routes/
    __root.tsx                       # shell HTML
    auth.tsx                         # login
    reset-password.tsx
    _authenticated/                  # layout protegido (exige sessão Supabase)
      route.tsx                      # gate de autenticação + AppShell
      index.tsx                      # Dashboard
      chamados/{index,novo,$id}.tsx
      inventario.tsx
      base-conhecimento.tsx
      perfil.tsx
      reservas/
        salas.index.tsx
        salas.$id.tsx
        equipamentos.index.tsx
        equipamentos.$id.tsx
      admin/
        usuarios.tsx
        departamentos.tsx
        chamados-config.tsx
        inventario-config.tsx
        base-conhecimento-config.tsx
        reservas-config.tsx
  components/
    app-shell.tsx                    # sidebar + header + layout autenticado
    notifications-bell.tsx
    reservas/{resource-calendar,resource-card-grid}.tsx
    ui/...                           # shadcn
  hooks/
    use-auth.ts, use-permissions.ts, use-ticket-lookups.ts, use-user-preferences.ts
  lib/
    admin-actions.functions.ts
    admin-users.functions.ts
    bootstrap.functions.ts
    inventory-groups.ts
  integrations/supabase/
    client.ts, client.server.ts, auth-middleware.ts, auth-attacher.ts, types.ts
supabase/
  migrations/                        # esquema versionado
  config.toml
```

---

## 3. Módulos existentes

### 3.1 Dashboard (`/`)
Tela inicial após login. Apresenta visão consolidada (cards/gráficos) sobre chamados e inventário usando `dashboard-charts.tsx` e `inventory-dashboard.tsx`. Acessível a todos os perfis autenticados.

### 3.2 Chamados / Help Desk (`/chamados`)
Núcleo do sistema. Permite criar, listar, visualizar, comentar, atribuir e fechar chamados.
- Listagem em `/chamados` com filtros.
- Criação em `/chamados/novo`.
- Detalhe em `/chamados/$id` com comentários, anexos, histórico e mudança de status.
- Configurações administrativas em `/admin/chamados-config` (categorias, prioridades, status).

### 3.3 Base de Conhecimento (`/base-conhecimento`)
Catálogo de artigos internos com categorias e anexos.
- Visualização em `/base-conhecimento`.
- Administração de categorias em `/admin/base-conhecimento-config`.

### 3.4 Inventário (`/inventario`) — apenas TI
Cadastro de ativos. Itens são agrupados por tipo via `INVENTORY_GROUPS`:
- `computadores`, `monitores`, `impressoras`, `telefones`, `rede`, `celulares`.
- Navegação por grupo via parâmetro `?grupo=...` na sidebar.
- Administração de listas auxiliares em `/admin/inventario-config` (categorias, fabricantes, sistemas operacionais, status).

### 3.5 Reservas (`/reservas/...`)
Reservas de recursos compartilhados, divididas em duas naturezas:
- **Salas**: `/reservas/salas` (grid de cards) → `/reservas/salas/$id` (calendário).
- **Equipamentos**: `/reservas/equipamentos` (grid) → `/reservas/equipamentos/$id` (calendário).
- Calendário em `Dia / Semana / Mês` (`resource-calendar.tsx`).
- Bloqueio de datas e configuração de finais de semana via `/admin/reservas-config`.
- Datas bloqueadas e finais de semana bloqueados aparecem visualmente no calendário com a descrição do bloqueio (ex.: "🚫 Feriado", "Final de semana").

### 3.6 Administração
Acessível ao perfil **admin** (algumas seções ao perfil **tecnico**):
- **Usuários** (`/admin/usuarios`) — admin.
- **Departamentos** (`/admin/departamentos`) — admin.
- **Configurações de Chamados / Inventário / Base de Conhecimento / Reservas** — TI/admin.

### 3.7 Perfil (`/perfil`)
Tela do próprio usuário para visualizar e editar dados pessoais e preferências (`user_preferences`).

### 3.8 Autenticação (`/auth`, `/reset-password`)
Login, cadastro inicial e fluxo de redefinição de senha via Supabase Auth.

> **Não existe módulo Financeiro neste sistema.**

---

## 4. Fluxos do sistema

### 4.1 Fluxo de abertura e gestão de chamados
1. Usuário autenticado acessa **Chamados → Novo** (`/chamados/novo`).
2. Preenche título, descrição, categoria, prioridade e, opcionalmente, anexos (`ticket_attachments`).
3. Ao salvar:
   - Insere em `tickets` com `criado_por = auth.uid()`, `status` inicial.
   - Trigger `log_ticket_changes` grava evento `criado` em `ticket_history`.
   - Trigger `notify_ticket_event` cria registros em `notifications` para todos os usuários com role `tecnico` ou `admin`.
4. TI vê o chamado na listagem `/chamados`, podendo filtrar por status, prioridade, responsável.
5. Em `/chamados/$id`, a TI pode:
   - **Atribuir responsável** (`responsavel_id`) — trigger gera notificação ao novo responsável e registra no histórico.
   - **Mudar status** — trigger `set_ticket_timestamps` define `resolvido_em` / `fechado_em` automaticamente conforme flags `is_resolvido` / `is_fechado` do `ticket_statuses`. Mudança notifica o criador.
   - **Mudar prioridade** — registrada em `ticket_history`.
   - **Adicionar solução** (`solucao`) — registrada no histórico.
   - **Comentar** (`ticket_comments`); comentários não-internos disparam notificação ao criador e ao responsável (`notify_comment`).
6. Exclusão é **soft-delete** via função `soft_delete_entity('ticket', id)` (apenas admin). Pode ser restaurado via `restore_entity`.

### 4.2 Fluxo de reservas (salas e equipamentos)
1. Usuário entra em `/reservas/salas` ou `/reservas/equipamentos` e escolhe um recurso (cards de `reservation_resources`).
2. No calendário do recurso (`/reservas/{tipo}/$id`), escolhe data/horário e cria a reserva (`reservations`).
3. Validações no servidor (triggers):
   - `check_reservation_overlap`: impede duas reservas `status = 'reservado'` no mesmo recurso com janelas sobrepostas.
   - `check_reservation_blocked`:
     - Bloqueia finais de semana se `reservation_settings.block_weekends = true`.
     - Bloqueia datas presentes em `reservation_blocked_dates`.
4. Dias bloqueados são exibidos visualmente nas três visões (Dia / Semana / Mês) com a descrição (motivo) do bloqueio.
5. Admin gerencia recursos e bloqueios em `/admin/reservas-config` (abas Salas, Equipamentos, Bloqueios).

### 4.3 Fluxo da Base de Conhecimento
1. TI cria artigos em `kb_articles`, ligados a `kb_categories`, com `kb_attachments` opcionais.
2. Usuários consultam em `/base-conhecimento` por categoria/busca.
3. Exclusão de artigos é soft-delete via `soft_delete_entity('kb_article', id)` (admin).

### 4.4 Fluxo de Inventário
1. TI cadastra itens em `inventory_items` com patrimônio, tipo, fabricante, SO, status, responsável, localização, dados técnicos (IP, MAC, AnyDesk, TeamViewer, nome de máquina).
2. Listas auxiliares (`inventory_categories`, `inventory_types`, `inventory_manufacturers`, `inventory_operating_systems`, `inventory_statuses`) são mantidas em `/admin/inventario-config`.
3. Itens podem ser filtrados por grupo na sidebar.
4. Soft-delete via `soft_delete_entity('inventory_item', id)` (admin).

### 4.5 Fluxo de notificações
- Sino no header (`NotificationsBell`) lê `notifications` do usuário logado.
- Notificações são criadas por triggers de chamados/comentários.
- Cada notificação tem `lida` (boolean) e link para o chamado.

### 4.6 Fluxo de autenticação
1. Usuário entra em `/auth`, faz login (e-mail/senha) via Supabase Auth.
2. Trigger `handle_new_user` cria automaticamente um registro em `profiles` e atribui role default `usuario` em `user_roles` na criação do usuário.
3. Rotas sob `_authenticated/` exigem sessão; sem sessão redireciona para `/auth`.
4. Reset de senha em `/reset-password`.

### 4.7 Fluxo de auditoria e exclusão
- `log_admin_action(action, entity_type, entity_id, metadata)` registra ações administrativas em `audit_log` (somente admin).
- `soft_delete_entity` / `restore_entity` operam sobre `tickets`, `inventory_items`, `kb_articles`, `profiles` marcando `deleted_at` / `deleted_by` e registrando no `audit_log`.

---

## 5. Estrutura de telas (UI)

### 5.1 Layout geral (autenticado)
`AppShell` (`src/components/app-shell.tsx`):
- **Sidebar à esquerda** (colapsável) com logo Slotter e menus.
- **Header** com `SidebarTrigger`, `NotificationsBell` e menu do usuário (avatar → perfil, sair).
- **Main** com largura máxima `1600px`.

### 5.2 Hierarquia do menu (sidebar)

**Operação**
- Dashboard → `/`
- Chamados → `/chamados`
- Inventário (apenas TI) — submenu:
  - Todos
  - Computadores, Monitores, Impressoras, Telefones, Rede, Celulares
- Reservas — submenu:
  - Salas → `/reservas/salas`
  - Equipamentos → `/reservas/equipamentos`
- Base de Conhecimento → `/base-conhecimento`

**Administração** (visível conforme perfil)
- Configurações (grupo expansível):
  - Chamados → Categorias / Prioridades / Status
  - Inventário → Categorias / Fabricantes / Sistemas Operacionais / Status
  - Base de Conhecimento → Categorias
  - Reservas → Salas / Equipamentos / Bloqueios
  - Organização → Departamentos
  - Segurança → Perfis / Permissões / Regras de Acesso *(itens marcados como "em breve" na UI atual)*
- Usuários → `/admin/usuarios` (admin)

**Rodapé da sidebar / header**
- Avatar do usuário → Perfil (`/perfil`) | Sair.

### 5.3 Telas principais
| Rota | Tela | Função |
|------|------|--------|
| `/auth` | Login | Entrada no sistema |
| `/reset-password` | Reset de senha | Definir nova senha |
| `/` | Dashboard | Visão geral (gráficos de chamados/inventário) |
| `/chamados` | Lista de chamados | Filtros, busca, paginação |
| `/chamados/novo` | Novo chamado | Formulário de criação |
| `/chamados/$id` | Detalhe do chamado | Dados, comentários, histórico, anexos, ações de status |
| `/inventario` | Inventário | Tabela/cards com filtro por grupo |
| `/base-conhecimento` | Base de conhecimento | Lista e leitura de artigos |
| `/reservas/salas` | Salas | Grid de cards de salas |
| `/reservas/salas/$id` | Calendário da sala | Dia/Semana/Mês com bloqueios visíveis |
| `/reservas/equipamentos` | Equipamentos | Grid de cards |
| `/reservas/equipamentos/$id` | Calendário do equipamento | Dia/Semana/Mês |
| `/perfil` | Perfil | Dados pessoais e preferências |
| `/admin/usuarios` | Usuários | Listar, criar, editar, alterar role, resetar senha (admin) |
| `/admin/departamentos` | Departamentos | CRUD (admin) |
| `/admin/chamados-config` | Config chamados | Categorias/Prioridades/Status (abas via hash) |
| `/admin/inventario-config` | Config inventário | Categorias/Tipos/Fabricantes/SO/Status |
| `/admin/base-conhecimento-config` | Config KB | Categorias |
| `/admin/reservas-config` | Config reservas | Salas/Equipamentos/Bloqueios + flag de finais de semana |

### 5.4 Navegação
- Navegação principal sempre pela sidebar.
- Dentro de `chamados-config` / `inventario-config` / `reservas-config` o roteamento usa **hash** (`#categories`, `#priorities`, `#bloqueios`, etc.) para selecionar aba.
- Rotas protegidas redirecionam para `/auth` quando não há sessão.

---

## 6. Banco de dados (Supabase / Postgres)

Schema: `public`. Acesso via PostgREST (Data API) com **RLS habilitado** em todas as tabelas listadas.

### 6.1 Tabelas — visão geral

| Tabela | Uso |
|--------|-----|
| `profiles` | Perfil do usuário (espelho de `auth.users`), dados pessoais |
| `user_roles` | Roles do usuário (`admin`, `tecnico`, `usuario`) |
| `user_preferences` | Preferências individuais (tema, layout, etc.) |
| `departments` | Departamentos da empresa |
| `tickets` | Chamados (Help Desk) |
| `ticket_categories` | Categorias de chamado |
| `ticket_priorities` | Prioridades |
| `ticket_statuses` | Status (com flags `is_resolvido`, `is_fechado`) |
| `ticket_comments` | Comentários de chamado (públicos/internos) |
| `ticket_attachments` | Anexos de chamado |
| `ticket_history` | Histórico de mudanças de chamado |
| `notifications` | Notificações in-app |
| `inventory_items` | Ativos de TI |
| `inventory_categories` | Categorias de inventário |
| `inventory_types` | Tipos de item |
| `inventory_manufacturers` | Fabricantes |
| `inventory_operating_systems` | Sistemas operacionais |
| `inventory_statuses` | Status de item |
| `kb_articles` | Artigos da base de conhecimento |
| `kb_categories` | Categorias da base de conhecimento |
| `kb_attachments` | Anexos de artigos |
| `reservation_resources` | Recursos reserváveis (salas e equipamentos) |
| `reservations` | Reservas de recursos |
| `reservation_blocked_dates` | Datas bloqueadas (feriados etc.) |
| `reservation_settings` | Config global de reservas (linha única) |
| `room_reservations` | Tabela legada de reservas de sala (mantida no schema) |
| `audit_log` | Log de ações administrativas |

### 6.2 Detalhamento das principais tabelas

**`profiles`** — id (= `auth.users.id`), nome, email, departamento, telefone, ativo, deleted_at, deleted_by, created_at, updated_at. Criado automaticamente por `handle_new_user`.

**`user_roles`** — `user_id`, `role` (enum `app_role`: `admin` | `tecnico` | `usuario`), `unique(user_id, role)`. Lida pela função `has_role(uid, role)`.

**`departments`** — `nome`, `ativo`, timestamps.

**`tickets`** — Principais campos:
- `numero` (sequencial), `titulo`, `descricao`
- `status` (texto) e/ou `status_id` (FK `ticket_statuses`)
- `prioridade` e/ou `prioridade_id`
- `categoria_id`
- `criado_por` (FK profiles), `responsavel_id` (FK profiles)
- `solucao`, `resolvido_em`, `fechado_em`, `deleted_at`, `deleted_by`
- Timestamps `created_at` / `updated_at`.

**`ticket_statuses`** — `nome`, `cor`, `ordem`, `is_resolvido`, `is_fechado`, `ativo`. As flags controlam a marcação automática de `resolvido_em` / `fechado_em` em `tickets` (trigger `set_ticket_timestamps`).

**`ticket_priorities`** — `nome`, `cor`, `nivel`, `ordem`, `ativo`.

**`ticket_categories`** — `nome`, `descricao`, `ativo`.

**`ticket_comments`** — `ticket_id`, `autor_id`, `conteudo`, `interno` (boolean), `created_at`. Comentários não-internos geram notificação.

**`ticket_attachments`** — `ticket_id`, metadados de arquivo (nome, mime, tamanho), URL no Storage.

**`ticket_history`** — `ticket_id`, `autor_id`, `campo`, `valor_antigo`, `valor_novo`, `created_at`. Preenchido por `log_ticket_changes`.

**`notifications`** — `user_id`, `ticket_id` (opcional), `titulo`, `mensagem`, `lida`, `created_at`.

**`inventory_items`** — Identificação (`patrimonio`, `tipo`, `numero_serie`), técnicas (`computer_name`, `operating_system`, `ip_address`, `mac_address`, `anydesk_id`, `teamviewer_id`), gestão (`responsavel_id`, `localizacao`, `status`, `observacoes`), FKs para `inventory_categories`, `inventory_types`, `inventory_manufacturers`, `inventory_operating_systems`, `inventory_statuses`, soft-delete (`deleted_at`, `deleted_by`).

**`inventory_*` auxiliares** — `nome`, `descricao` (quando aplicável), `ativo`, timestamps.

**`kb_articles`** — `titulo`, `conteudo`, `categoria_id`, `autor_id`, `publicado`, `visualizacoes`, soft-delete, timestamps.

**`kb_categories`** — `nome`, `descricao`, `ordem`, `ativo`.

**`kb_attachments`** — `article_id`, metadados do arquivo, URL.

**`reservation_resources`** — `tipo` (`room` | `equipment`), `nome`, `descricao`, `capacidade`, `localizacao`, `ativo`, timestamps.

**`reservations`** — `resource_id`, `user_id`, `start_datetime`, `end_datetime`, `titulo`, `descricao`, `status` (`reservado` | `cancelado`), timestamps. Validada por `check_reservation_overlap` e `check_reservation_blocked`.

**`reservation_blocked_dates`** — `data` (date), `descricao` (motivo), criado_por, timestamps. Datas listadas aqui bloqueiam reservas e aparecem com descrição no calendário.

**`reservation_settings`** — linha única (`id = true`), `block_weekends` (boolean), `updated_at`.

**`audit_log`** — `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb), `created_at`.

### 6.3 Relacionamentos principais
```
auth.users ──1:1── profiles ──1:N── tickets (criado_por, responsavel_id)
                                ├──1:N── ticket_comments
                                ├──1:N── ticket_attachments
                                ├──1:N── ticket_history
                                └──N:1── ticket_{statuses, priorities, categories}

profiles ──1:N── user_roles
profiles ──1:N── notifications
profiles ──1:N── inventory_items (responsavel_id)

inventory_items ──N:1── inventory_{categories, types, manufacturers, operating_systems, statuses}

kb_articles ──N:1── kb_categories
kb_articles ──1:N── kb_attachments

reservation_resources ──1:N── reservations ──N:1── profiles (user_id)
reservation_blocked_dates  (sem FK; bloqueia por data)
reservation_settings        (singleton)
```

### 6.4 Funções e triggers do banco

**Funções SECURITY DEFINER relevantes:**
- `has_role(uid, role)` — checa role sem recursão de RLS.
- `is_ti(uid)` — `true` para `admin` ou `tecnico`.
- `handle_new_user()` — cria `profiles` + role default ao criar usuário em `auth.users`.
- `log_ticket_changes()` — popula `ticket_history` em insert/update de `tickets`.
- `set_ticket_timestamps()` — ajusta `resolvido_em`/`fechado_em` conforme flags do status.
- `notify_ticket_event()` — gera notificações em criação e mudança de chamado.
- `notify_comment()` — gera notificações em novo comentário (respeita `interno`).
- `check_reservation_overlap()` — impede sobreposição.
- `check_reservation_blocked()` — impede fim de semana (quando ativado) e datas bloqueadas.
- `update_updated_at_column()` — mantém `updated_at`.
- `soft_delete_entity(type, id, metadata)` / `restore_entity(type, id)` — apenas admin; tipos suportados: `ticket`, `inventory_item`, `kb_article`, `profile`.
- `log_admin_action(action, type, id, metadata)` — registra em `audit_log` (apenas admin).

---

## 7. Regras do sistema

### 7.1 Regras de chamados
- Todo chamado é criado em nome do usuário logado (`criado_por = auth.uid()`).
- Mudança de status registra histórico automaticamente.
- Quando o status alterado é marcado como `is_resolvido`, `resolvido_em` é preenchido com `now()`.
- Quando o status é `is_fechado`, `fechado_em = now()` e `resolvido_em` também é preenchido se ainda vazio.
- Se o chamado sai de um status resolvido/fechado, os timestamps correspondentes são limpos.
- Comentários **internos** (`interno = true`) **não** geram notificação para o criador do chamado.
- Apenas TI (admin/tecnico) pode atribuir responsável e mudar status.
- Apenas admin pode excluir (soft-delete) chamados.

### 7.2 Regras de reservas
- Não é permitido criar duas reservas com `status = 'reservado'` sobrepostas no mesmo recurso.
- Se `reservation_settings.block_weekends = true`, reservas em sábado/domingo são rejeitadas.
- Datas em `reservation_blocked_dates` rejeitam reservas no intervalo correspondente.
- Bloqueios são exibidos visualmente no calendário com a descrição (motivo).
- Cancelamento é feito mudando `status` para `cancelado` (não há exclusão dura na UI).

### 7.3 Regras de notificações
- Novo chamado → notifica todos os `tecnico` e `admin`.
- Mudança de status (feita por outro usuário) → notifica o criador.
- Atribuição/alteração de responsável → notifica o novo responsável.
- Novo comentário (não interno) → notifica criador e responsável (exceto o próprio autor).

### 7.4 Regras de auditoria
- Toda exclusão via `soft_delete_entity` gera linha em `audit_log`.
- Restauração via `restore_entity` também é registrada.
- `log_admin_action` exige que o chamador tenha role `admin`.

### 7.5 Validações automáticas (triggers)
| Trigger / função | Quando executa | O que faz |
|---|---|---|
| `handle_new_user` | INSERT em `auth.users` | Cria `profiles` + `user_roles` |
| `log_ticket_changes` | INSERT/UPDATE em `tickets` | Grava em `ticket_history` |
| `set_ticket_timestamps` | INSERT/UPDATE em `tickets` | Ajusta `resolvido_em`/`fechado_em` |
| `notify_ticket_event` | INSERT/UPDATE em `tickets` | Cria notificações |
| `notify_comment` | INSERT em `ticket_comments` | Cria notificações |
| `check_reservation_overlap` | INSERT/UPDATE em `reservations` | Bloqueia sobreposição |
| `check_reservation_blocked` | INSERT/UPDATE em `reservations` | Bloqueia feriado/fim de semana |
| `update_updated_at_column` | UPDATE em várias tabelas | Atualiza `updated_at` |

### 7.6 Soft-delete
Implementado em `tickets`, `inventory_items`, `kb_articles`, `profiles` via colunas `deleted_at` / `deleted_by` (em `profiles` também marca `ativo = false`). Apenas admin executa via funções `soft_delete_entity` / `restore_entity`.

---

## 8. Perfis de usuário

Definidos pelo enum `app_role` e armazenados em `user_roles` (um usuário pode ter mais de uma role, embora o uso atual seja uma por usuário).

### 8.1 `admin`
Acesso total. Pode:
- Tudo que `tecnico` pode.
- Gerenciar **usuários** (criar, editar, mudar role, resetar senha, desativar).
- Gerenciar **departamentos**.
- Excluir (soft-delete) e restaurar chamados, itens de inventário, artigos da KB e perfis.
- Executar funções privilegiadas (`soft_delete_entity`, `restore_entity`, `log_admin_action`).
- Acessar `/admin/usuarios` e `/admin/departamentos`.

### 8.2 `tecnico`
Equipe de TI. Pode:
- Tudo que `usuario` pode.
- Ver **todos os chamados**.
- Atribuir responsáveis, mudar status e prioridade, registrar solução.
- Gerenciar **inventário** (criar/editar itens; exclusão só admin).
- Gerenciar **base de conhecimento** (criar/editar artigos; exclusão só admin).
- Acessar configurações de chamados, inventário, base de conhecimento e reservas.

### 8.3 `usuario` (padrão)
Usuário final. Pode:
- Abrir e acompanhar seus próprios chamados; comentar.
- Consultar a base de conhecimento.
- Criar reservas de salas e equipamentos.
- Editar seu próprio perfil e preferências.
- Receber notificações.

### 8.4 Matriz resumida de permissões (lógica de `usePermissions`)

| Capacidade | usuario | tecnico | admin |
|---|:-:|:-:|:-:|
| Ver todos os chamados | ❌ | ✅ | ✅ |
| Atribuir/Mudar status de chamado | ❌ | ✅ | ✅ |
| Excluir chamados | ❌ | ❌ | ✅ |
| Ver / gerenciar inventário | ❌ | ✅ | ✅ |
| Excluir itens de inventário | ❌ | ❌ | ✅ |
| Gerenciar base de conhecimento | ❌ | ✅ | ✅ |
| Excluir artigos KB | ❌ | ❌ | ✅ |
| Gerenciar usuários / roles / senhas | ❌ | ❌ | ✅ |
| Gerenciar departamentos | ❌ | ❌ | ✅ |
| Abrir chamado / comentar próprios | ✅ | ✅ | ✅ |
| Reservar recursos | ✅ | ✅ | ✅ |
| Ler base de conhecimento | ✅ | ✅ | ✅ |

---

## 9. Estrutura atual do sistema (resumo)

- **App SPA com SSR**: TanStack Start servindo via Vite; rotas em `src/routes/` geradas para `routeTree.gen.ts` pelo plugin.
- **Layout autenticado único** (`_authenticated/route.tsx` + `AppShell`): sidebar fixa + header + área de conteúdo.
- **Autenticação**: Supabase Auth (e-mail/senha) com gate de sessão no layout autenticado e roles em `user_roles`.
- **Lógica server-side da aplicação**: server functions em `src/lib/*.functions.ts` (ex.: `admin-users.functions.ts`, `admin-actions.functions.ts`, `bootstrap.functions.ts`) protegidas por `requireSupabaseAuth` quando necessário; o cliente admin do Supabase (`client.server.ts`) é usado apenas em código `.server`.
- **Acesso a dados a partir do cliente**: SDK Supabase com RLS em todas as tabelas e funções `SECURITY DEFINER` (`has_role`, `is_ti`, soft-delete, etc.) para operações que precisam contornar RLS de forma controlada.
- **Storage**: anexos de chamados e KB armazenados em buckets do Supabase Storage (URLs persistidas em `ticket_attachments` / `kb_attachments`).
- **Notificações**: persistidas em `notifications`, geradas por triggers, exibidas pelo sino no header e marcadas como lidas pela UI.
- **Auditoria**: `audit_log` recebe entradas via `log_admin_action`, `soft_delete_entity` e `restore_entity`.
- **Configurações via banco**: listas auxiliares (categorias, prioridades, status, fabricantes, sistemas operacionais, recursos de reserva, bloqueios) são todas editáveis pela UI de Administração.

---

*Fim da documentação.*

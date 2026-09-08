# Módulo Tarefas (Kanban da equipe de TI)

Novo módulo independente, sem tocar em Chamados nem em nenhum fluxo existente. Mesmo padrão visual do Portal TI (sidebar escura, cards clean, tipografia e cores atuais).

## Acesso

- Item **Tarefas** na seção **Operação** do menu lateral, visível apenas para Técnicos e Admins (mesma regra usada hoje pelo Inventário).
- Rota protegida `/tarefas`, dentro da área autenticada.

## Tela

Topo:
- Título "Tarefas" e subtítulo "Organize e acompanhe as atividades internas da equipe de TI."
- Busca por título, filtro por responsável, filtro por prioridade e botão **+ Nova Tarefa**.

Abaixo, o quadro Kanban ocupando toda a largura, com rolagem horizontal quando houver muitas colunas.

## Colunas

- Colunas iniciais: A Fazer, Em Andamento, Aguardando, Concluído.
- Cabeçalho da coluna mostra nome + contador de tarefas.
- Botão **+ Nova Coluna** ao final do quadro.
- Menu ⋮ em cada coluna: Renomear, Mover para esquerda, Mover para direita, Excluir.
- Ao excluir uma coluna com tarefas, abre confirmação obrigando escolher a coluna de destino das tarefas. Nenhuma tarefa é excluída automaticamente.
- Colunas são compartilhadas por toda a equipe (não são por usuário).

## Cards

Card fechado: título, prioridade (badge colorido), responsável e data de criação.

Arrastar e soltar move o card entre colunas e atualiza o status na hora (com atualização otimista e reversão em caso de erro). A ordem dentro da coluna também é preservada.

Ao clicar, abre um painel/modal de detalhe com edição de:
- Título
- Descrição (área de texto ampla para detalhar o problema/atividade)
- Responsável (membros da equipe de TI)
- Prioridade: Baixa, Média, Alta, Urgente
- Status (seleção da coluna, alternativa ao arraste)
- Data de criação (somente leitura)
- Excluir tarefa

Nova Tarefa: formulário com Título, Descrição, Responsável e Prioridade. A tarefa entra automaticamente na primeira coluna.

Fora de escopo, conforme pedido: horas, relatórios, projetos, checklists, subtarefas, anexos e comentários.

## Detalhes técnicos

Banco (nova migration, tabelas isoladas):
- `task_columns`: nome, ordem, timestamps. Seed com as 4 colunas iniciais.
- `tasks`: título, descrição, prioridade (enum baixa/media/alta/urgente), `column_id`, `assignee_id` (perfil), `created_by`, `position`, timestamps.
- GRANTs + RLS: leitura/escrita para usuários autenticados que sejam `tecnico` ou `admin` (via `has_role`); exclusão de coluna e de tarefa liberada para a mesma equipe.
- Trigger de `updated_at` reaproveitando a função existente.

Frontend:
- `src/routes/_authenticated/tarefas.tsx` com a página e `head()` próprio.
- Componentes em `src/components/tarefas/` (board, coluna, card, dialog de tarefa, dialogs de coluna).
- Drag and drop com HTML5 nativo (draggable + dragover/drop), sem nova dependência.
- Dados via React Query + cliente Supabase do browser, seguindo o padrão dos módulos atuais.
- Item de menu adicionado em `src/components/app-shell.tsx` na seção Operação, com `useIsTI()`.

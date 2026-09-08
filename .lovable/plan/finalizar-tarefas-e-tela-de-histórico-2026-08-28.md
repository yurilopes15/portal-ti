# Finalizar tarefas e tela de histórico

## Objetivo
Tarefas que chegam na coluna de conclusão ganham um botão "Finalizar". Ao finalizar, a tarefa sai do quadro e passa a ser consultada em uma tela de Histórico.

## Como vai funcionar

1. **Coluna de conclusão**
   - Cada coluna passa a ter a marcação "coluna de conclusão" (ativável ao criar/renomear coluna).
   - A coluna chamada "Concluído" já existente é marcada automaticamente.

2. **Botão Finalizar**
   - Cards que estiverem em uma coluna de conclusão exibem o botão "Finalizar tarefa" (também no menu do card).
   - Confirmação rápida antes de finalizar.
   - Ao finalizar, guardamos data/hora e quem finalizou; o card desaparece do quadro.

3. **Tela de Histórico**
   - Nova página em `/tarefas/historico`, acessível por um botão "Histórico" no topo do quadro e pelo submenu Tarefas na barra lateral (apenas equipe de TI).
   - Lista as tarefas finalizadas com título, descrição, prioridade, responsável, coluna de origem, quem finalizou e quando.
   - Busca por título, filtros por responsável e prioridade, e período (data de finalização).
   - Ação "Reabrir" devolve a tarefa ao quadro na coluna de origem.

## Detalhes técnicos

- **Migração**: `task_columns.is_final boolean not null default false` (marcar a coluna "Concluído"); `tasks.finished_at timestamptz`, `tasks.finished_by uuid`. Índice em `finished_at`. Políticas RLS existentes (TI) continuam valendo.
- `src/components/tarefas/tarefas-board.tsx`: consulta de tasks filtra `finished_at is null`; botão/ação de finalizar via update; checkbox "coluna de conclusão" no `ColumnDialog`; botão "Histórico".
- Nova rota `src/routes/_authenticated/tarefas.historico.tsx` (rota atual vira `tarefas.index.tsx`) com head() próprio, tabela responsiva e ação de reabrir (`finished_at = null`).
- `src/components/app-shell.tsx`: item Tarefas vira grupo colapsável com "Quadro" e "Histórico".

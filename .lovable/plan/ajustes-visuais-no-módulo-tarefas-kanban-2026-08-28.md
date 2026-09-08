# Ajustes visuais no módulo Tarefas (Kanban)

## Objetivo
1. Mover o botão **Nova Coluna** para o topo da tela, ao lado do botão **Histórico**.
2. Fazer o quadro Kanban ocupar a altura disponível da tela.
3. Permitir escolher uma **cor para cada card**, com a escrita adaptando automaticamente (clara ou escura) para manter a legibilidade.

## Mudanças

### 1. Banco de dados (migração)
- Adicionar coluna `color` (texto, opcional) na tabela `tasks` para guardar a cor do card em hexadecimal.
- Sem mudanças de permissão: a tabela já possui regras de acesso para a equipe de TI.

### 2. Botão "Nova Coluna" no topo — `src/components/tarefas/tarefas-board.tsx`
- Mover o botão "Nova Coluna" (hoje no fim da lista de colunas) para o cabeçalho, ao lado de "Histórico" e "Nova Tarefa".
- Remover o botão antigo que ficava ao lado das colunas.

### 3. Kanban em altura total
- Transformar o container da página em layout flexível de altura total (`h-full`/`flex-1`), de forma que:
  - Cabeçalho e filtros ficam fixos no topo.
  - A área das colunas ocupa todo o espaço restante, com rolagem horizontal quando houver muitas colunas e rolagem vertical dentro de cada coluna quando houver muitos cards.

### 4. Cor no card com texto adaptável
- No modal de tarefa (criar/editar), adicionar seletor **Cor do card** com uma paleta de cores predefinidas (ex.: verde, azul, âmbar, vermelho, roxo, rosa) + opção "Padrão" (sem cor).
- No quadro, o card colorido usa a cor escolhida como fundo; o texto (título, responsável, data) muda automaticamente para branco ou escuro conforme a luminosidade da cor (cálculo de contraste), garantindo leitura.
- A badge de prioridade mantém o estilo atual sobre o fundo colorido.
- Na tela de Histórico, o card/linha da tarefa também reflete a cor quando definida.

## Detalhes técnicos
- Função utilitária `cardTextColor(hex)` calcula luminância relativa e retorna texto claro/escuro (limiar WCAG), aplicada via estilo inline apenas quando `task.color` existe; sem cor definida, o card usa os tokens semânticos atuais (dark mode preservado).
- Arquivos tocados: migração SQL (`tasks.color`), `tarefas-board.tsx` (layout + seletor + render), `tarefas.historico.tsx` (exibir cor).

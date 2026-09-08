DROP POLICY IF EXISTS "Kanban gerencia proprio quadro" ON public.task_columns;
DROP POLICY IF EXISTS "Kanban gerencia proprias tarefas" ON public.tasks;

CREATE POLICY "Usuario gerencia proprio quadro" ON public.task_columns
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Usuario gerencia proprias tarefas" ON public.tasks
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
ALTER TABLE public.task_columns ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS owner_id uuid;

CREATE INDEX IF NOT EXISTS idx_task_columns_owner ON public.task_columns(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner_id);

DROP POLICY IF EXISTS "TI pode gerenciar colunas" ON public.task_columns;
DROP POLICY IF EXISTS "TI pode gerenciar tarefas" ON public.tasks;

CREATE POLICY "TI gerencia quadro da equipe" ON public.task_columns FOR ALL TO authenticated
USING (owner_id IS NULL AND (public.has_role(auth.uid(),'tecnico'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)))
WITH CHECK (owner_id IS NULL AND (public.has_role(auth.uid(),'tecnico'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Kanban gerencia proprio quadro" ON public.task_columns FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.has_role(auth.uid(),'kanban'::app_role))
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(),'kanban'::app_role));

CREATE POLICY "TI gerencia tarefas da equipe" ON public.tasks FOR ALL TO authenticated
USING (owner_id IS NULL AND (public.has_role(auth.uid(),'tecnico'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)))
WITH CHECK (owner_id IS NULL AND (public.has_role(auth.uid(),'tecnico'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Kanban gerencia proprias tarefas" ON public.tasks FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.has_role(auth.uid(),'kanban'::app_role))
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(),'kanban'::app_role));
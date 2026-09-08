ALTER TABLE public.task_columns ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_task_columns_department_id ON public.task_columns(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON public.tasks(department_id);

CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.profiles p
  JOIN public.departments d ON lower(trim(d.nome)) = lower(trim(p.departamento))
  WHERE p.id = auth.uid()
    AND p.departamento IS NOT NULL
    AND d.ativo = true
  LIMIT 1
$$;

DROP POLICY IF EXISTS "TI gerencia quadro da equipe" ON public.task_columns;
DROP POLICY IF EXISTS "TI gerencia tarefas da equipe" ON public.tasks;

CREATE POLICY "TI gerencia quadro da equipe" ON public.task_columns
FOR ALL TO authenticated
USING (owner_id IS NULL AND department_id IS NULL AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (owner_id IS NULL AND department_id IS NULL AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "TI gerencia tarefas da equipe" ON public.tasks
FOR ALL TO authenticated
USING (owner_id IS NULL AND department_id IS NULL AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (owner_id IS NULL AND department_id IS NULL AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Departamento gerencia seu quadro" ON public.task_columns
FOR ALL TO authenticated
USING (department_id IS NOT NULL AND department_id = public.current_department_id())
WITH CHECK (department_id IS NOT NULL AND department_id = public.current_department_id());

CREATE POLICY "Departamento gerencia suas tarefas" ON public.tasks
FOR ALL TO authenticated
USING (department_id IS NOT NULL AND department_id = public.current_department_id())
WITH CHECK (department_id IS NOT NULL AND department_id = public.current_department_id());
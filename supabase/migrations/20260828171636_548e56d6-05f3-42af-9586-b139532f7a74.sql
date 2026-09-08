CREATE TABLE public.task_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_columns TO authenticated;
GRANT ALL ON public.task_columns TO service_role;

ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TI pode gerenciar colunas" ON public.task_columns
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  prioridade text NOT NULL DEFAULT 'media',
  column_id uuid NOT NULL REFERENCES public.task_columns(id) ON DELETE RESTRICT,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_column ON public.tasks(column_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TI pode gerenciar tarefas" ON public.tasks
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_task_columns_updated_at BEFORE UPDATE ON public.task_columns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.task_columns (nome, ordem) VALUES
  ('A Fazer', 0),
  ('Em Andamento', 1),
  ('Aguardando', 2),
  ('Concluído', 3);
ALTER TABLE public.task_columns ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS finished_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS finished_by uuid;
CREATE INDEX IF NOT EXISTS tasks_finished_at_idx ON public.tasks (finished_at);
UPDATE public.task_columns SET is_final = true WHERE lower(nome) IN ('concluído','concluido');
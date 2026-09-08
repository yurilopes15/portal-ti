
-- Nova categoria de chamado para reservas
INSERT INTO public.ticket_categories (nome, cor, ordem, ativo)
SELECT 'Reserva de Equipamentos', '#6366f1', COALESCE((SELECT MAX(ordem)+1 FROM public.ticket_categories), 1), true
WHERE NOT EXISTS (SELECT 1 FROM public.ticket_categories WHERE nome = 'Reserva de Equipamentos');

-- Tipos
DO $$ BEGIN
  CREATE TYPE public.resource_type AS ENUM ('room','equipment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('reservado','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_status AS ENUM ('disponivel','manutencao','inativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recursos (salas e equipamentos)
CREATE TABLE IF NOT EXISTS public.reservation_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type public.resource_type NOT NULL,
  description TEXT,
  patrimonio TEXT,
  status public.resource_status NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservation_resources TO authenticated;
GRANT ALL ON public.reservation_resources TO service_role;

ALTER TABLE public.reservation_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read resources" ON public.reservation_resources;
CREATE POLICY "Authenticated can read resources" ON public.reservation_resources
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage resources" ON public.reservation_resources;
CREATE POLICY "Admins manage resources" ON public.reservation_resources
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_reservation_resources_updated
  BEFORE UPDATE ON public.reservation_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reservas
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.reservation_resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  status public.reservation_status NOT NULL DEFAULT 'reservado',
  linked_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_datetime > start_datetime)
);

CREATE INDEX IF NOT EXISTS idx_reservations_resource ON public.reservations(resource_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON public.reservations(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read reservations" ON public.reservations;
CREATE POLICY "Authenticated read reservations" ON public.reservations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users create own reservations" ON public.reservations;
CREATE POLICY "Users create own reservations" ON public.reservations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners or admins update reservations" ON public.reservations;
CREATE POLICY "Owners or admins update reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Owners or admins delete reservations" ON public.reservations;
CREATE POLICY "Owners or admins delete reservations" ON public.reservations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_reservations_updated
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conflito de horários
CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'reservado' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.resource_id = NEW.resource_id
      AND r.id <> NEW.id
      AND r.status = 'reservado'
      AND r.start_datetime < NEW.end_datetime
      AND r.end_datetime > NEW.start_datetime
  ) THEN
    RAISE EXCEPTION 'Já existe uma reserva para este recurso no intervalo selecionado.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reservations_overlap ON public.reservations;
CREATE TRIGGER trg_reservations_overlap
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_reservation_overlap();

-- Seed de salas e equipamentos
INSERT INTO public.reservation_resources (name, type, patrimonio)
SELECT v.name, v.type::public.resource_type, v.patrimonio
FROM (VALUES
  ('Sala 1','room',NULL),
  ('Sala 2','room',NULL),
  ('Sala 3','room',NULL),
  ('Sala de Reunião','room',NULL),
  ('Sala Comercial','room',NULL),
  ('Notebook 01','equipment','PAT-NB-001'),
  ('Notebook 02','equipment','PAT-NB-002'),
  ('Notebook 03','equipment','PAT-NB-003'),
  ('Projetor','equipment','PAT-PJ-001'),
  ('Webcam','equipment','PAT-WC-001'),
  ('Microfone','equipment','PAT-MIC-001')
) AS v(name,type,patrimonio)
WHERE NOT EXISTS (SELECT 1 FROM public.reservation_resources r WHERE r.name = v.name);


-- =========================================================
-- Lookup tables for ticket configuration
-- =========================================================
CREATE TABLE public.ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#64748b',
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_categories TO authenticated;
GRANT ALL ON public.ticket_categories TO service_role;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ticket_categories" ON public.ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ticket_categories" ON public.ticket_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ticket_categories_updated BEFORE UPDATE ON public.ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ticket_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#64748b',
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_priorities TO authenticated;
GRANT ALL ON public.ticket_priorities TO service_role;
ALTER TABLE public.ticket_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ticket_priorities" ON public.ticket_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ticket_priorities" ON public.ticket_priorities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ticket_priorities_updated BEFORE UPDATE ON public.ticket_priorities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ticket_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#64748b',
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_inicial BOOLEAN NOT NULL DEFAULT false,
  is_resolvido BOOLEAN NOT NULL DEFAULT false,
  is_fechado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_statuses TO authenticated;
GRANT ALL ON public.ticket_statuses TO service_role;
ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ticket_statuses" ON public.ticket_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ticket_statuses" ON public.ticket_statuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ticket_statuses_updated BEFORE UPDATE ON public.ticket_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Seed default values
-- =========================================================
INSERT INTO public.ticket_categories (nome, cor, ordem) VALUES
  ('Hardware','#dc2626',10),('Software','#2563eb',20),('Rede','#0ea5e9',30),
  ('ERP','#7c3aed',40),('Telefonia','#0891b2',50),('Impressoras','#d97706',60),
  ('TOTVS','#16a34a',70),('Coletores','#ea580c',80),('E-mail','#0284c7',85),
  ('Outros','#64748b',999)
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.ticket_priorities (nome, cor, ordem) VALUES
  ('Baixa','#64748b',10),('Média','#2563eb',20),('Alta','#d97706',30),('Crítica','#dc2626',40)
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.ticket_statuses (nome, cor, ordem, is_inicial, is_resolvido, is_fechado) VALUES
  ('Aberto','#0ea5e9',10,true,false,false),
  ('Em Atendimento','#d97706',20,false,false,false),
  ('Aguardando Usuário','#a855f7',30,false,false,false),
  ('Aguardando Fornecedor','#a855f7',31,false,false,false),
  ('Aguardando Peça','#a855f7',32,false,false,false),
  ('Resolvido','#16a34a',90,false,true,false),
  ('Fechado','#64748b',95,false,false,true),
  ('Cancelado','#6b7280',99,false,false,true)
  ON CONFLICT (nome) DO NOTHING;

-- =========================================================
-- Convert enum columns to text (drop default first, then re-add)
-- =========================================================
ALTER TABLE public.tickets ALTER COLUMN categoria DROP DEFAULT;
ALTER TABLE public.tickets ALTER COLUMN prioridade DROP DEFAULT;
ALTER TABLE public.tickets ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.tickets ALTER COLUMN categoria TYPE TEXT USING categoria::text;
ALTER TABLE public.tickets ALTER COLUMN prioridade TYPE TEXT USING prioridade::text;
ALTER TABLE public.tickets ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.tickets ALTER COLUMN status SET DEFAULT 'Aberto';
ALTER TABLE public.tickets ALTER COLUMN prioridade SET DEFAULT 'Média';

-- =========================================================
-- FK columns on tickets (RESTRICT prevents deleting in-use lookups)
-- =========================================================
ALTER TABLE public.tickets
  ADD COLUMN category_id UUID REFERENCES public.ticket_categories(id) ON DELETE RESTRICT,
  ADD COLUMN priority_id UUID REFERENCES public.ticket_priorities(id) ON DELETE RESTRICT,
  ADD COLUMN status_id   UUID REFERENCES public.ticket_statuses(id)   ON DELETE RESTRICT;

-- =========================================================
-- Backfill FKs from legacy text values
-- =========================================================
UPDATE public.tickets t SET category_id = c.id FROM public.ticket_categories c
  WHERE c.nome = CASE lower(t.categoria)
    WHEN 'hardware' THEN 'Hardware' WHEN 'software' THEN 'Software' WHEN 'rede' THEN 'Rede'
    WHEN 'erp' THEN 'ERP' WHEN 'telefonia' THEN 'Telefonia' WHEN 'impressoras' THEN 'Impressoras'
    WHEN 'email' THEN 'E-mail' WHEN 'outros' THEN 'Outros' ELSE initcap(t.categoria)
  END AND t.category_id IS NULL;

UPDATE public.tickets t SET priority_id = p.id FROM public.ticket_priorities p
  WHERE p.nome = CASE lower(t.prioridade)
    WHEN 'baixa' THEN 'Baixa' WHEN 'media' THEN 'Média' WHEN 'alta' THEN 'Alta' WHEN 'critica' THEN 'Crítica'
    ELSE initcap(t.prioridade)
  END AND t.priority_id IS NULL;

UPDATE public.tickets t SET status_id = s.id FROM public.ticket_statuses s
  WHERE s.nome = CASE lower(t.status)
    WHEN 'aberto' THEN 'Aberto' WHEN 'em_atendimento' THEN 'Em Atendimento'
    WHEN 'aguardando_usuario' THEN 'Aguardando Usuário'
    WHEN 'resolvido' THEN 'Resolvido' WHEN 'fechado' THEN 'Fechado'
    ELSE initcap(replace(t.status,'_',' '))
  END AND t.status_id IS NULL;

-- Normalize legacy text values to match lookup names
UPDATE public.tickets t SET
  categoria = COALESCE((SELECT nome FROM public.ticket_categories WHERE id = t.category_id), t.categoria),
  prioridade = COALESCE((SELECT nome FROM public.ticket_priorities WHERE id = t.priority_id), t.prioridade),
  status = COALESCE((SELECT nome FROM public.ticket_statuses WHERE id = t.status_id), t.status);

-- =========================================================
-- Update timestamp trigger to use status flags (works on text or via status_id)
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_ticket_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_is_resolvido BOOLEAN := false;
  v_is_fechado   BOOLEAN := false;
  v_was_resolvido BOOLEAN := false;
  v_was_fechado   BOOLEAN := false;
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT is_resolvido, is_fechado INTO v_is_resolvido, v_is_fechado
      FROM public.ticket_statuses WHERE id = NEW.status_id;
  ELSIF NEW.status IS NOT NULL THEN
    SELECT is_resolvido, is_fechado INTO v_is_resolvido, v_is_fechado
      FROM public.ticket_statuses WHERE nome = NEW.status;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status_id IS NOT NULL THEN
      SELECT is_resolvido, is_fechado INTO v_was_resolvido, v_was_fechado
        FROM public.ticket_statuses WHERE id = OLD.status_id;
    ELSIF OLD.status IS NOT NULL THEN
      SELECT is_resolvido, is_fechado INTO v_was_resolvido, v_was_fechado
        FROM public.ticket_statuses WHERE nome = OLD.status;
    END IF;
  END IF;

  IF COALESCE(v_is_resolvido,false) AND NOT COALESCE(v_was_resolvido,false) THEN
    NEW.resolvido_em := now();
  END IF;
  IF COALESCE(v_is_fechado,false) AND NOT COALESCE(v_was_fechado,false) THEN
    NEW.fechado_em := now();
    IF NEW.resolvido_em IS NULL THEN NEW.resolvido_em := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

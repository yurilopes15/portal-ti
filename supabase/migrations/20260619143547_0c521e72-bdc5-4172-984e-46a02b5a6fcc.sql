
-- Helper trigger function already exists: public.update_updated_at_column()

-- =========================================================
-- Lookup tables for inventory configuration
-- =========================================================
CREATE TABLE public.inventory_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_types TO authenticated;
GRANT ALL ON public.inventory_types TO service_role;
ALTER TABLE public.inventory_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_types" ON public.inventory_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_types" ON public.inventory_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_inventory_types_updated BEFORE UPDATE ON public.inventory_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inventory_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_statuses TO authenticated;
GRANT ALL ON public.inventory_statuses TO service_role;
ALTER TABLE public.inventory_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_statuses" ON public.inventory_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_statuses" ON public.inventory_statuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_inventory_statuses_updated BEFORE UPDATE ON public.inventory_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inventory_manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_manufacturers TO authenticated;
GRANT ALL ON public.inventory_manufacturers TO service_role;
ALTER TABLE public.inventory_manufacturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_manufacturers" ON public.inventory_manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_manufacturers" ON public.inventory_manufacturers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_inventory_manufacturers_updated BEFORE UPDATE ON public.inventory_manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inventory_operating_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_operating_systems TO authenticated;
GRANT ALL ON public.inventory_operating_systems TO service_role;
ALTER TABLE public.inventory_operating_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_os" ON public.inventory_operating_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_os" ON public.inventory_operating_systems FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_inventory_os_updated BEFORE UPDATE ON public.inventory_operating_systems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- FK columns on inventory_items (ON DELETE RESTRICT prevents hard delete if linked)
-- =========================================================
ALTER TABLE public.inventory_items
  ADD COLUMN type_id UUID REFERENCES public.inventory_types(id) ON DELETE RESTRICT,
  ADD COLUMN status_id UUID REFERENCES public.inventory_statuses(id) ON DELETE RESTRICT,
  ADD COLUMN manufacturer_id UUID REFERENCES public.inventory_manufacturers(id) ON DELETE RESTRICT,
  ADD COLUMN operating_system_id UUID REFERENCES public.inventory_operating_systems(id) ON DELETE RESTRICT;

-- =========================================================
-- Seed default values
-- =========================================================
INSERT INTO public.inventory_types (nome) VALUES
  ('Notebook'),('Desktop'),('Servidor'),('Impressora'),('Switch'),('Firewall'),('Monitor')
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.inventory_statuses (nome) VALUES
  ('Ativo'),('Em Manutenção'),('Reserva'),('Baixado')
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.inventory_manufacturers (nome) VALUES
  ('Dell'),('Lenovo'),('HP'),('Samsung'),('Cisco'),('Apple')
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.inventory_operating_systems (nome) VALUES
  ('Windows 10 Pro'),('Windows 11 Pro'),('Windows Server 2022'),('Ubuntu'),('Debian'),('macOS')
  ON CONFLICT (nome) DO NOTHING;

-- =========================================================
-- Backfill FK columns from existing text values (case-insensitive match)
-- =========================================================
-- Insert any existing distinct text values not already in lookup tables
INSERT INTO public.inventory_types (nome)
  SELECT DISTINCT initcap(trim(tipo)) FROM public.inventory_items
  WHERE tipo IS NOT NULL AND trim(tipo) <> ''
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.inventory_statuses (nome)
  SELECT DISTINCT initcap(replace(trim(status),'_',' ')) FROM public.inventory_items
  WHERE status IS NOT NULL AND trim(status) <> ''
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.inventory_manufacturers (nome)
  SELECT DISTINCT initcap(trim(fabricante)) FROM public.inventory_items
  WHERE fabricante IS NOT NULL AND trim(fabricante) <> ''
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.inventory_operating_systems (nome)
  SELECT DISTINCT trim(operating_system) FROM public.inventory_items
  WHERE operating_system IS NOT NULL AND trim(operating_system) <> ''
  ON CONFLICT (nome) DO NOTHING;

UPDATE public.inventory_items i SET type_id = t.id
  FROM public.inventory_types t WHERE lower(t.nome) = lower(trim(i.tipo)) AND i.type_id IS NULL;

UPDATE public.inventory_items i SET status_id = s.id
  FROM public.inventory_statuses s WHERE lower(s.nome) = lower(replace(trim(i.status),'_',' ')) AND i.status_id IS NULL;

UPDATE public.inventory_items i SET manufacturer_id = m.id
  FROM public.inventory_manufacturers m WHERE lower(m.nome) = lower(trim(i.fabricante)) AND i.manufacturer_id IS NULL;

UPDATE public.inventory_items i SET operating_system_id = o.id
  FROM public.inventory_operating_systems o WHERE lower(o.nome) = lower(trim(i.operating_system)) AND i.operating_system_id IS NULL;

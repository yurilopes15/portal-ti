
CREATE TABLE public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inventory_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_categories TO authenticated;
GRANT ALL ON public.inventory_categories TO service_role;

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read categories" ON public.inventory_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti manage categories" ON public.inventory_categories
  FOR ALL TO authenticated
  USING (public.is_ti(auth.uid()))
  WITH CHECK (public.is_ti(auth.uid()));

CREATE TRIGGER inventory_categories_updated_at
  BEFORE UPDATE ON public.inventory_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.inventory_categories (nome) VALUES
  ('Notebook'), ('Desktop'), ('Servidor'), ('Impressora'),
  ('Switch'), ('Access Point'), ('Firewall'), ('Monitor'),
  ('Celular Corporativo'), ('Tablet'), ('Outros')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS anydesk_id text,
  ADD COLUMN IF NOT EXISTS teamviewer_id text,
  ADD COLUMN IF NOT EXISTS computer_name text,
  ADD COLUMN IF NOT EXISTS operating_system text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.inventory_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_items_category_id_idx ON public.inventory_items(category_id);
CREATE INDEX IF NOT EXISTS inventory_items_responsavel_id_idx ON public.inventory_items(responsavel_id);

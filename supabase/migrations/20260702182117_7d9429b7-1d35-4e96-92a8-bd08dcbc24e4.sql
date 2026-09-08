
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS license_url TEXT,
  ADD COLUMN IF NOT EXISTS license_username TEXT,
  ADD COLUMN IF NOT EXISTS license_password TEXT,
  ADD COLUMN IF NOT EXISTS license_expires_at DATE,
  ADD COLUMN IF NOT EXISTS license_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS license_alert_days INTEGER[] NOT NULL DEFAULT ARRAY[30,7]::INTEGER[];

INSERT INTO public.inventory_categories (nome, descricao, ativo)
SELECT 'Licenças', 'Licenças de software, SaaS e assinaturas', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_categories WHERE LOWER(nome) = 'licenças');

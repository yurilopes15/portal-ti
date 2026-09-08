
CREATE TABLE public.kb_content_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kb_content_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kb_content_types TO authenticated;
GRANT ALL ON public.kb_content_types TO service_role;

ALTER TABLE public.kb_content_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view content types"
  ON public.kb_content_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "TI can insert content types"
  ON public.kb_content_types FOR INSERT TO authenticated
  WITH CHECK (public.is_ti(auth.uid()));

CREATE POLICY "TI can update content types"
  ON public.kb_content_types FOR UPDATE TO authenticated
  USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));

CREATE POLICY "Admins can delete content types"
  ON public.kb_content_types FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_kb_content_types_updated
  BEFORE UPDATE ON public.kb_content_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.kb_content_types (nome, slug) VALUES
  ('Artigo', 'artigo'),
  ('Procedimento', 'procedimento'),
  ('Manual', 'manual'),
  ('Política', 'politica')
ON CONFLICT (slug) DO NOTHING;


-- Tipo de conteúdo for KB articles
CREATE TYPE public.kb_content_type AS ENUM ('artigo','procedimento','manual','politica');

ALTER TABLE public.kb_articles
  ADD COLUMN tipo_conteudo public.kb_content_type NOT NULL DEFAULT 'artigo';

-- KB attachments table (mirrors ticket_attachments)
CREATE TABLE public.kb_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome TEXT NOT NULL,
  tamanho BIGINT NOT NULL,
  mime TEXT,
  enviado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_attachments_article ON public.kb_attachments(article_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_attachments TO authenticated;
GRANT ALL ON public.kb_attachments TO service_role;

ALTER TABLE public.kb_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ve anexos de artigos visiveis" ON public.kb_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kb_articles a
    WHERE a.id = kb_attachments.article_id
      AND (a.deleted_at IS NULL OR public.has_role(auth.uid(),'admin'))
      AND (a.publicado = true OR public.is_ti(auth.uid()))
  ));

CREATE POLICY "TI gerencia anexos KB" ON public.kb_attachments
  FOR ALL TO authenticated
  USING (public.is_ti(auth.uid()))
  WITH CHECK (public.is_ti(auth.uid()) AND enviado_por = auth.uid());

-- Storage policies for kb-attachments bucket (bucket created separately via tool)
CREATE POLICY "KB anexos read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kb-attachments');

CREATE POLICY "KB anexos upload TI" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kb-attachments' AND public.is_ti(auth.uid()));

CREATE POLICY "KB anexos delete TI" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kb-attachments' AND public.is_ti(auth.uid()));

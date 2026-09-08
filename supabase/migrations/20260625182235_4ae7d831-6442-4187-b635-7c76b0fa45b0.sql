
ALTER TABLE public.kb_articles
  ALTER COLUMN tipo_conteudo DROP DEFAULT,
  ALTER COLUMN tipo_conteudo TYPE TEXT USING tipo_conteudo::text,
  ALTER COLUMN tipo_conteudo SET DEFAULT 'artigo';

DROP TYPE IF EXISTS public.kb_content_type;

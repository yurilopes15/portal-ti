
-- 1. Soft-delete columns
ALTER TABLE public.tickets         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.kb_articles     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_tickets_not_deleted ON public.tickets (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_not_deleted ON public.inventory_items (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kb_not_deleted ON public.kb_articles (id) WHERE deleted_at IS NULL;

-- 2. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads audit log" ON public.audit_log;
CREATE POLICY "Admin reads audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log (created_at DESC);

-- 3. Soft delete / restore RPCs (admin only)
CREATE OR REPLACE FUNCTION public.soft_delete_entity(_entity_type TEXT, _entity_id UUID, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir registros';
  END IF;

  IF _entity_type = 'ticket' THEN
    UPDATE public.tickets SET deleted_at = now(), deleted_by = v_uid WHERE id = _entity_id AND deleted_at IS NULL;
  ELSIF _entity_type = 'inventory_item' THEN
    UPDATE public.inventory_items SET deleted_at = now(), deleted_by = v_uid WHERE id = _entity_id AND deleted_at IS NULL;
  ELSIF _entity_type = 'kb_article' THEN
    UPDATE public.kb_articles SET deleted_at = now(), deleted_by = v_uid WHERE id = _entity_id AND deleted_at IS NULL;
  ELSIF _entity_type = 'profile' THEN
    UPDATE public.profiles SET deleted_at = now(), deleted_by = v_uid, ativo = false WHERE id = _entity_id AND deleted_at IS NULL;
  ELSE
    RAISE EXCEPTION 'Tipo de entidade inválido: %', _entity_type;
  END IF;

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'delete', _entity_type, _entity_id, _metadata);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_entity(TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_entity(TEXT, UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_entity(_entity_type TEXT, _entity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar registros';
  END IF;
  IF _entity_type = 'ticket' THEN
    UPDATE public.tickets SET deleted_at = NULL, deleted_by = NULL WHERE id = _entity_id;
  ELSIF _entity_type = 'inventory_item' THEN
    UPDATE public.inventory_items SET deleted_at = NULL, deleted_by = NULL WHERE id = _entity_id;
  ELSIF _entity_type = 'kb_article' THEN
    UPDATE public.kb_articles SET deleted_at = NULL, deleted_by = NULL WHERE id = _entity_id;
  ELSIF _entity_type = 'profile' THEN
    UPDATE public.profiles SET deleted_at = NULL, deleted_by = NULL, ativo = true WHERE id = _entity_id;
  ELSE
    RAISE EXCEPTION 'Tipo inválido';
  END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id)
  VALUES (v_uid, 'restore', _entity_type, _entity_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restore_entity(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_entity(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_admin_action(_action TEXT, _entity_type TEXT, _entity_id UUID, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, _action, _entity_type, _entity_id, _metadata);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, JSONB) TO authenticated;

-- 4. RLS updates to hide soft-deleted rows for non-admin
DROP POLICY IF EXISTS "Usuario ve seus tickets" ON public.tickets;
CREATE POLICY "Usuario ve seus tickets" ON public.tickets FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
    AND (criado_por = auth.uid() OR public.is_ti(auth.uid()))
  );

DROP POLICY IF EXISTS "Ve inventario" ON public.inventory_items;
CREATE POLICY "Ve inventario" ON public.inventory_items FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
    AND (public.is_ti(auth.uid()) OR responsavel_id = auth.uid())
  );

DROP POLICY IF EXISTS "Ve artigos publicados" ON public.kb_articles;
CREATE POLICY "Ve artigos publicados" ON public.kb_articles FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
    AND (publicado = true OR public.is_ti(auth.uid()))
  );

DROP POLICY IF EXISTS "Usuarios veem proprio perfil" ON public.profiles;
CREATE POLICY "Usuarios veem proprio perfil" ON public.profiles FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
    AND (auth.uid() = id OR public.is_ti(auth.uid()))
  );

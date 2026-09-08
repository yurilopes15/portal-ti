
-- 1) Notifications INSERT policy: restrict
DROP POLICY IF EXISTS "Sistema cria notificacao" ON public.notifications;
CREATE POLICY "Cria notificacao restrita"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_ti(auth.uid())
  );

-- 2) Realtime broadcast/presence lockdown (postgres_changes are unaffected — they use the source table's RLS).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny realtime broadcast" ON realtime.messages;
CREATE POLICY "deny realtime broadcast"
  ON realtime.messages
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 3) Revoke EXECUTE on internal trigger functions (called by Postgres as table owner, not by clients)
REVOKE ALL ON FUNCTION public.notify_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_ticket_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ticket_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_ticket_timestamps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role / is_ti are used by RLS expressions. Revoke from anon, keep authenticated.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_ti(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ti(uuid) TO authenticated;

-- 4) Fix mutable search_path on set_ticket_timestamps
CREATE OR REPLACE FUNCTION public.set_ticket_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'resolvido' AND (OLD.status IS DISTINCT FROM 'resolvido') THEN
    NEW.resolvido_em = now();
  END IF;
  IF NEW.status = 'fechado' AND (OLD.status IS DISTINCT FROM 'fechado') THEN
    NEW.fechado_em = now();
    IF NEW.resolvido_em IS NULL THEN NEW.resolvido_em = now(); END IF;
  END IF;
  RETURN NEW;
END;
$function$;

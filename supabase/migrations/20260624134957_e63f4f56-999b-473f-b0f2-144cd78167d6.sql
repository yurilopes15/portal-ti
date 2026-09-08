
-- Revoke public EXECUTE on SECURITY DEFINER functions and grant only where needed

-- Trigger-only functions: nobody but postgres/service_role should call them
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_ticket_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ticket_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_ticket_timestamps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: must not be callable by anon; authenticated callers are
-- already gated by an internal has_role('admin') check inside each function.
REVOKE ALL ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_entity(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_entity(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_entity(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_entity(text, uuid, jsonb) TO authenticated;

-- Role-check helpers used by RLS policies: must remain callable by
-- authenticated so policies can evaluate, but not by anonymous users.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_ti(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ti(uuid) TO authenticated;

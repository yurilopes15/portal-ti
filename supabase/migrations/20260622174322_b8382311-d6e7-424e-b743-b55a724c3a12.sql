CREATE OR REPLACE FUNCTION public.set_ticket_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Marca resolvido_em ao entrar em status resolvido
  IF COALESCE(v_is_resolvido,false) AND NOT COALESCE(v_was_resolvido,false) THEN
    NEW.resolvido_em := now();
  END IF;

  -- Marca fechado_em ao entrar em status fechado
  IF COALESCE(v_is_fechado,false) AND NOT COALESCE(v_was_fechado,false) THEN
    NEW.fechado_em := now();
    IF NEW.resolvido_em IS NULL THEN NEW.resolvido_em := now(); END IF;
  END IF;

  -- Reset: se status atual NAO eh resolvido nem fechado, limpa resolvido_em
  IF NOT COALESCE(v_is_resolvido,false) AND NOT COALESCE(v_is_fechado,false) THEN
    NEW.resolvido_em := NULL;
  END IF;

  -- Reset: se status atual NAO eh fechado, limpa fechado_em
  IF NOT COALESCE(v_is_fechado,false) THEN
    NEW.fechado_em := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Limpa dados residuais existentes
UPDATE public.tickets t
SET resolvido_em = NULL
WHERE resolvido_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_statuses s
    WHERE (t.status_id IS NOT NULL AND s.id = t.status_id OR t.status_id IS NULL AND s.nome = t.status)
      AND (s.is_resolvido OR s.is_fechado)
  );

UPDATE public.tickets t
SET fechado_em = NULL
WHERE fechado_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_statuses s
    WHERE (t.status_id IS NOT NULL AND s.id = t.status_id OR t.status_id IS NULL AND s.nome = t.status)
      AND s.is_fechado
  );
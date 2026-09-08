
-- 1. sla_configs
CREATE TABLE public.sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_id UUID NOT NULL UNIQUE REFERENCES public.ticket_priorities(id) ON DELETE CASCADE,
  resolution_hours NUMERIC NOT NULL DEFAULT 24,
  first_response_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_configs TO authenticated;
GRANT ALL ON public.sla_configs TO service_role;
ALTER TABLE public.sla_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_configs read auth" ON public.sla_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_configs admin write" ON public.sla_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sla_configs_updated_at BEFORE UPDATE ON public.sla_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. sla_status_rules
CREATE TABLE public.sla_status_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL UNIQUE REFERENCES public.ticket_statuses(id) ON DELETE CASCADE,
  pause_sla BOOLEAN NOT NULL DEFAULT false,
  finish_sla BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sla_rule_exclusive CHECK (NOT (pause_sla AND finish_sla))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_status_rules TO authenticated;
GRANT ALL ON public.sla_status_rules TO service_role;
ALTER TABLE public.sla_status_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_status_rules read auth" ON public.sla_status_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_status_rules admin write" ON public.sla_status_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sla_status_rules_updated_at BEFORE UPDATE ON public.sla_status_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. tickets columns
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS first_response_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_pause_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_paused_seconds   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_finished_at      TIMESTAMPTZ;

-- 4. trigger: primeira resposta no comment
CREATE OR REPLACE FUNCTION public.set_ticket_first_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.autor_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_ti(NEW.autor_id) THEN RETURN NEW; END IF;
  UPDATE public.tickets
    SET first_response_at = now()
  WHERE id = NEW.ticket_id AND first_response_at IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_ticket_first_response ON public.ticket_comments;
CREATE TRIGGER trg_set_ticket_first_response
  AFTER INSERT ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_first_response();

-- 5. trigger: transições de status aplicam pausa/retomada/finalização
CREATE OR REPLACE FUNCTION public.apply_sla_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_status_id UUID;
  v_old_status_id UUID;
  v_pause BOOLEAN := false;
  v_finish BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_status_id := NULL;
  ELSE
    IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
      RETURN NEW;
    END IF;
    IF OLD.status_id IS NOT NULL THEN
      v_old_status_id := OLD.status_id;
    ELSIF OLD.status IS NOT NULL THEN
      SELECT id INTO v_old_status_id FROM public.ticket_statuses WHERE nome = OLD.status;
    END IF;
  END IF;

  IF NEW.status_id IS NOT NULL THEN
    v_new_status_id := NEW.status_id;
  ELSIF NEW.status IS NOT NULL THEN
    SELECT id INTO v_new_status_id FROM public.ticket_statuses WHERE nome = NEW.status;
  END IF;

  IF v_new_status_id IS NOT NULL THEN
    SELECT pause_sla, finish_sla INTO v_pause, v_finish
      FROM public.sla_status_rules WHERE status_id = v_new_status_id;
  END IF;
  v_pause := COALESCE(v_pause, false);
  v_finish := COALESCE(v_finish, false);

  -- Saindo de pausa: acumula segundos
  IF NOT v_pause AND NEW.sla_pause_started_at IS NOT NULL THEN
    NEW.sla_paused_seconds := COALESCE(NEW.sla_paused_seconds, 0)
      + GREATEST(0, EXTRACT(EPOCH FROM (now() - NEW.sla_pause_started_at))::INTEGER);
    NEW.sla_pause_started_at := NULL;
  END IF;

  -- Entrando em pausa
  IF v_pause AND NEW.sla_pause_started_at IS NULL THEN
    NEW.sla_pause_started_at := now();
  END IF;

  -- Finalização
  IF v_finish THEN
    IF NEW.sla_pause_started_at IS NOT NULL THEN
      NEW.sla_paused_seconds := COALESCE(NEW.sla_paused_seconds, 0)
        + GREATEST(0, EXTRACT(EPOCH FROM (now() - NEW.sla_pause_started_at))::INTEGER);
      NEW.sla_pause_started_at := NULL;
    END IF;
    IF NEW.sla_finished_at IS NULL THEN
      NEW.sla_finished_at := now();
    END IF;
  ELSE
    NEW.sla_finished_at := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_sla_status_transition ON public.tickets;
CREATE TRIGGER trg_apply_sla_status_transition
  BEFORE INSERT OR UPDATE OF status, status_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_sla_status_transition();

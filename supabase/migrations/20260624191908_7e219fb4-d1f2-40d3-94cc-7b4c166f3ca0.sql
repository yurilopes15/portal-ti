
CREATE TABLE IF NOT EXISTS public.reservation_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT ON public.reservation_blocked_dates TO authenticated;
GRANT ALL ON public.reservation_blocked_dates TO service_role;

ALTER TABLE public.reservation_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read blocked dates"
ON public.reservation_blocked_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage blocked dates"
ON public.reservation_blocked_dates FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT INSERT, UPDATE, DELETE ON public.reservation_blocked_dates TO authenticated;

-- Settings table for reservation rules (block weekends)
CREATE TABLE IF NOT EXISTS public.reservation_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  block_weekends BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.reservation_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.reservation_settings TO authenticated;
GRANT INSERT, UPDATE ON public.reservation_settings TO authenticated;
GRANT ALL ON public.reservation_settings TO service_role;

ALTER TABLE public.reservation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read reservation settings"
ON public.reservation_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage reservation settings"
ON public.reservation_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Allow admins to manage reservation_resources (add/remove rooms & equipment)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservation_resources' AND policyname='Admins manage resources') THEN
    CREATE POLICY "Admins manage resources"
    ON public.reservation_resources FOR ALL TO authenticated
    USING (public.has_role(auth.uid(),'admin'))
    WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.reservation_resources TO authenticated;

-- Trigger to enforce blocked dates / weekends on new reservations
CREATE OR REPLACE FUNCTION public.check_reservation_blocked()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_block_weekends BOOLEAN; v_dow INT;
BEGIN
  IF NEW.status <> 'reservado' THEN RETURN NEW; END IF;
  SELECT block_weekends INTO v_block_weekends FROM public.reservation_settings WHERE id = true;
  v_dow := EXTRACT(DOW FROM NEW.start_datetime);
  IF COALESCE(v_block_weekends, false) AND (v_dow = 0 OR v_dow = 6) THEN
    RAISE EXCEPTION 'Reservas não são permitidas em finais de semana.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservation_blocked_dates b
    WHERE b.data >= NEW.start_datetime::date
      AND b.data <= NEW.end_datetime::date
  ) THEN
    RAISE EXCEPTION 'A data selecionada está bloqueada para reservas.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_reservation_blocked ON public.reservations;
CREATE TRIGGER trg_check_reservation_blocked
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.check_reservation_blocked();

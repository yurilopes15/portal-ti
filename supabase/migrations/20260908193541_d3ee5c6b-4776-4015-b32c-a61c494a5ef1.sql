CREATE TABLE public.app_branding (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  app_name text NOT NULL DEFAULT 'Portal TI',
  company_name text NOT NULL DEFAULT 'Slotter',
  sidebar_logo_url text,
  login_logo_url text,
  favicon_url text,
  login_title text NOT NULL DEFAULT 'Portal TI Slotter',
  login_subtitle text NOT NULL DEFAULT 'Central de Atendimento de TI',
  login_bg_image_url text,
  login_bg_color text,
  primary_color text NOT NULL DEFAULT '#22a06b',
  primary_foreground_color text NOT NULL DEFAULT '#ffffff',
  accent_color text NOT NULL DEFAULT '#d9f2e5',
  sidebar_color text,
  radius text NOT NULL DEFAULT '0.5rem',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_branding TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_branding TO authenticated;
GRANT ALL ON public.app_branding TO service_role;

ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_public_read" ON public.app_branding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "branding_ti_insert" ON public.app_branding FOR INSERT TO authenticated WITH CHECK (public.is_ti(auth.uid()));
CREATE POLICY "branding_ti_update" ON public.app_branding FOR UPDATE TO authenticated USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));

CREATE TRIGGER update_app_branding_updated_at
BEFORE UPDATE ON public.app_branding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_branding (id) VALUES (true);
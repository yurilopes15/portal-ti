import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import slotterLogo from "@/assets/slotter-logo.png.asset.json";

export type Branding = {
  app_name: string;
  company_name: string;
  sidebar_logo_url: string | null;
  login_logo_url: string | null;
  favicon_url: string | null;
  login_title: string;
  login_subtitle: string;
  login_bg_image_url: string | null;
  login_bg_color: string | null;
  primary_color: string;
  primary_foreground_color: string;
  accent_color: string;
  accent_foreground_color: string;
  sidebar_color: string | null;
  radius: string;
};

export const DEFAULT_BRANDING: Branding = {
  app_name: "Portal TI",
  company_name: "Slotter",
  sidebar_logo_url: slotterLogo.url,
  login_logo_url: slotterLogo.url,
  favicon_url: slotterLogo.url,
  login_title: "Portal TI Slotter",
  login_subtitle: "Central de Atendimento de TI",
  login_bg_image_url: null,
  login_bg_color: null,
  primary_color: "#22a06b",
  primary_foreground_color: "#ffffff",
  accent_color: "#d9f2e5",
  accent_foreground_color: "#14532d",
  sidebar_color: null,
  radius: "0.5rem",
};

const COLUMNS =
  "app_name, company_name, sidebar_logo_url, login_logo_url, favicon_url, login_title, login_subtitle, login_bg_image_url, login_bg_color, primary_color, primary_foreground_color, accent_color, accent_foreground_color, sidebar_color, radius";

export const brandingKey = ["app-branding"] as const;

export function useBranding() {
  const query = useQuery({
    queryKey: brandingKey,
    staleTime: 60_000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase
        .from("app_branding")
        .select(COLUMNS)
        .maybeSingle();
      if (error || !data) return DEFAULT_BRANDING;
      const b = data as Partial<Branding>;
      return {
        ...DEFAULT_BRANDING,
        ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null && v !== undefined)),
        sidebar_logo_url: b.sidebar_logo_url ?? DEFAULT_BRANDING.sidebar_logo_url,
        login_logo_url: b.login_logo_url ?? DEFAULT_BRANDING.login_logo_url,
        favicon_url: b.favicon_url ?? DEFAULT_BRANDING.favicon_url,
        login_bg_image_url: b.login_bg_image_url ?? null,
        login_bg_color: b.login_bg_color ?? null,
        sidebar_color: b.sidebar_color ?? null,
      } as Branding;
    },
  });

  return { branding: query.data ?? DEFAULT_BRANDING, isLoading: query.isLoading };
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Branding>) => {
      const { error } = await supabase
        .from("app_branding")
        .upsert({ id: true, ...patch }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandingKey });
    },
  });
}

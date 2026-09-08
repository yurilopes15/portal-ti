import { useEffect } from "react";
import { useBranding, type Branding } from "@/hooks/use-branding";

export function applyBrandingVars(b: Branding, target?: HTMLElement) {
  const root = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!root) return;
  const set = (k: string, v: string | null) => {
    if (v) root.style.setProperty(k, v);
    else root.style.removeProperty(k);
  };
  const p = b.primary_color;
  set("--primary", p);
  set("--primary-foreground", b.primary_foreground_color);
  set("--primary-hover", `color-mix(in srgb, ${p} 85%, black)`);
  set("--accent", b.accent_color);
  set("--accent-foreground", `color-mix(in srgb, ${p} 80%, black)`);
  set("--ring", p);

  // Tons derivados da cor principal (evita resquícios da cor padrão)
  set("--secondary", `color-mix(in srgb, ${p} 12%, white)`);
  set("--secondary-foreground", `color-mix(in srgb, ${p} 75%, black)`);
  set("--muted", `color-mix(in srgb, ${p} 8%, white)`);
  set("--muted-foreground", `color-mix(in srgb, ${p} 45%, #6b7280)`);
  set("--border", `color-mix(in srgb, ${p} 18%, white)`);
  set("--input", `color-mix(in srgb, ${p} 18%, white)`);
  set("--chart-1", p);
  set("--chart-3", `color-mix(in srgb, ${p} 60%, white)`);

  const sb = b.sidebar_color ?? p;
  set("--sidebar", b.sidebar_color);
  set("--sidebar-primary", p);
  set("--sidebar-primary-foreground", b.primary_foreground_color);
  set("--sidebar-ring", p);
  set("--sidebar-accent", `color-mix(in srgb, ${sb} 70%, ${p})`);
  set("--sidebar-accent-foreground", "#ffffff");
  set("--sidebar-border", `color-mix(in srgb, ${sb} 75%, white)`);
  set("--radius", b.radius);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { branding } = useBranding();

  useEffect(() => {
    applyBrandingVars(branding);
  }, [branding]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (branding.favicon_url) {
      document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach((el) => {
        (el as HTMLLinkElement).href = branding.favicon_url as string;
      });
    }
    document.title = `${branding.app_name} ${branding.company_name}`.trim();
  }, [branding.favicon_url, branding.app_name, branding.company_name]);

  return <>{children}</>;
}

import { useEffect } from "react";
import { useBranding, type Branding } from "@/hooks/use-branding";

export function applyBrandingVars(b: Branding, target?: HTMLElement) {
  const root = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!root) return;
  const set = (k: string, v: string | null) => {
    if (v) root.style.setProperty(k, v);
    else root.style.removeProperty(k);
  };
  set("--primary", b.primary_color);
  set("--primary-foreground", b.primary_foreground_color);
  set("--primary-hover", `color-mix(in srgb, ${b.primary_color} 85%, black)`);
  set("--accent", b.accent_color);
  set("--accent-foreground", `color-mix(in srgb, ${b.primary_color} 80%, black)`);
  set("--ring", b.primary_color);
  set("--sidebar-primary", b.primary_color);
  set("--sidebar-primary-foreground", b.primary_foreground_color);
  set("--sidebar-ring", b.primary_color);
  set("--sidebar", b.sidebar_color);
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

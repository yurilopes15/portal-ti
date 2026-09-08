import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useBranding, useUpdateBranding, DEFAULT_BRANDING, type Branding } from "@/hooks/use-branding";
import { applyBrandingVars } from "@/components/branding-provider";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/admin/personalizacao")({
  head: () => ({
    meta: [
      { title: "Personalização — Portal TI" },
      { name: "description", content: "Configure cores, logos e a tela de login do portal." },
      { property: "og:title", content: "Personalização — Portal TI" },
      { property: "og:description", content: "Configure cores, logos e a tela de login do portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalizacaoPage,
});

const MAX_BYTES = 400 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");

  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem.");
    if (file.size > MAX_BYTES) return toast.error("Imagem muito grande (máximo 400 KB).");
    onChange(await fileToDataUrl(file));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-md border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">vazio</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Enviar imagem
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="h-4 w-4 mr-2" /> Remover
            </Button>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="ou cole o link da imagem (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!url.trim()) return;
            onChange(url.trim());
            setUrl("");
          }}
        >
          Usar link
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function PersonalizacaoPage() {
  const { branding } = useBranding();
  const { isTI } = usePermissions();
  const update = useUpdateBranding();
  const [form, setForm] = useState<Branding>(branding);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setForm(branding);
  }, [branding, dirty]);

  function set<K extends keyof Branding>(key: K, value: Branding[K]) {
    setDirty(true);
    setForm((f) => {
      const next = { ...f, [key]: value };
      applyBrandingVars(next);
      return next;
    });
  }

  async function save() {
    try {
      await update.mutateAsync(form);
      setDirty(false);
      toast.success("Personalização salva.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    }
  }

  function resetDefaults() {
    setDirty(true);
    setForm(DEFAULT_BRANDING);
    applyBrandingVars(DEFAULT_BRANDING);
  }

  if (!isTI) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personalização</h1>
            <p className="text-sm text-muted-foreground">
              Ajuste cores, logos, favicon e a tela de login do portal.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" /> Restaurar padrão
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </div>

        <Tabs defaultValue="identidade">
          <TabsList>
            <TabsTrigger value="identidade">Identidade</TabsTrigger>
            <TabsTrigger value="cores">Cores</TabsTrigger>
            <TabsTrigger value="login">Tela de login</TabsTrigger>
          </TabsList>

          <TabsContent value="identidade" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Identidade visual</CardTitle>
                <CardDescription>Nome exibido no menu e imagens da marca.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do portal</Label>
                    <Input value={form.app_name} onChange={(e) => set("app_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da empresa</Label>
                    <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
                  </div>
                </div>
                <Separator />
                <div className="grid gap-6 sm:grid-cols-2">
                  <ImageField
                    label="Logo do menu lateral"
                    hint="Ideal quadrado, até 400 KB."
                    value={form.sidebar_logo_url}
                    onChange={(v) => set("sidebar_logo_url", v)}
                  />
                  <ImageField
                    label="Ícone da aba (favicon)"
                    hint="Imagem quadrada e simples funciona melhor."
                    value={form.favicon_url}
                    onChange={(v) => set("favicon_url", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cores" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cores do sistema</CardTitle>
                <CardDescription>As mudanças aparecem na hora para você conferir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ColorField label="Cor principal" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
                  <ColorField
                    label="Cor do texto sobre a principal"
                    value={form.primary_foreground_color}
                    onChange={(v) => set("primary_foreground_color", v)}
                  />
                  <ColorField label="Cor de destaque" value={form.accent_color} onChange={(v) => set("accent_color", v)} />
                  <ColorField
                    label="Cor do texto do destaque"
                    value={form.accent_foreground_color}
                    onChange={(v) => set("accent_foreground_color", v)}
                  />
                  <ColorField
                    label="Cor do menu lateral"
                    value={form.sidebar_color ?? "#ffffff"}
                    onChange={(v) => set("sidebar_color", v)}
                  />
                  <div className="space-y-2">
                    <Label>Arredondamento dos cantos</Label>
                    <Input value={form.radius} onChange={(e) => set("radius", e.target.value)} placeholder="0.5rem" />
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Botão principal</Button>
                  <Button variant="secondary">Secundário</Button>
                  <Button variant="outline">Contorno</Button>
                  <span className="rounded-md bg-accent px-3 py-1 text-sm text-accent-foreground">Destaque</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="login" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tela de login</CardTitle>
                <CardDescription>Textos e imagens exibidos antes de entrar no sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={form.login_title} onChange={(e) => set("login_title", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input value={form.login_subtitle} onChange={(e) => set("login_subtitle", e.target.value)} />
                  </div>
                </div>
                <Separator />
                <div className="grid gap-6 sm:grid-cols-2">
                  <ImageField
                    label="Logo da tela de login"
                    value={form.login_logo_url}
                    onChange={(v) => set("login_logo_url", v)}
                  />
                  <ImageField
                    label="Imagem de fundo do login"
                    hint="Opcional. Sem imagem, é usado o fundo colorido."
                    value={form.login_bg_image_url}
                    onChange={(v) => set("login_bg_image_url", v)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label="Cor de fundo do login"
                    value={form.login_bg_color ?? "#f2f6f4"}
                    onChange={(v) => set("login_bg_color", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

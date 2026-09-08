import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import slotterLogo from "@/assets/slotter-logo.png.asset.json";
import { bootstrapFirstAdmin, hasAnyAdmin } from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const bootstrapFn = useServerFn(bootstrapFirstAdmin);
  const hasAdminFn = useServerFn(hasAnyAdmin);
  const [mode, setMode] = useState<"login" | "forgot" | "bootstrap">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hasAdminFn().then((r) => {
      if (!r.hasAdmin) setMode("bootstrap");
    }).catch(() => {});
  }, []);

  async function bootstrap(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await bootstrapFn({ data: { email, password, nome } });
      toast.success("Administrador criado! Faça login.");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Falha no login: " + error.message);
    toast.success("Bem-vindo ao Portal TI Slotter");
    nav({ to: "/" });
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um e-mail com instruções para redefinir sua senha.");
    setMode("login");
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-secondary to-accent p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center justify-center gap-3 mb-8">
          <img
            src={slotterLogo.url}
            alt="Slotter"
            className="h-16 w-16 rounded-lg object-contain"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Portal TI Slotter</h1>
            <p className="text-xs text-muted-foreground">Central de Atendimento de TI</p>
          </div>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <CardTitle>
              {mode === "login" ? "Acessar sua conta" : mode === "forgot" ? "Recuperar senha" : "Criar primeiro administrador"}
            </CardTitle>
            <CardDescription>
              {mode === "login" ? "Use suas credenciais corporativas para entrar."
                : mode === "forgot" ? "Informe seu e-mail para receber o link de redefinição."
                : "Nenhuma conta encontrada. Crie a primeira conta de administrador."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === "login" ? login : mode === "forgot" ? forgot : bootstrap} className="space-y-4">
              {mode === "bootstrap" && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              {(mode === "login" || mode === "bootstrap") && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha {mode === "bootstrap" && <span className="text-xs text-muted-foreground">(mín. 8 caracteres)</span>}</Label>
                  <Input id="password" type="password" minLength={mode === "bootstrap" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "login" ? "Entrar" : mode === "forgot" ? "Enviar link" : "Criar administrador"}
              </Button>
              {mode !== "bootstrap" && (
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "forgot" : "login")}
                  className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {mode === "login" ? "Esqueci minha senha" : "Voltar ao login"}
                </button>
              )}
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Não tem acesso? Solicite ao administrador de TI.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

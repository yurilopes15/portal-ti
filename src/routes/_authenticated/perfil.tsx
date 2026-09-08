import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useProfile, useUserRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, User as UserIcon, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
  errorComponent: ({ error }) => (
    <div className="text-sm text-destructive p-4">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-4">Página não encontrada</div>,
});

function PerfilPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: roles } = useUserRole();
  const qc = useQueryClient();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [departamento, setDepartamento] = useState<string>("");

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setTelefone(profile.telefone ?? "");
      setDepartamento(profile.departamento ?? "");
    }
  }, [profile]);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, nome, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!nome.trim()) throw new Error("Nome é obrigatório");
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          departamento: departamento || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Não autenticado");
      if (novaSenha.length < 6) throw new Error("A nova senha deve ter ao menos 6 caracteres");
      if (novaSenha !== confirmar) throw new Error("As senhas não coincidem");
      // Valida senha atual via reautenticação
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: senhaAtual,
      });
      if (signErr) throw new Error("Senha atual incorreta");
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso");
      setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleLabel = roles?.includes("admin") ? "Administrador" : roles?.includes("tecnico") ? "Técnico de TI" : "Usuário";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
          <h1 className="text-2xl font-semibold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus dados pessoais e credenciais de acesso.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" />Dados pessoais</CardTitle>
            <CardDescription>O e-mail é usado para autenticação e não pode ser alterado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" value={user?.email ?? ""} readOnly disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={32} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="departamento">Departamento</Label>
                    <Select value={departamento || "__none"} onValueChange={(v) => setDepartamento(v === "__none" ? "" : v)}>
                      <SelectTrigger id="departamento"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Não informado</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de cadastro</Label>
                    <Input value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"} readOnly disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Perfil de acesso</Label>
                    <div><Badge variant="secondary">{roleLabel}</Badge></div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saveProfile.isPending}>
                    {saveProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Alterar senha</CardTitle>
            <CardDescription>Para sua segurança, confirme a senha atual antes de definir uma nova.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="senhaAtual">Senha atual *</Label>
                <Input id="senhaAtual" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required autoComplete="current-password" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="novaSenha">Nova senha *</Label>
                  <Input id="novaSenha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={6} autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmar">Confirmar nova senha *</Label>
                  <Input id="confirmar" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} autoComplete="new-password" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Alterar senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  );
}

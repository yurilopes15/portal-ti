import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ShieldAlert, Loader2, KeyRound, Building2, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  createUser,
  setUserRole,
  deleteUser,
  setUserActive,
  setUserDepartment,
  resetUserPassword,
  updateUserProfile,
} from "@/lib/admin-users.functions";
import { useRoles } from "@/hooks/use-roles";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const createFn = useServerFn(createUser);
  const setRoleFn = useServerFn(setUserRole);
  const deleteFn = useServerFn(deleteUser);
  const setActiveFn = useServerFn(setUserActive);
  const setDeptFn = useServerFn(setUserDepartment);
  const resetPwdFn = useServerFn(resetUserPassword);
  const updateProfileFn = useServerFn(updateUserProfile);

  const [open, setOpen] = useState(false);
  const { data: roles = [] } = useRoles();
  const defaultRoleId = roles.find((r) => r.slug === "usuario")?.id ?? "";
  const [form, setForm] = useState({ email: "", nome: "", departamento: "", telefone: "", password: "", role_id: "" });
  const [loading, setLoading] = useState(false);

  const [editDept, setEditDept] = useState<{ id: string; nome: string; value: string } | null>(null);
  const [resetPwd, setResetPwd] = useState<{ id: string; nome: string; value: string } | null>(null);
  const [editUser, setEditUser] = useState<{ id: string; nome: string; email: string; telefone: string; departamento: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [deptFilter, setDeptFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"nome-asc" | "nome-desc" | "email-asc" | "email-desc" | "recentes" | "antigos">("nome-asc");

  const { data: users = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("nome");
      const { data: userRoles } = await supabase.from("user_roles").select("user_id, role, role_id");
      const roleMap = new Map<string, string | null>();
      (userRoles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role_id ?? null));
      return (profiles ?? []).map((p) => ({ ...p, role_id: roleMap.get(p.id) ?? null }));
    },
  });

  const { data: departments = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["departments-active"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const filteredUsers = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (users as any[]).filter((u) => {
      if (roleFilter !== "todos" && u.role_id !== roleFilter) return false;
      if (statusFilter === "ativos" && !u.ativo) return false;
      if (statusFilter === "inativos" && u.ativo) return false;
      if (deptFilter !== "todos") {
        if (deptFilter === "__none") { if (u.departamento) return false; }
        else if (u.departamento !== deptFilter) return false;
      }
      if (term) {
        const hay = `${u.nome ?? ""} ${u.email ?? ""} ${u.telefone ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const cmp = (a: any, b: any) => {
      switch (sortBy) {
        case "nome-asc": return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR");
        case "nome-desc": return (b.nome ?? "").localeCompare(a.nome ?? "", "pt-BR");
        case "email-asc": return (a.email ?? "").localeCompare(b.email ?? "");
        case "email-desc": return (b.email ?? "").localeCompare(a.email ?? "");
        case "recentes": return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        case "antigos": return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        default: return 0;
      }
    };
    return [...list].sort(cmp);
  }, [users, q, roleFilter, statusFilter, deptFilter, sortBy]);

  const hasActiveFilters = q !== "" || roleFilter !== "todos" || statusFilter !== "todos" || deptFilter !== "todos" || sortBy !== "nome-asc";
  const clearFilters = () => { setQ(""); setRoleFilter("todos"); setStatusFilter("todos"); setDeptFilter("todos"); setSortBy("nome-asc"); };

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem ver esta página.</p>
      </Card>
    );
  }



  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function submit() {
    setLoading(true);
    try {
      await createFn({ data: { ...form, role_id: form.role_id || defaultRoleId } });
      toast.success("Usuário criado");
      setOpen(false);
      setForm({ email: "", nome: "", departamento: "", telefone: "", password: "", role_id: "" });
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(user_id: string, role_id: string) {
    try {
      await setRoleFn({ data: { user_id, role_id } });
      toast.success("Perfil atualizado");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleActive(user_id: string, ativo: boolean) {
    try {
      await setActiveFn({ data: { user_id, ativo } });
      toast.success(ativo ? "Usuário ativado" : "Usuário inativado");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  }

  async function saveDept() {
    if (!editDept) return;
    try {
      await setDeptFn({ data: { user_id: editDept.id, departamento: editDept.value || null } });
      toast.success("Departamento atualizado");
      setEditDept(null);
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  }

  async function savePwd() {
    if (!resetPwd) return;
    if (resetPwd.value.length < 8) return toast.error("Senha deve ter no mínimo 8 caracteres");
    try {
      await resetPwdFn({ data: { user_id: resetPwd.id, password: resetPwd.value } });
      toast.success("Senha redefinida");
      setResetPwd(null);
    } catch (e: any) { toast.error(e.message); }
  }

  async function saveEditUser() {
    if (!editUser) return;
    if (editUser.nome.trim().length < 2) return toast.error("Nome inválido");
    if (!/^\S+@\S+\.\S+$/.test(editUser.email)) return toast.error("E-mail inválido");
    setEditSaving(true);
    try {
      await updateProfileFn({
        data: {
          user_id: editUser.id,
          nome: editUser.nome.trim(),
          email: editUser.email.trim(),
          telefone: editUser.telefone.trim() || null,
          departamento: editUser.departamento.trim() || null,
        },
      });
      toast.success("Usuário atualizado");
      setEditUser(null);
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar usuário");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie acessos ao Portal TI</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo Usuário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-1"><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Departamento</Label>
                  <Select value={form.departamento || "__none"} onValueChange={(v) => setForm({ ...form, departamento: v === "__none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Sem departamento —</SelectItem>
                      {departments.map((d: any) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Senha inicial *</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mín. 8 caracteres" /></div>
                <div className="space-y-1"><Label>Perfil</Label>
                  <Select value={form.role_id || defaultRoleId} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={loading || !form.email || !form.nome || form.password.length < 8}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, e-mail ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os perfis</SelectItem>
              {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativos">Somente ativos</SelectItem>
              <SelectItem value="inativos">Somente inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os departamentos</SelectItem>
              <SelectItem value="__none">— Sem departamento —</SelectItem>
              {departments.map((d: any) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Ordenar por</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nome-asc">Nome (A–Z)</SelectItem>
                <SelectItem value="nome-desc">Nome (Z–A)</SelectItem>
                <SelectItem value="email-asc">E-mail (A–Z)</SelectItem>
                <SelectItem value="email-desc">E-mail (Z–A)</SelectItem>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigos">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{filteredUsers.length} de {users.length} usuário(s)</span>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1">
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Departamento</th>
                <th className="px-4 py-3 text-left">Perfil</th>
                <th className="px-4 py-3 text-left">Ativo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
              ) : filteredUsers.map((u: any) => (
                <tr key={u.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">
                    {u.nome}
                    {!u.ativo && <Badge variant="outline" className="ml-2 text-xs">Inativo</Badge>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    <button
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => setEditDept({ id: u.id, nome: u.nome, value: u.departamento ?? "" })}
                    >
                      <Building2 className="h-3 w-3" />
                      {u.departamento ?? "—"}
                    </button>
                  </td>
                  <td className="px-4 py-2 w-44">
                    <Select value={u.role_id ?? defaultRoleId} onValueChange={(v) => changeRole(u.id, v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Switch checked={!!u.ativo} onCheckedChange={(v) => toggleActive(u.id, v)} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar usuário"
                        onClick={() => setEditUser({
                          id: u.id,
                          nome: u.nome ?? "",
                          email: u.email ?? "",
                          telefone: u.telefone ?? "",
                          departamento: u.departamento ?? "",
                        })}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Redefinir senha" onClick={() => setResetPwd({ id: u.id, nome: u.nome, value: "" })}>
                        <KeyRound className="h-3 w-3" />
                      </Button>
                      <ConfirmDeleteDialog
                        entityLabel={`o usuário "${u.nome}"`}
                        description={<>O usuário <strong>{u.nome}</strong> será excluído (exclusão lógica auditada) e perderá o acesso ao sistema. Esta ação pode ser revertida por um administrador.</>}
                        onConfirm={async () => {
                          try {
                            await deleteFn({ data: { user_id: u.id } });
                            toast.success("Usuário excluído");
                            invalidate();
                          } catch (e: any) { toast.error(e.message); }
                        }}
                        trigger={<Button size="icon" variant="ghost"><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editDept} onOpenChange={(o) => !o && setEditDept(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar departamento — {editDept?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={editDept?.value || "__none"} onValueChange={(v) => editDept && setEditDept({ ...editDept, value: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sem departamento —</SelectItem>
                {departments.map((d: any) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDept(null)}>Cancelar</Button>
            <Button onClick={saveDept}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPwd} onOpenChange={(o) => !o && setResetPwd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha — {resetPwd?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="text"
              value={resetPwd?.value ?? ""}
              onChange={(e) => resetPwd && setResetPwd({ ...resetPwd, value: e.target.value })}
              placeholder="Mín. 8 caracteres"
            />
            <p className="text-xs text-muted-foreground">A ação será registrada no log de auditoria. Compartilhe a nova senha de forma segura.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwd(null)}>Cancelar</Button>
            <Button onClick={savePwd}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuário — {editUser?.nome}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={editUser?.nome ?? ""} onChange={(e) => editUser && setEditUser({ ...editUser, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input type="email" value={editUser?.email ?? ""} onChange={(e) => editUser && setEditUser({ ...editUser, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={editUser?.telefone ?? ""} onChange={(e) => editUser && setEditUser({ ...editUser, telefone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Departamento</Label>
              <Select
                value={editUser?.departamento || "__none"}
                onValueChange={(v) => editUser && setEditUser({ ...editUser, departamento: v === "__none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Sem departamento —</SelectItem>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Para alterar o perfil, use o seletor na linha do usuário. Para redefinir a senha, use o botão de chave.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={editSaving}>Cancelar</Button>
            <Button onClick={saveEditUser} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

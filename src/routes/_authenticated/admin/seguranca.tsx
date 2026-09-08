import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-auth";
import { useRoles, useRolePermissions } from "@/hooks/use-roles";
import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  BASE_ROLE_LABELS,
  defaultPermission,
  type BaseRole,
  type PermissionModule,
  type RolePermission,
} from "@/lib/permissions";
import { createRole, updateRole, deleteRole, saveRolePermissions } from "@/lib/roles.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldAlert, Loader2, Pencil, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export const Route = createFileRoute("/_authenticated/admin/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança · Perfis e Permissões | Portal TI" },
      {
        name: "description",
        content: "Crie perfis de acesso e defina o que cada um pode ver, criar, editar e excluir no portal.",
      },
      { property: "og:title", content: "Segurança · Perfis e Permissões | Portal TI" },
      {
        property: "og:description",
        content: "Gerencie perfis de acesso e permissões por módulo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSeguranca,
});

function AdminSeguranca() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState("perfis");

  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "permissoes" || h === "perfis") setTab(h);
  }, []);

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem ver esta página.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Segurança</h1>
        <p className="text-sm text-muted-foreground">Perfis de acesso e permissões por módulo</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
        </TabsList>
        <TabsContent value="perfis" className="mt-4">
          <PerfisTab />
        </TabsContent>
        <TabsContent value="permissoes" className="mt-4">
          <PermissoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PerfisTab() {
  const qc = useQueryClient();
  const { data: roles = [] } = useRoles();
  const createFn = useServerFn(createRole);
  const updateFn = useServerFn(updateRole);
  const deleteFn = useServerFn(deleteRole);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ id?: string; nome: string; descricao: string; base_role: BaseRole; is_system?: boolean }>({
    nome: "",
    descricao: "",
    base_role: "usuario",
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["role-user-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role_id");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.role_id) map[r.role_id] = (map[r.role_id] ?? 0) + 1;
      });
      return map;
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["roles"] });
    qc.invalidateQueries({ queryKey: ["role-user-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function save() {
    if (form.nome.trim().length < 2) return toast.error("Informe o nome do perfil");
    setSaving(true);
    try {
      if (form.id) {
        await updateFn({
          data: {
            id: form.id,
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            base_role: form.base_role,
          },
        });
        toast.success("Perfil atualizado");
      } else {
        await createFn({
          data: {
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            base_role: form.base_role,
          },
        });
        toast.success("Perfil criado");
      }
      setOpen(false);
      setForm({ nome: "", descricao: "", base_role: "usuario" });
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      toast.success("Perfil excluído");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setForm({ nome: "", descricao: "", base_role: "usuario" });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo perfil
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">Perfil</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Nível base</th>
                <th className="px-4 py-3 text-left">Usuários</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">
                    {r.nome}
                    {r.is_system && (
                      <Badge variant="outline" className="ml-2 text-xs">Nativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.descricao ?? "—"}</td>
                  <td className="px-4 py-2">{BASE_ROLE_LABELS[r.base_role]}</td>
                  <td className="px-4 py-2 text-muted-foreground">{counts[r.id] ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => {
                          setForm({
                            id: r.id,
                            nome: r.nome,
                            descricao: r.descricao ?? "",
                            base_role: r.base_role,
                            is_system: r.is_system,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {!r.is_system && (
                        <ConfirmDeleteDialog
                          entityLabel={`o perfil "${r.nome}"`}
                          onConfirm={() => remove(r.id)}
                          trigger={
                            <Button size="icon" variant="ghost" title="Excluir">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar perfil" : "Novo perfil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Nível base</Label>
              <Select
                value={form.base_role}
                onValueChange={(v) => setForm({ ...form, base_role: v as BaseRole })}
                disabled={!!form.is_system}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O nível base define as regras de segurança dos dados. As permissões refinam o que
                aparece dentro dele.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissoesTab() {
  const qc = useQueryClient();
  const { data: roles = [] } = useRoles();
  const [roleId, setRoleId] = useState<string>("");
  const selected = roles.find((r) => r.id === roleId) ?? null;
  const { data: saved = [], isFetching } = useRolePermissions(roleId || null);
  const saveFn = useServerFn(saveRolePermissions);
  const [draft, setDraft] = useState<Record<string, RolePermission>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roleId && roles.length) setRoleId(roles[0].id);
  }, [roles, roleId]);

  useEffect(() => {
    if (!selected) return;
    const map: Record<string, RolePermission> = {};
    PERMISSION_MODULES.forEach((m) => {
      const row = saved.find((p) => p.module === m.key);
      map[m.key] = row ?? defaultPermission(selected.base_role, m.key as PermissionModule);
    });
    setDraft(map);
  }, [saved, selected?.id, selected?.base_role]);

  const locked = selected?.slug === "admin";

  const rows = useMemo(() => PERMISSION_MODULES, []);

  function toggle(module: string, field: keyof RolePermission, value: boolean) {
    setDraft((d) => ({ ...d, [module]: { ...d[module], [field]: value } }));
  }

  async function save() {
    if (!roleId) return;
    setSaving(true);
    try {
      await saveFn({
        data: {
          role_id: roleId,
          permissions: rows.map((m) => {
            const p = draft[m.key];
            return {
              module: m.key,
              can_view: !!p?.can_view,
              can_create: !!p?.can_create,
              can_edit: !!p?.can_edit,
              can_delete: !!p?.can_delete,
            };
          }),
        },
      });
      toast.success("Permissões salvas");
      qc.invalidateQueries({ queryKey: ["role-permissions", roleId] });
      qc.invalidateQueries({ queryKey: ["my-role"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1 w-64">
          <Label>Perfil</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <p className="text-xs text-muted-foreground pb-2">
            Nível base: <strong>{BASE_ROLE_LABELS[selected.base_role]}</strong>
            {locked && " — o Administrador mantém acesso total."}
          </p>
        )}
        <div className="ml-auto">
          <Button onClick={save} disabled={saving || locked || !roleId || isFetching}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar permissões
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">Módulo</th>
                {PERMISSION_ACTIONS.map((a) => (
                  <th key={a.key} className="px-4 py-3 text-center w-24">{a.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => {
                const p = draft[m.key];
                return (
                  <tr key={m.key} className="hover:bg-accent/40">
                    <td className="px-4 py-2 font-medium">{m.label}</td>
                    {PERMISSION_ACTIONS.map((a) => {
                      const field = `can_${a.key}` as keyof RolePermission;
                      return (
                        <td key={a.key} className="px-4 py-2 text-center">
                          <Checkbox
                            checked={locked ? true : !!p?.[field]}
                            disabled={locked}
                            onCheckedChange={(v) => toggle(m.key, field, !!v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

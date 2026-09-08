import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, ShieldAlert, Settings, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/inventario-config")({
  component: InventarioConfigPage,
});

type Lookup = { id: string; nome: string; ativo: boolean };

const TABS = [
  
  { key: "inventory_statuses", label: "Status", linkCol: "status_id" },
  { key: "inventory_manufacturers", label: "Fabricantes", linkCol: "manufacturer_id" },
  { key: "inventory_operating_systems", label: "Sistemas Operacionais", linkCol: "operating_system_id" },
] as const;

function InventarioConfigPage() {
  const { isAdmin, isLoading } = usePermissions();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const navigate = useNavigate();
  const valid = ["categorias", ...TABS.map((t) => t.key)];
  const tab = valid.includes(hash) ? hash : "categorias";
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem acessar as configurações do inventário.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="h-6 w-6" />Configurações do Inventário</h1>
        <p className="text-sm text-muted-foreground">Gerencie os campos selecionáveis no cadastro de equipamentos.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate({ to: "/admin/inventario-config", hash: v })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="categorias"><Tag className="h-4 w-4 mr-1" />Categorias</TabsTrigger>
          {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="categorias"><CategoriesCrud /></TabsContent>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <LookupCrud table={t.key} label={t.label} linkCol={t.linkCol} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function LookupCrud({ table, label, linkCol }: { table: string; label: string; linkCol: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Lookup> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Lookup[];
    },
  });

  async function save() {
    if (!editing?.nome?.trim()) return toast.error("Nome é obrigatório");
    const payload = { nome: editing.nome.trim(), ativo: editing.ativo ?? true };
    const op = editing.id
      ? (supabase as any).from(table).update(payload).eq("id", editing.id)
      : (supabase as any).from(table).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: [table] });
  }

  async function toggleAtivo(r: Lookup) {
    const { error } = await (supabase as any).from(table).update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [table] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-xs text-muted-foreground">Itens em uso por equipamentos não podem ser excluídos — apenas desativados.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ativo: true })}><Plus className="h-4 w-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                Ativo
              </label>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">Nenhum registro.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 font-medium">{r.nome}</td>
                <td className="px-4 py-2"><Badge variant={r.ativo ? "default" : "outline"}>{r.ativo ? "Ativo" : "Inativo"}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-2 justify-end items-center">
                    <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Coluna vinculada em <code>inventory_items.{linkCol}</code>. Exclusão física é bloqueada quando há equipamentos vinculados (use o switch para desativar).
      </p>
    </Card>
  );
}

type Category = { id: string; nome: string; descricao: string | null; ativo: boolean };

function CategoriesCrud() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_categories").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  async function save() {
    if (!editing?.nome?.trim()) return toast.error("Nome é obrigatório");
    const payload = { nome: editing.nome.trim(), descricao: editing.descricao || null, ativo: editing.ativo ?? true };
    const op = editing.id
      ? supabase.from("inventory_categories").update(payload).eq("id", editing.id)
      : supabase.from("inventory_categories").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["inventory-categories"] });
  }

  async function toggleAtivo(c: Category) {
    const { error } = await supabase.from("inventory_categories").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory-categories"] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Tag className="h-4 w-4" />Categorias de Equipamento</h2>
          <p className="text-xs text-muted-foreground">Organize seus ativos. Itens em uso não podem ser excluídos — apenas desativados.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ativo: true })}><Plus className="h-4 w-4 mr-1" />Nova</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} rows={2} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                Ativa
              </label>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cats.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Nenhuma categoria.</td></tr>
            ) : cats.map((c) => (
              <tr key={c.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 font-medium">{c.nome}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.descricao ?? "—"}</td>
                <td className="px-4 py-2"><Badge variant={c.ativo ? "default" : "outline"}>{c.ativo ? "Ativa" : "Inativa"}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-1 justify-end items-center">
                    <Switch checked={c.ativo} onCheckedChange={() => toggleAtivo(c)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

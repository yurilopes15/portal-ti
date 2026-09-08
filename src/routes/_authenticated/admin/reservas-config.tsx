import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Plus, Pencil, ShieldAlert, Settings, Building2, Wrench, CalendarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reservas-config")({
  component: ReservasConfigPage,
});

const TABS = ["salas", "equipamentos", "bloqueios"] as const;
type TabKey = (typeof TABS)[number];

function ReservasConfigPage() {
  const { isAdmin, isLoading } = usePermissions();
  const hash = useRouterState({ select: (s) => s.location.hash }) as TabKey | "";
  const navigate = useNavigate();
  const tab: TabKey = (TABS as readonly string[]).includes(hash) ? (hash as TabKey) : "salas";
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem acessar as configurações de reservas.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="h-6 w-6" />Configurações de Reservas</h1>
        <p className="text-sm text-muted-foreground">Gerencie salas, equipamentos e datas bloqueadas.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate({ to: "/admin/reservas-config", hash: v })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="salas"><Building2 className="h-4 w-4 mr-1" />Salas</TabsTrigger>
          <TabsTrigger value="equipamentos"><Wrench className="h-4 w-4 mr-1" />Equipamentos</TabsTrigger>
          <TabsTrigger value="bloqueios"><CalendarOff className="h-4 w-4 mr-1" />Bloqueios</TabsTrigger>
        </TabsList>
        <TabsContent value="salas"><ResourcesCrud type="room" label="Sala" /></TabsContent>
        <TabsContent value="equipamentos"><ResourcesCrud type="equipment" label="Equipamento" /></TabsContent>
        <TabsContent value="bloqueios"><BlockedDatesCrud /></TabsContent>
      </Tabs>
    </div>
  );
}

type Resource = {
  id: string;
  name: string;
  type: "room" | "equipment";
  description: string | null;
  patrimonio: string | null;
  status: "disponivel" | "manutencao" | "inativo";
};

function ResourcesCrud({ type, label }: { type: "room" | "equipment"; label: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["reservation_resources", type],
    queryFn: async () => {
      const { data, error } = await supabase.from("reservation_resources").select("*").eq("type", type).order("name");
      if (error) throw error;
      return (data ?? []) as Resource[];
    },
  });

  async function save() {
    if (!editing?.name?.trim()) return toast.error("Nome é obrigatório");
    const payload = {
      name: editing.name.trim(),
      type,
      description: editing.description || null,
      patrimonio: editing.patrimonio || null,
      status: editing.status ?? "disponivel",
    };
    const op = editing.id
      ? supabase.from("reservation_resources").update(payload).eq("id", editing.id)
      : supabase.from("reservation_resources").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["reservation_resources", type] });
  }

  async function remove(r: Resource) {
    if (!confirm(`Excluir ${r.name}?`)) return;
    const { error } = await supabase.from("reservation_resources").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["reservation_resources", type] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{label}s</h2>
          <p className="text-xs text-muted-foreground">Adicione, edite ou remova {label.toLowerCase()}s disponíveis para reserva.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ status: "disponivel" })}><Plus className="h-4 w-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} {label}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
              </div>
              {type === "equipment" && (
                <div className="space-y-1">
                  <Label className="text-xs">Patrimônio</Label>
                  <Input value={editing?.patrimonio ?? ""} onChange={(e) => setEditing({ ...editing, patrimonio: e.target.value })} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={editing?.status ?? "disponivel"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as Resource["status"] })}
                >
                  <option value="disponivel">Disponível</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
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
              {type === "equipment" && <th className="px-4 py-3 text-left">Patrimônio</th>}
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum registro.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                {type === "equipment" && <td className="px-4 py-2 text-muted-foreground">{r.patrimonio ?? "—"}</td>}
                <td className="px-4 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge variant={r.status === "disponivel" ? "default" : "outline"}>
                    {r.status === "disponivel" ? "Disponível" : r.status === "manutencao" ? "Manutenção" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-1 justify-end items-center">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-3 w-3" /></Button>
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

type Blocked = { id: string; data: string; descricao: string | null };

function BlockedDatesCrud() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Blocked> | null>(null);
  const [open, setOpen] = useState(false);
  const [blockWeekends, setBlockWeekends] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["reservation_settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("reservation_settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as { block_weekends: boolean } | null;
    },
  });

  useEffect(() => { if (settings) setBlockWeekends(!!settings.block_weekends); }, [settings]);

  const { data: rows = [] } = useQuery({
    queryKey: ["reservation_blocked_dates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("reservation_blocked_dates").select("*").order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Blocked[];
    },
  });

  async function toggleWeekends(v: boolean) {
    setBlockWeekends(v);
    const { error } = await (supabase as any).from("reservation_settings").upsert({ id: true, block_weekends: v, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Configuração atualizada");
    qc.invalidateQueries({ queryKey: ["reservation_settings"] });
  }

  async function save() {
    if (!editing?.data) return toast.error("Data é obrigatória");
    const payload = { data: editing.data, descricao: editing.descricao || null };
    const op = editing.id
      ? (supabase as any).from("reservation_blocked_dates").update(payload).eq("id", editing.id)
      : (supabase as any).from("reservation_blocked_dates").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["reservation_blocked_dates"] });
  }

  async function remove(b: Blocked) {
    if (!confirm("Remover bloqueio?")) return;
    const { error } = await (supabase as any).from("reservation_blocked_dates").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reservation_blocked_dates"] });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">Bloquear finais de semana</div>
            <p className="text-xs text-muted-foreground">Quando ativo, sábados e domingos não aceitam reservas.</p>
          </div>
          <Switch checked={blockWeekends} onCheckedChange={toggleWeekends} />
        </label>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Feriados e datas bloqueadas</h2>
            <p className="text-xs text-muted-foreground">Datas em que nenhuma reserva poderá ser criada.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} data bloqueada</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data *</Label>
                  <Input type="date" value={editing?.data ?? ""} onChange={(e) => setEditing({ ...editing, data: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input placeholder="Ex: Natal" value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">Nenhuma data bloqueada.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.descricao ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end items-center">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

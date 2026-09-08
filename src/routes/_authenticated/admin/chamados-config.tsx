import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ColorBadge } from "@/components/ticket-badges";
import { Plus, Pencil, ShieldAlert, Settings } from "lucide-react";
import { SlaAdminPanel } from "@/components/sla-admin-panel";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/chamados-config")({
  component: ChamadosConfigPage,
});

type Row = {
  id: string; nome: string; cor: string; ordem: number; ativo: boolean;
  is_inicial?: boolean; is_resolvido?: boolean; is_fechado?: boolean;
};

function ChamadosConfigPage() {
  const { isAdmin, isLoading } = usePermissions();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const navigate = useNavigate();
  const valid = ["categories", "priorities", "statuses", "sla"];
  const tab = valid.includes(hash) ? hash : "categories";
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem acessar as configurações de chamados.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="h-6 w-6" />Configurações de Chamados</h1>
        <p className="text-sm text-muted-foreground">Gerencie categorias, prioridades, status e SLA dos chamados.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate({ to: "/admin/chamados-config", hash: v })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="priorities">Prioridades</TabsTrigger>
          <TabsTrigger value="statuses">Status</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><LookupCrud table="ticket_categories" label="Categorias de Chamados" entity="categoria" /></TabsContent>
        <TabsContent value="priorities"><LookupCrud table="ticket_priorities" label="Prioridades" entity="prioridade" /></TabsContent>
        <TabsContent value="statuses"><LookupCrud table="ticket_statuses" label="Status dos Chamados" entity="status" hasFlags /></TabsContent>
        <TabsContent value="sla"><SlaAdminPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function LookupCrud({ table, label, entity, hasFlags = false }: { table: string; label: string; entity: string; hasFlags?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table).select("*").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  async function save() {
    if (!editing?.nome?.trim()) return toast.error("Nome é obrigatório");
    const payload: any = {
      nome: editing.nome.trim(),
      cor: editing.cor || "#64748b",
      ordem: editing.ordem ?? 0,
      ativo: editing.ativo ?? true,
    };
    if (hasFlags) {
      payload.is_inicial = editing.is_inicial ?? false;
      payload.is_resolvido = editing.is_resolvido ?? false;
      payload.is_fechado = editing.is_fechado ?? false;
    }
    const op = editing.id
      ? (supabase as any).from(table).update(payload).eq("id", editing.id)
      : (supabase as any).from(table).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: [table] });
  }

  async function toggleAtivo(r: Row) {
    const { error } = await (supabase as any).from(table).update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [table] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-xs text-muted-foreground">
            Itens em uso por chamados não podem ser excluídos — apenas desativados.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ativo: true, cor: "#64748b", ordem: (rows[rows.length - 1]?.ordem ?? 0) + 10 })}>
              <Plus className="h-4 w-4 mr-1" />Nova {entity}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} {entity}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cor</Label>
                  <Input type="color" value={editing?.cor ?? "#64748b"} onChange={(e) => setEditing({ ...editing, cor: e.target.value })} className="h-10 p-1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ordem</Label>
                  <Input type="number" value={editing?.ordem ?? 0} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                Ativo
              </label>
              {hasFlags && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Comportamento (apenas um por flag)</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={editing?.is_inicial ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_inicial: v })} />
                    Status inicial (novos chamados começam aqui)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={editing?.is_resolvido ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_resolvido: v })} />
                    Marca o chamado como resolvido (preenche "Resolvido em")
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={editing?.is_fechado ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_fechado: v })} />
                    Marca o chamado como fechado (preenche "Fechado em")
                  </label>
                </div>
              )}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">Pré-visualização:</p>
                <ColorBadge name={editing?.nome || "exemplo"} color={editing?.cor} />
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
              <th className="px-4 py-3 text-left">Ordem</th>
              <th className="px-4 py-3 text-left">Nome</th>
              {hasFlags && <th className="px-4 py-3 text-left">Comportamento</th>}
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={hasFlags ? 5 : 4} className="px-4 py-12 text-center text-muted-foreground">Nenhum registro.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{r.ordem}</td>
                <td className="px-4 py-2"><ColorBadge name={r.nome} color={r.cor} /></td>
                {hasFlags && (
                  <td className="px-4 py-2 text-xs">
                    {[
                      r.is_inicial && "Inicial",
                      r.is_resolvido && "Resolvido",
                      r.is_fechado && "Fechado",
                    ].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span>}
                  </td>
                )}
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
    </Card>
  );
}

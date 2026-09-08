import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowDown, ArrowUp, History, Building2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export type TonerColor = "preto" | "ciano" | "magenta" | "amarelo" | "unico";
export const TONER_COLORS: TonerColor[] = ["preto", "ciano", "magenta", "amarelo", "unico"];

export function StockBadge({ quantidade, minimo }: { quantidade: number; minimo: number }) {
  if (quantidade === 0) return <Badge variant="destructive">Zerado</Badge>;
  if (quantidade <= minimo)
    return <Badge className="bg-warning/20 text-warning-foreground border border-warning/40">Baixo</Badge>;
  return <Badge className="bg-success/20 text-success border border-success/40">Normal</Badge>;
}

type Toner = {
  id: string;
  modelo: string;
  cor: string;
  quantidade: number;
  quantidade_minima: number;
};

export function PrinterTonerManager({
  printerId,
  printerLabel,
  open,
  onOpenChange,
}: {
  printerId: string;
  printerLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Gestão de toner — {printerLabel}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="toners" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 w-full shrink-0">
            <TabsTrigger value="toners">Toners</TabsTrigger>
            <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="toners" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <PrinterTonersTab printerId={printerId} />
          </TabsContent>
          <TabsContent value="departamentos" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <DepartamentosTab printerId={printerId} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <HistoricoTab printerId={printerId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ------- Toners vinculados à impressora -------
function PrinterTonersTab({ printerId }: { printerId: string }) {
  const qc = useQueryClient();
  const [tonerId, setTonerId] = useState("");

  const { data: links = [] } = useQuery({
    queryKey: ["printer-toner-links", printerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("printer_toner_links")
        .select("id, toner_id, toners(id, modelo, cor, quantidade, quantidade_minima)")
        .eq("inventory_item_id", printerId);
      return (data ?? []) as { id: string; toner_id: string; toners: Toner }[];
    },
  });

  const { data: allToners = [] } = useQuery({
    queryKey: ["toners-all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("toners").select("*").order("modelo");
      return (data ?? []) as Toner[];
    },
  });

  const linkedIds = new Set(links.map((l) => l.toner_id));
  const available = allToners.filter((t) => !linkedIds.has(t.id));

  async function vincular() {
    if (!tonerId) return;
    const { error } = await (supabase as any)
      .from("printer_toner_links")
      .insert({ inventory_item_id: printerId, toner_id: tonerId });
    if (error) return toast.error(error.message);
    toast.success("Toner vinculado");
    setTonerId("");
    qc.invalidateQueries({ queryKey: ["printer-toner-links", printerId] });
    qc.invalidateQueries({ queryKey: ["toners-all"] });
  }

  async function desvincular(id: string) {
    const { error } = await (supabase as any).from("printer_toner_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Toner desvinculado");
    qc.invalidateQueries({ queryKey: ["printer-toner-links", printerId] });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        O estoque dos toners é compartilhado entre todas as impressoras vinculadas. Para criar novos
        toners ou registrar entradas, acesse <b>Estoque de Toners</b>.
      </p>
      <div className="flex gap-2">
        <Select value={tonerId} onValueChange={setTonerId}>
          <SelectTrigger><SelectValue placeholder="Selecione um toner do catálogo" /></SelectTrigger>
          <SelectContent>
            {available.length === 0 ? (
              <SelectItem value="__none__" disabled>Nenhum toner disponível</SelectItem>
            ) : available.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.modelo} ({t.cor}) — estoque: {t.quantidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={vincular} disabled={!tonerId}><Plus className="h-4 w-4 mr-1" />Vincular</Button>
      </div>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Modelo</th>
              <th className="px-3 py-2 text-left">Cor</th>
              <th className="px-3 py-2 text-left">Estoque</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {links.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum toner vinculado.</td></tr>
            ) : links.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 font-medium">{l.toners?.modelo}</td>
                <td className="px-3 py-2 capitalize">{l.toners?.cor}</td>
                <td className="px-3 py-2">{l.toners?.quantidade}</td>
                <td className="px-3 py-2">
                  {l.toners && <StockBadge quantidade={l.toners.quantidade} minimo={l.toners.quantidade_minima} />}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => desvincular(l.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------- Departamentos -------
function DepartamentosTab({ printerId }: { printerId: string }) {
  const qc = useQueryClient();
  const [deptId, setDeptId] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-active"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["printer-departments", printerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("printer_departments")
        .select("*, departments(id, nome)")
        .eq("inventory_item_id", printerId);
      return data ?? [];
    },
  });

  async function add() {
    if (!deptId) return;
    const { error } = await supabase.from("printer_departments").insert({ inventory_item_id: printerId, department_id: deptId });
    if (error) return toast.error(error.message);
    setDeptId("");
    qc.invalidateQueries({ queryKey: ["printer-departments", printerId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("printer_departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["printer-departments", printerId] });
  }

  const linkedIds = new Set((links as any[]).map((l) => l.department_id));
  const available = (departments as any[]).filter((d) => !linkedIds.has(d.id));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={deptId} onValueChange={setDeptId}>
          <SelectTrigger><SelectValue placeholder="Selecione um departamento" /></SelectTrigger>
          <SelectContent>
            {available.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={!deptId}><Plus className="h-4 w-4 mr-1" />Vincular</Button>
      </div>
      <ul className="space-y-1">
        {(links as any[]).length === 0 ? (
          <li className="text-sm text-muted-foreground text-center py-6">Nenhum departamento vinculado.</li>
        ) : (links as any[]).map((l) => (
          <li key={l.id} className="flex items-center justify-between border rounded-md px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{l.departments?.nome}
            </span>
            <Button size="icon" variant="ghost" onClick={() => remove(l.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------- Histórico (movimentações desta impressora) -------
function HistoricoTab({ printerId }: { printerId: string }) {
  const { data: movs = [] } = useQuery({
    queryKey: ["toner-movements", printerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("toner_movements")
        .select("*, toners(modelo, cor), responsavel:profiles!toner_movements_responsavel_id_fkey(nome), ticket:tickets(numero)")
        .eq("inventory_item_id", printerId)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as any[];
    },
  });

  if (movs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sem movimentações.</p>;
  }

  return (
    <ul className="space-y-2">
      {movs.map((m) => (
        <li key={m.id} className="flex items-start gap-3 border rounded-md p-3 text-sm">
          <div className="mt-0.5">
            {m.tipo === "entrada" ? <ArrowDown className="h-4 w-4 text-success" />
              : m.tipo === "saida" ? <ArrowUp className="h-4 w-4 text-destructive" />
              : <History className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <div className="font-medium capitalize">
              {m.tipo} · {m.quantidade}× {m.toners?.modelo ?? "—"} ({m.toners?.cor ?? "—"})
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(m.created_at)}
              {m.responsavel?.nome ? ` · ${m.responsavel.nome}` : ""}
              {m.ticket?.numero ? ` · Chamado #${m.ticket.numero}` : ""}
              {m.origem ? ` · ${m.origem}` : ""}
            </div>
            {m.observacoes && <div className="text-xs mt-1 text-muted-foreground">{m.observacoes}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

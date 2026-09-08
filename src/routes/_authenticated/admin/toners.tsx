import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, Search, Plus, Pencil, Trash2, ArrowDown, ArrowUp, History, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { StockBadge, TONER_COLORS, type TonerColor } from "@/components/printer-toner-manager";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/toners")({
  component: TonersDashboard,
});

const ALL = "__all__";

type TonerRow = {
  id: string;
  modelo: string;
  cor: string;
  quantidade: number;
  quantidade_minima: number;
  printers?: { id: string; patrimonio: string | null; fabricante: string | null; modelo: string | null; localizacao: string | null }[];
};

function TonersDashboard() {
  const { isTI, isLoading } = usePermissions();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState(ALL);
  const [editing, setEditing] = useState<Partial<TonerRow> | null>(null);
  const [receiving, setReceiving] = useState<TonerRow | null>(null);
  const [recQtd, setRecQtd] = useState(1);
  const [recObs, setRecObs] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);

  const { data: toners = [] } = useQuery({
    queryKey: ["toners-with-printers"],
    enabled: isTI,
    queryFn: async () => {
      const { data: ts } = await (supabase as any).from("toners").select("*").order("modelo");
      const list = (ts ?? []) as TonerRow[];
      const ids = list.map((t) => t.id);
      if (ids.length === 0) return list;
      const { data: links } = await (supabase as any)
        .from("printer_toner_links")
        .select("toner_id, inventory_items(id, patrimonio, fabricante, modelo, localizacao)")
        .in("toner_id", ids);
      const byToner = new Map<string, TonerRow["printers"]>();
      (links ?? []).forEach((l: any) => {
        if (!l.inventory_items) return;
        const arr = byToner.get(l.toner_id) ?? [];
        arr!.push(l.inventory_items);
        byToner.set(l.toner_id, arr);
      });
      return list.map((t) => ({ ...t, printers: byToner.get(t.id) ?? [] }));
    },
  });

  const filtered = useMemo(() => {
    return toners.filter((t) => {
      if (q) {
        const blob = `${t.modelo} ${t.cor} ${(t.printers ?? []).map((p) => `${p.patrimonio ?? ""} ${p.fabricante ?? ""} ${p.modelo ?? ""}`).join(" ")}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      if (fStatus !== ALL) {
        const st = t.quantidade === 0 ? "zerado" : t.quantidade <= t.quantidade_minima ? "baixo" : "normal";
        if (st !== fStatus) return false;
      }
      return true;
    });
  }, [toners, q, fStatus]);

  const purchaseItems = useMemo(() => {
    return toners
      .filter((t) => t.quantidade <= t.quantidade_minima)
      .map((t) => {
        const printers = t.printers ?? [];
        const impressoras = printers.length
          ? printers.map((p) => [p.fabricante, p.modelo].filter(Boolean).join(" ") || p.patrimonio || "—").join(", ")
          : "—";
        const setoresSet = new Set(printers.map((p) => (p.localizacao ?? "").trim()).filter(Boolean));
        const setores = setoresSet.size ? Array.from(setoresSet).join(", ") : "—";
        const sugerido = Math.max(t.quantidade_minima * 2 - t.quantidade, t.quantidade_minima - t.quantidade + 1);
        return {
          id: t.id,
          modelo: t.modelo,
          cor: t.cor,
          impressoras,
          setores,
          atual: t.quantidade,
          minimo: t.quantidade_minima,
          sugerido,
        };
      });
  }, [toners]);

  function exportPurchasePDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const now = new Date();
    doc.setFontSize(16);
    doc.text("Solicitação de Compra de Toners", 14, 15);
    doc.setFontSize(10);
    doc.text(`Data de emissão: ${formatDate(now)}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Modelo", "Impressora(s)", "Setor/Localização", "Estoque atual", "Mínimo", "Qtd. sugerida"]],
      body: purchaseItems.map((i) => [
        `${i.modelo} (${i.cor})`,
        i.impressoras,
        i.setores,
        String(i.atual),
        String(i.minimo),
        String(i.sugerido),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [58, 168, 91] },
    });
    const finalY = (doc as any).lastAutoTable?.finalY ?? 40;
    const y = Math.min(finalY + 25, doc.internal.pageSize.getHeight() - 20);
    doc.setFontSize(10);
    doc.text("Responsável: ______________________________________________", 14, y);
    doc.text("Assinatura: _______________________________________________", 14, y + 10);
    const d = now.toISOString().slice(0, 10).replace(/-/g, "");
    doc.save(`solicitacao-compra-toners-${d}.pdf`);
  }

  function exportPurchaseXLSX() {
    const now = new Date();
    const aoa: (string | number)[][] = [
      ["Solicitação de Compra de Toners"],
      [`Data de emissão: ${formatDate(now)}`],
      [],
      ["Modelo", "Cor", "Impressora(s)", "Setor/Localização", "Estoque atual", "Mínimo", "Qtd. sugerida"],
      ...purchaseItems.map((i) => [i.modelo, i.cor, i.impressoras, i.setores, i.atual, i.minimo, i.sugerido]),
      [],
      ["Responsável:", ""],
      ["Assinatura:", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 40 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compra Toners");
    const d = now.toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `solicitacao-compra-toners-${d}.xlsx`);
  }

  async function saveToner() {
    if (!editing?.modelo || !editing?.cor) return toast.error("Modelo e cor são obrigatórios");
    const payload = {
      modelo: editing.modelo,
      cor: editing.cor,
      quantidade: editing.quantidade ?? 0,
      quantidade_minima: editing.quantidade_minima ?? 1,
    };
    const op = editing.id
      ? (supabase as any).from("toners").update(payload).eq("id", editing.id)
      : (supabase as any).from("toners").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["toners-with-printers"] });
    qc.invalidateQueries({ queryKey: ["toners-all"] });
  }

  async function removeToner(id: string) {
    if (!confirm("Remover este toner? Esta ação não pode ser desfeita.")) return;
    const { error } = await (supabase as any).from("toners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["toners-with-printers"] });
  }

  async function confirmReceber() {
    if (!receiving) return;
    if (recQtd <= 0) return toast.error("Quantidade inválida");
    const novaQtd = receiving.quantidade + recQtd;
    const { error: e1 } = await (supabase as any).from("toners").update({ quantidade: novaQtd }).eq("id", receiving.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await (supabase as any).from("toner_movements").insert({
      toner_id: receiving.id,
      inventory_item_id: null,
      tipo: "entrada",
      quantidade: recQtd,
      origem: "recebimento_manual",
      responsavel_id: user?.id ?? null,
      observacoes: recObs || null,
    });
    if (e2) return toast.error(e2.message);
    toast.success("Entrada registrada");
    setReceiving(null);
    setRecQtd(1);
    setRecObs("");
    qc.invalidateQueries({ queryKey: ["toners-with-printers"] });
  }

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isTI) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas a equipe de TI pode acessar o estoque de toners.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque de Toners</h1>
          <p className="text-sm text-muted-foreground">
            Estoque consolidado. Um toner pode ser usado por várias impressoras.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowPurchase(true)}>
            <FileText className="h-4 w-4 mr-1" />Gerar Relatório de Compra
          </Button>
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4 mr-1" />Histórico
          </Button>
          <Button onClick={() => setEditing({ cor: "preto", quantidade: 0, quantidade_minima: 1 })}>
            <Plus className="h-4 w-4 mr-1" />Novo toner
          </Button>
        </div>
      </div>

      <Card className="p-3 space-y-3">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar modelo, cor, impressora..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="zerado">Zerado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">Modelo</th>
                <th className="px-4 py-3 text-left">Cor</th>
                <th className="px-4 py-3 text-left">Estoque</th>
                <th className="px-4 py-3 text-left">Mínimo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Impressoras vinculadas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhum toner cadastrado.</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">{t.modelo}</td>
                  <td className="px-4 py-2 capitalize">{t.cor}</td>
                  <td className="px-4 py-2">{t.quantidade}</td>
                  <td className="px-4 py-2">{t.quantidade_minima}</td>
                  <td className="px-4 py-2"><StockBadge quantidade={t.quantidade} minimo={t.quantidade_minima} /></td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {(t.printers ?? []).length === 0
                      ? "—"
                      : (t.printers ?? []).map((p) => [p.fabricante, p.modelo].filter(Boolean).join(" ") || p.patrimonio || "—").join(", ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setReceiving(t); setRecQtd(1); setRecObs(""); }}>
                        <ArrowDown className="h-3 w-3 mr-1" />Receber
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeToner(t.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} toner</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Modelo *</Label>
              <Input value={editing?.modelo ?? ""} onChange={(e) => setEditing({ ...editing, modelo: e.target.value })} placeholder="Ex.: CF280A" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cor *</Label>
                <Select value={(editing?.cor as string) ?? "preto"} onValueChange={(v) => setEditing({ ...editing, cor: v as TonerColor })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONER_COLORS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" min={0} value={editing?.quantidade ?? 0} onChange={(e) => setEditing({ ...editing, quantidade: Math.max(0, parseInt(e.target.value) || 0) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mínimo</Label>
                <Input type="number" min={0} value={editing?.quantidade_minima ?? 1} onChange={(e) => setEditing({ ...editing, quantidade_minima: Math.max(0, parseInt(e.target.value) || 0) })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveToner}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recebimento */}
      <Dialog open={!!receiving} onOpenChange={(o) => !o && setReceiving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receber toner — {receiving?.modelo} ({receiving?.cor})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Estoque atual: <b>{receiving?.quantidade}</b></p>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade recebida *</Label>
              <Input type="number" min={1} value={recQtd} onChange={(e) => setRecQtd(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={recObs} onChange={(e) => setRecObs(e.target.value)} rows={2} placeholder="Nota fiscal, fornecedor, etc." />
            </div>
          </div>
          <DialogFooter><Button onClick={confirmReceber}>Registrar entrada</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico global */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>Histórico de movimentações</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <Tabs defaultValue="all">
              <TabsList><TabsTrigger value="all">Todas</TabsTrigger></TabsList>
              <TabsContent value="all" className="mt-3"><GlobalHistory /></TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Relatório de compra */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Solicitação de Compra de Toners</DialogTitle>
            <p className="text-xs text-muted-foreground">Data de emissão: {formatDate(new Date())}</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            {purchaseItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                Nenhum toner necessita reposição no momento.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Modelo</th>
                      <th className="px-3 py-2 text-left">Impressora(s) compatível(is)</th>
                      <th className="px-3 py-2 text-left">Setor/Localização</th>
                      <th className="px-3 py-2 text-right">Estoque atual</th>
                      <th className="px-3 py-2 text-right">Mínimo</th>
                      <th className="px-3 py-2 text-right">Qtd. sugerida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchaseItems.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2 font-medium">{i.modelo} <span className="text-xs text-muted-foreground capitalize">({i.cor})</span></td>
                        <td className="px-3 py-2 text-xs">{i.impressoras}</td>
                        <td className="px-3 py-2 text-xs">{i.setores}</td>
                        <td className="px-3 py-2 text-right">{i.atual}</td>
                        <td className="px-3 py-2 text-right">{i.minimo}</td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{i.sugerido}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {purchaseItems.length > 0 && (
              <div className="mt-8 pt-6 border-t space-y-4 text-sm">
                <div>Responsável: ______________________________________________</div>
                <div>Assinatura: _______________________________________________</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchase(false)}>Fechar</Button>
            <Button variant="outline" disabled={purchaseItems.length === 0} onClick={exportPurchaseXLSX}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Exportar Excel
            </Button>
            <Button disabled={purchaseItems.length === 0} onClick={exportPurchasePDF}>
              <FileDown className="h-4 w-4 mr-1" />Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GlobalHistory() {
  const { data: movs = [] } = useQuery({
    queryKey: ["toner-movements-global"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("toner_movements")
        .select("*, toners(modelo, cor), inventory_items(patrimonio, fabricante, modelo), responsavel:profiles!toner_movements_responsavel_id_fkey(nome), ticket:tickets(numero)")
        .order("created_at", { ascending: false })
        .limit(300);
      return (data ?? []) as any[];
    },
  });

  if (movs.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Sem movimentações.</p>;

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
              {m.inventory_items ? ` · ${[m.inventory_items.fabricante, m.inventory_items.modelo].filter(Boolean).join(" ") || m.inventory_items.patrimonio}` : ""}
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

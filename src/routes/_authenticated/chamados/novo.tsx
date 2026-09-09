import { DEFAULT_FILTERS as CHAMADOS_DEFAULT_FILTERS } from "./index";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTicketLookups } from "@/hooks/use-ticket-lookups";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Loader2, Paperclip, X } from "lucide-react";
import { sanitizeStorageFilename } from "@/lib/storage-utils";
import { RichTextEditor, isEmptyHtml } from "@/components/rich-text-editor";
import { StockBadge } from "@/components/printer-toner-manager";

export const Route = createFileRoute("/_authenticated/chamados/novo")({
  component: NovoChamado,
});

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;

function NovoChamado() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { activeCategories, activePriorities, activeStatuses } = useTicketLookups();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [priorityId, setPriorityId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [printerId, setPrinterId] = useState<string>("");
  const [tonerId, setTonerId] = useState<string>("");
  const { data: profile } = useProfile();
  const draftIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const inlinePathPrefix = user ? `inline/${user.id}/draft-${draftIdRef.current}` : "";

  const defaultPriority = useMemo(
    () => activePriorities.find((p) => /m[eé]dia/i.test(p.nome)) ?? activePriorities[0],
    [activePriorities],
  );
  const initialStatus = useMemo(
    () => activeStatuses.find((s) => s.is_inicial) ?? activeStatuses.find((s) => /aberto/i.test(s.nome)) ?? activeStatuses[0],
    [activeStatuses],
  );

  const selectedCategoryName = useMemo(
    () => activeCategories.find((c) => c.id === categoryId)?.nome ?? "",
    [categoryId, activeCategories],
  );
  const isTonerCategory = /^toner/i.test(selectedCategoryName);

  // Impressoras do departamento do usuário (via campo Localização ou vínculo printer_departments)
  const { data: tonerPrinters } = useQuery({
    queryKey: ["toner-printers", profile?.departamento],
    enabled: isTonerCategory,
    queryFn: async () => {
      // Todas as impressoras com toner vinculado (consulta sem dados sigilosos)
      const { data: pts } = await (supabase as any)
        .from("printer_toner_links")
        .select("inventory_item_id");
      const printerIds = new Set<string>((pts ?? []).map((r: any) => r.inventory_item_id));
      const { data: safeItems } = await (supabase as any).rpc("inventory_safe");
      const allPrinters = (safeItems ?? []).filter((i: any) => printerIds.has(i.id));

      const userDept = (profile?.departamento ?? "").trim();
      if (!userDept) return { printers: [] as any[], preferredId: null as string | null };

      // Vínculo explícito via printer_departments
      let linkedIds = new Set<string>();
      const { data: dept } = await supabase
        .from("departments")
        .select("id")
        .ilike("nome", userDept)
        .maybeSingle();
      if (dept?.id) {
        const { data: links } = await supabase
          .from("printer_departments")
          .select("inventory_item_id")
          .eq("department_id", dept.id);
        linkedIds = new Set((links ?? []).map((l: any) => l.inventory_item_id));
      }

      // Filtra pelas impressoras cuja Localização = departamento do usuário OU que estejam vinculadas
      const norm = (s: string) => s.trim().toLowerCase();
      const filtered = allPrinters.filter(
        (p: any) => (p.localizacao && norm(p.localizacao) === norm(userDept)) || linkedIds.has(p.id),
      );
      return { printers: filtered, preferredId: filtered[0]?.id ?? null };
    },
  });

  const printersList: any[] = tonerPrinters?.printers ?? [];
  const preferredPrinterId: string | null = tonerPrinters?.preferredId ?? null;

  useEffect(() => {
    if (!isTonerCategory) { setPrinterId(""); setTonerId(""); return; }
    if (!printerId && preferredPrinterId) setPrinterId(preferredPrinterId);
  }, [isTonerCategory, preferredPrinterId, printerId]);


  const { data: printerToners = [] } = useQuery({
    queryKey: ["printer-toners-for-ticket", printerId],
    enabled: !!printerId && isTonerCategory,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("printer_toner_links")
        .select("toners(id, modelo, cor, quantidade, quantidade_minima)")
        .eq("inventory_item_id", printerId);
      const toners = (data ?? []).map((l: any) => l.toners).filter(Boolean);
      return toners.sort((a: any, b: any) => a.modelo.localeCompare(b.modelo));
    },
  });


  useEffect(() => {
    if (!isTonerCategory) return;
    if (printerToners.length === 1 && !tonerId) setTonerId((printerToners[0] as any).id);
    if (printerToners.length === 0) setTonerId("");
  }, [printerToners, isTonerCategory, tonerId]);

  const selectedToner: any = printerToners.find((t: any) => t.id === tonerId);


  function addFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    for (const f of arr) if (f.size > MAX_SIZE) return toast.error(`${f.name} excede 10MB`);
    const next = [...files, ...arr].slice(0, MAX_FILES);
    if (files.length + arr.length > MAX_FILES) toast.warning(`Máximo de ${MAX_FILES} arquivos.`);
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const cat = activeCategories.find((c) => c.id === categoryId);
    const prio = activePriorities.find((p) => p.id === (priorityId || defaultPriority?.id));
    if (!cat) return toast.error("Selecione uma categoria");
    if (!prio) return toast.error("Selecione uma prioridade");
    if (!initialStatus) return toast.error("Nenhum status inicial configurado. Avise o administrador.");
    if (isEmptyHtml(descricao)) return toast.error("Informe a descrição");
    setLoading(true);
    try {
      const insertPayload: any = {
        titulo, descricao,
        categoria: cat.nome, category_id: cat.id,
        prioridade: prio.nome, priority_id: prio.id,
        status: initialStatus.nome, status_id: initialStatus.id,
        criado_por: user.id,
      };
      if (isTonerCategory) {
        if (!printerId) { setLoading(false); return toast.error("Selecione a impressora"); }
        insertPayload.printer_id = printerId;
        if (tonerId) insertPayload.toner_id = tonerId;
      }
      const { data: ticket, error } = await (supabase.from("tickets") as any).insert(insertPayload).select("id, numero").single();
      if (error) throw error;

      for (const f of files) {
        const path = `${ticket.id}/${Date.now()}-${sanitizeStorageFilename(f.name)}`;
        const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, f, { contentType: f.type || undefined });
        if (upErr) throw upErr;
        await supabase.from("ticket_attachments").insert({
          ticket_id: ticket.id, storage_path: path, nome: f.name, tamanho: f.size, mime: f.type, enviado_por: user.id,
        });
      }
      toast.success("Chamado aberto com sucesso!");
      nav({ to: "/chamados/$id", params: { id: ticket.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar chamado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Novo Chamado</h1>
        <p className="text-sm text-muted-foreground">Descreva sua solicitação para a equipe de TI</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do chamado</CardTitle>
          <CardDescription>Quanto mais informações, mais rápido será o atendimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} placeholder="Ex.: Notebook não liga após atualização" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade *</Label>
                <Select value={priorityId || defaultPriority?.id || ""} onValueChange={setPriorityId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activePriorities.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isTonerCategory && (
              <div className="space-y-4 rounded-md border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium">Detalhes do toner</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Impressora *</Label>
                    <Select value={printerId} onValueChange={(v) => { setPrinterId(v); setTonerId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {printersList.length === 0 ? (
                          <div className="px-2 py-2 text-xs text-muted-foreground">Nenhuma impressora vinculada ao seu departamento.</div>
                        ) : printersList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.patrimonio} · {[p.fabricante, p.modelo].filter(Boolean).join(" ") || "Impressora"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo de toner</Label>
                    <Select value={tonerId} onValueChange={setTonerId} disabled={!printerId || printerToners.length === 0}>
                      <SelectTrigger><SelectValue placeholder={printerToners.length === 0 ? "Sem toners cadastrados" : "Selecione"} /></SelectTrigger>
                      <SelectContent>
                        {(printerToners as any[]).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.modelo} ({t.cor})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedToner && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Estoque atual:</span>
                    <span className="font-medium">{selectedToner.quantidade} unidade(s)</span>
                    <StockBadge quantidade={selectedToner.quantidade} minimo={selectedToner.quantidade_minima} />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <RichTextEditor
                value={descricao}
                onChange={setDescricao}
                bucket="ticket-attachments"
                pathPrefix={inlinePathPrefix}
                minHeight={180}
                placeholder="Descreva o problema, quando começou, mensagens de erro, passos para reproduzir... (você pode colar imagens com Ctrl+V)"
              />

            </div>
            <div className="space-y-2">
              <Label>Anexos <span className="text-muted-foreground text-xs font-normal">(máx 5 arquivos, 10MB cada)</span></Label>
              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-accent/40 transition-colors">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clique para selecionar arquivos</span>
                <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={files.length >= MAX_FILES} />
              </label>
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-secondary px-3 py-2 rounded">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => nav({ to: "/chamados", search: CHAMADOS_DEFAULT_FILTERS })}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Abrir Chamado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

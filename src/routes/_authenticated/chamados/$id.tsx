import { DEFAULT_FILTERS as CHAMADOS_DEFAULT_FILTERS } from "./index";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, PriorityBadge, ColorBadge } from "@/components/ticket-badges";
import { useTicketLookups } from "@/hooks/use-ticket-lookups";
import {
  formatDate,
  formatTicketNumber,
} from "@/lib/format";
import { useAuth, useIsTI } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useServerFn } from "@tanstack/react-start";
import { softDeleteEntity } from "@/lib/admin-actions.functions";
import { sanitizeStorageFilename } from "@/lib/storage-utils";
import { toast } from "sonner";
import { RichTextEditor, RichTextContent, isEmptyHtml } from "@/components/rich-text-editor";
import { StockBadge } from "@/components/printer-toner-manager";
import { TicketSlaCard } from "@/components/ticket-sla-card";
import {
  ArrowLeft,
  Paperclip,
  Send,
  Download,
  X,
  UserCircle2,
  Wrench,
  Activity,
  Monitor,
  Printer,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/chamados/$id")({
  component: ChamadoDetail,
});

type TimelineItem =
  | { kind: "descricao"; id: string; at: string; autor: string | null; texto: string; isMe: boolean }
  | { kind: "comentario"; id: string; at: string; autor: string | null; texto: string; interno: boolean; isMe: boolean; isTI: boolean }
  | { kind: "evento"; id: string; at: string; autor: string | null; campo: string; antigo?: string | null; novo?: string | null };

function ChamadoDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isTI = useIsTI();
  const { canDeleteTickets } = usePermissions();
  const softDelete = useServerFn(softDeleteEntity);
  const { activeStatuses, activePriorities, statuses, priorities, categories } = useTicketLookups();
  const statusByName = useMemo(() => new Map(statuses.map((s) => [s.nome, s])), [statuses]);
  const priorityByName = useMemo(() => new Map(priorities.map((p) => [p.nome, p])), [priorities]);
  const categoryByName = useMemo(() => new Map(categories.map((c) => [c.nome, c])), [categories]);


  const { data: ticket, isLoading, error: ticketError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      console.log("[ChamadoDetail] carregando ticket id:", id);
      const { data, error, status } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      console.log("[ChamadoDetail] resultado tickets:", { status, error, data });
      if (error) throw error;
      if (!data) return null;

      const ids = [data.criado_por, data.responsavel_id].filter((x): x is string => !!x);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id,nome,email,departamento,telefone")
        .in("id", ids);
      if (pErr) console.warn("[ChamadoDetail] erro profiles:", pErr);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return {
        ...data,
        criador: byId.get(data.criado_por) ?? null,
        responsavel: data.responsavel_id ? byId.get(data.responsavel_id) ?? null : null,
      };
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at");
      if (error) {
        console.error("[ChamadoDetail] erro comments:", error);
        throw error;
      }
      const ids = Array.from(new Set((data ?? []).map((c) => c.autor_id).filter(Boolean)));
      let profMap = new Map<string, { id: string; nome: string }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
        profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      }
      return (data ?? []).map((c) => ({ ...c, autor: profMap.get(c.autor_id) ?? null }));
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_history")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at");
      if (error) {
        console.error("[ChamadoDetail] erro history:", error);
        throw error;
      }
      const ids = Array.from(new Set((data ?? []).map((h) => h.autor_id).filter((x): x is string => !!x)));
      let profMap = new Map<string, { nome: string }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
        profMap = new Map((profs ?? []).map((p) => [p.id, { nome: p.nome }]));
      }
      return (data ?? []).map((h) => ({ ...h, autor: h.autor_id ? profMap.get(h.autor_id) ?? null : null }));
    },
  });

  const { data: userInventory = [] } = useQuery({
    queryKey: ["user-inventory", ticket?.criado_por],
    enabled: !!ticket?.criado_por,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("inventory_safe");
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((i) => i.responsavel_id === ticket!.criado_por)
        .sort((a, b) => String(a.patrimonio).localeCompare(String(b.patrimonio)));
    },
  });

  const { data: ticketPrinter } = useQuery({
    queryKey: ["ticket-printer", ticket?.printer_id, ticket?.toner_id],
    enabled: !!ticket?.printer_id,
    queryFn: async () => {
      const printerId = (ticket as any).printer_id as string;
      const tonerIdLocal = (ticket as any).toner_id as string | null;
      const { data: safeItems } = await (supabase as any).rpc("inventory_safe");
      const printer = ((safeItems ?? []) as any[]).find((i) => i.id === printerId) ?? null;
      let toner: any = null;
      if (tonerIdLocal) {
        const { data: t } = await (supabase as any)
          .from("toners")
          .select("*")
          .eq("id", tonerIdLocal)
          .maybeSingle();
        toner = t;
      }

      return { printer, toner };
    },
  });



  // TI: pode visualizar quem são técnicos para atribuir
  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos"],
    enabled: isTI,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["tecnico", "admin"]);
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, nome").in("id", ids);
      return data ?? [];
    },
  });

  // Identifica quais autores de comentários são TI (para exibir avatar/label adequado)
  const authorIds = useMemo(
    () => Array.from(new Set(comments.map((c: any) => c.autor_id).filter(Boolean))),
    [comments],
  );
  const { data: tiAuthors = new Set<string>() } = useQuery({
    queryKey: ["ti-authors", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", authorIds as string[])
        .in("role", ["tecnico", "admin"]);
      return new Set((data ?? []).map((r) => r.user_id));
    },
  });

  // Realtime: atualiza conversa em tempo real
  useEffect(() => {
    const ch = supabase
      .channel("ticket-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_comments", filter: `ticket_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["comments", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_history", filter: `ticket_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["history", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_attachments", filter: `ticket_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["attachments", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["ticket", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  // Marca notificações deste chamado como lidas ao abrir
  useEffect(() => {
    if (!user) return;
    (async () => {
      await supabase
        .from("notifications")
        .update({ lida: true })
        .eq("ticket_id", id)
        .eq("user_id", user.id)
        .eq("lida", false);
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      qc.invalidateQueries({ queryKey: ["unread-by-ticket", user.id] });
    })();
  }, [id, user, qc]);

  // Timeline unificada
  const timeline: TimelineItem[] = useMemo(() => {
    if (!ticket) return [];
    const items: TimelineItem[] = [];
    items.push({
      kind: "descricao",
      id: "descricao",
      at: ticket.created_at,
      autor: (ticket as any).criador?.nome ?? null,
      texto: ticket.descricao,
      isMe: user?.id === ticket.criado_por,
    });
    for (const c of comments as any[]) {
      items.push({
        kind: "comentario",
        id: c.id,
        at: c.created_at,
        autor: c.autor?.nome ?? null,
        texto: c.conteudo,
        interno: !!c.interno,
        isMe: c.autor_id === user?.id,
        isTI: (tiAuthors as Set<string>).has(c.autor_id),
      });
    }
    for (const h of history as any[]) {
      // Pula evento "criado" pois a descrição já abre a timeline
      if (h.campo === "criado") continue;
      items.push({
        kind: "evento",
        id: h.id,
        at: h.created_at,
        autor: h.autor?.nome ?? null,
        campo: h.campo,
        antigo: h.valor_antigo,
        novo: h.valor_novo,
      });
    }
    items.sort((a, b) => +new Date(a.at) - +new Date(b.at));
    return items;
  }, [ticket, comments, history, tiAuthors, user]);

  // --- Reply box state ---
  const [newComment, setNewComment] = useState("");
  const [interno, setInterno] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [solucao, setSolucao] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [tituloDraft, setTituloDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  async function saveTitle() {
    const novo = tituloDraft.trim();
    if (!novo) return toast.error("O título não pode ficar vazio");
    if (!ticket || novo === ticket.titulo) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      const { error } = await (supabase.from("tickets") as any)
        .update({ titulo: novo })
        .eq("id", id);
      if (error) throw error;
      toast.success("Título atualizado");
      setEditingTitle(false);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets-list"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar título");
    } finally {
      setSavingTitle(false);
    }
  }
  // ID de sessão para agrupar uploads inline desta resposta
  const replyDraftIdRef = useRef<string>(
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
  );
  const inlinePathPrefix = user ? `inline/${user.id}/reply-${replyDraftIdRef.current}` : "";

  function addFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    for (const f of arr) {
      if (f.size > 10 * 1024 * 1024) return toast.error(`${f.name} excede 10MB`);
    }
    const next = [...files, ...arr].slice(0, 5);
    if (files.length + arr.length > 5) toast.warning("Máximo de 5 arquivos por envio.");
    setFiles(next);
  }

  async function sendReply() {
    if (!user) return;
    const hasContent = !isEmptyHtml(newComment);
    if (!hasContent && files.length === 0) return;
    setSending(true);
    try {
      if (hasContent) {
        const { error } = await supabase.from("ticket_comments").insert({
          ticket_id: id,
          autor_id: user.id,
          conteudo: newComment,
          interno: isTI ? interno : false,
        });
        if (error) throw error;
      }
      for (const f of files) {
        const path = `${id}/${Date.now()}-${sanitizeStorageFilename(f.name)}`;
        const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, f, { contentType: f.type || undefined });
        if (upErr) throw upErr;
        await supabase.from("ticket_attachments").insert({
          ticket_id: id,
          storage_path: path,
          nome: f.name,
          tamanho: f.size,
          mime: f.type,
          enviado_por: user.id,
        });
      }
      // Se o usuário (não-TI) responde a um status que aguarda usuário, devolve para "em atendimento"
      const curStatus = statusByName.get(ticket?.status ?? "");
      if (!isTI && curStatus && /aguardando.*usu[aá]rio/i.test(curStatus.nome)) {
        const back = activeStatuses.find((s) => /atend/i.test(s.nome));
        if (back) await (supabase.from("tickets") as any).update({ status: back.nome, status_id: back.id }).eq("id", id);
      }
      setNewComment("");
      setInterno(false);
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Mensagem enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function updateField(patch: Record<string, any>) {
    const { error } = await (supabase.from("tickets") as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    qc.invalidateQueries({ queryKey: ["history", id] });
    qc.invalidateQueries({ queryKey: ["tickets-list"] });
    toast.success("Atualizado");
  }

  async function registrarSolucao() {
    if (!solucao.trim()) return;
    const resolved = activeStatuses.find((s) => s.is_resolvido);
    if (!resolved) return toast.error("Configure um status como 'resolvido'.");
    await updateField({ solucao, status: resolved.nome, status_id: resolved.id });
    setSolucao("");
  }

  async function downloadAttachment(path: string, _nome: string) {
    const { data, error } = await supabase.storage.from("ticket-attachments").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Erro ao abrir");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const attachmentsByMessage = useMemo(() => {
    // Agrupa anexos por "janela próxima" ao comentário/descricao para mostrá-los junto. Aqui só exibimos a lista geral.
    return attachments;
  }, [attachments]);

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (ticketError) {
    console.error("[ChamadoDetail] erro ao carregar ticket:", ticketError);
    return (
      <div className="space-y-2">
        <p className="text-destructive">Erro ao carregar chamado: {ticketError.message}</p>
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/chamados", search: CHAMADOS_DEFAULT_FILTERS })}>
          <ArrowLeft className="h-4 w-4 mr-1" />Voltar
        </Button>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground">
          Chamado não encontrado. Verifique se o link está correto ou se você tem permissão para visualizá-lo. (ID: {id})
        </p>
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/chamados", search: CHAMADOS_DEFAULT_FILTERS })}>
          <ArrowLeft className="h-4 w-4 mr-1" />Voltar
        </Button>
      </div>
    );
  }

  const currentStatusLookup = statusByName.get(ticket.status);
  const canReply = !currentStatusLookup?.is_fechado;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/chamados", search: CHAMADOS_DEFAULT_FILTERS })}>
          <ArrowLeft className="h-4 w-4 mr-1" />Voltar
        </Button>
        <span className="font-mono text-sm text-muted-foreground">{formatTicketNumber(ticket.numero)}</span>
        <div className="flex-1" />
        {canDeleteTickets && (
          <ConfirmDeleteDialog
            entityLabel={`o chamado ${formatTicketNumber(ticket.numero)} — "${ticket.titulo}"`}
            onConfirm={async () => {
              try {
                await softDelete({ data: { entity_type: "ticket", entity_id: id, metadata: { numero: ticket.numero, titulo: ticket.titulo } } });
                toast.success("Chamado excluído (auditado)");
                qc.invalidateQueries({ queryKey: ["tickets-list"] });
                nav({ to: "/chamados", search: CHAMADOS_DEFAULT_FILTERS });
              } catch (e: any) {
                toast.error(e.message ?? "Erro ao excluir");
              }
            }}
            trigger={<Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-1 text-destructive" />Excluir</Button>}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Cabeçalho do chamado */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={tituloDraft}
                        onChange={(e) => setTituloDraft(e.target.value)}
                        maxLength={200}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                          if (e.key === "Escape") { setEditingTitle(false); }
                        }}
                        className="text-base"
                      />
                      <Button size="sm" onClick={saveTitle} disabled={savingTitle}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)} disabled={savingTitle}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl break-words">{ticket.titulo}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Editar título"
                        onClick={() => { setTituloDraft(ticket.titulo); setEditingTitle(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Aberto em {formatDate(ticket.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <ColorBadge name={ticket.categoria} color={categoryByName.get(ticket.categoria)?.cor} />
                  <PriorityBadge name={ticket.prioridade} color={priorityByName.get(ticket.prioridade)?.cor} />
                  <StatusBadge name={ticket.status} color={statusByName.get(ticket.status)?.cor} />
                </div>
              </div>
            </CardHeader>
            {ticket.solucao && (
              <CardContent>
                <div className="rounded-md border border-success/30 bg-success/5 p-3">
                  <p className="text-xs font-medium text-success mb-1">Solução registrada</p>
                  <p className="whitespace-pre-wrap text-sm">{ticket.solucao}</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Conversa / timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Conversa do chamado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {timeline.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.kind === "evento" ? (
                      <EventoRow item={item} />
                    ) : (
                      <MessageBubble item={item} />
                    )}
                  </li>
                ))}
              </ol>

              {/* Anexos do chamado */}
              {attachmentsByMessage.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Todos os anexos ({attachmentsByMessage.length})
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {attachmentsByMessage.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => downloadAttachment(a.storage_path, a.nome)}
                          className="flex items-center gap-2 text-sm text-primary hover:underline w-full text-left"
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.nome}</span>
                          <Download className="h-3 w-3 shrink-0 ml-auto" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Caixa de resposta */}
              {canReply ? (
                <div className="mt-6 pt-4 border-t space-y-2">
                  <Label className="text-xs">Sua mensagem</Label>
                  <RichTextEditor
                    value={newComment}
                    onChange={setNewComment}
                    bucket="ticket-attachments"
                    pathPrefix={inlinePathPrefix}
                    minHeight={160}
                    placeholder={
                      (isTI ? "Responder ao usuário..." : "Adicione informações, prints ou responda à TI...") +
                      " (você pode colar imagens com Ctrl+V)"
                    }
                  />


                  {files.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center gap-1 text-xs bg-secondary rounded px-2 py-1">
                          <Paperclip className="h-3 w-3" />
                          <span className="truncate max-w-[180px]">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => addFiles(e.target.files)}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                        <Paperclip className="h-4 w-4 mr-1" /> Anexar
                      </Button>
                      {isTI && (
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={interno} onCheckedChange={(v) => setInterno(!!v)} />
                          Nota interna
                        </label>
                      )}
                    </div>
                    <Button onClick={sendReply} disabled={sending || (isEmptyHtml(newComment) && files.length === 0)}>
                      <Send className="h-4 w-4 mr-1" /> Enviar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-6 pt-4 border-t text-sm text-muted-foreground text-center">
                  Este chamado está fechado e não aceita mais respostas.
                </p>
              )}
            </CardContent>
          </Card>

          {isTI && currentStatusLookup && !currentStatusLookup.is_resolvido && !currentStatusLookup.is_fechado && !currentStatusLookup.is_inicial && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registrar Solução</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ticketPrinter?.toner && ticketPrinter.toner.quantidade === 0 && !(ticket as any).toner_baixado && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                    ⚠️ Estoque zerado para o toner <b>{ticketPrinter.toner.modelo}</b>. A baixa automática será registrada como 0.
                  </div>
                )}
                <Textarea
                  value={solucao}
                  onChange={(e) => setSolucao(e.target.value)}
                  rows={3}
                  placeholder="Descreva como o problema foi resolvido..."
                />
                <Button onClick={registrarSolucao} disabled={!solucao.trim()}>
                  Registrar e marcar como resolvido
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><UserCircle2 className="h-4 w-4" />Solicitante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Nome" value={(ticket as any).criador?.nome ?? "—"} />
              <Info label="Departamento" value={(ticket as any).criador?.departamento ?? "—"} />
              <Info label="Ramal / Telefone" value={(ticket as any).criador?.telefone ?? "—"} />
              <Info label="E-mail" value={(ticket as any).criador?.email ?? "—"} />
            </CardContent>
          </Card>

          {ticketPrinter?.printer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Printer className="h-4 w-4" />{isTI ? "Impressora / Toner" : "Impressora"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Info label="Patrimônio" value={ticketPrinter.printer.patrimonio} />
                <Info label="Fabricante / Modelo" value={[ticketPrinter.printer.fabricante, ticketPrinter.printer.modelo].filter(Boolean).join(" ") || "—"} />
                {isTI && ticketPrinter.toner ? (
                  <>
                    <Info label="Toner" value={`${ticketPrinter.toner.modelo} (${ticketPrinter.toner.cor})`} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Estoque:</span>
                      <span className="font-medium">{ticketPrinter.toner.quantidade}</span>
                      <StockBadge quantidade={ticketPrinter.toner.quantidade} minimo={ticketPrinter.toner.quantidade_minima} />
                    </div>
                    {(ticket as any).toner_baixado && (
                      <p className="text-xs text-success">Baixa de estoque já registrada para este chamado.</p>
                    )}
                  </>
                ) : isTI ? (
                  <p className="text-xs text-muted-foreground">Nenhum modelo de toner vinculado.</p>
                ) : null}
              </CardContent>
            </Card>
          )}


          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" />Equipamentos vinculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {userInventory.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhum equipamento vinculado ao usuário.</p>
              ) : userInventory.map((eq: any) => (
                <div key={eq.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{eq.categoria?.nome ?? eq.tipo}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{eq.patrimonio}</span>
                  </div>
                  {(eq.fabricante || eq.modelo) && (
                    <EqRow label="Fabricante / Modelo" value={[eq.fabricante, eq.modelo].filter(Boolean).join(" ")} />
                  )}
                  {eq.numero_serie && <EqRow label="N° Série" value={eq.numero_serie} mono />}
                  {eq.computer_name && <EqRow label="Computador" value={eq.computer_name} />}
                  {eq.operating_system && <EqRow label="SO" value={eq.operating_system} />}
                  {eq.mac_address && <EqRow label="MAC" value={eq.mac_address} mono />}
                  {eq.ip_address && <EqRow label="IP" value={eq.ip_address} mono />}
                  {eq.anydesk_id && <EqRow label="AnyDesk" value={eq.anydesk_id} mono />}
                  {eq.teamviewer_id && <EqRow label="TeamViewer" value={eq.teamviewer_id} mono />}
                </div>
              ))}
            </CardContent>
          </Card>

          <TicketSlaCard ticket={ticket as any} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Número" value={formatTicketNumber(ticket.numero)} />
              <Info label="Status" valueNode={<StatusBadge name={ticket.status} color={statusByName.get(ticket.status)?.cor} />} />
              <Info label="Prioridade" valueNode={<PriorityBadge name={ticket.prioridade} color={priorityByName.get(ticket.prioridade)?.cor} />} />
              <Info label="Categoria" valueNode={<ColorBadge name={ticket.categoria} color={categoryByName.get(ticket.categoria)?.cor} />} />
              <Info label="Responsável" value={(ticket as any).responsavel?.nome ?? "Não atribuído"} />
              <Info label="Aberto em" value={formatDate(ticket.created_at)} />
              {ticket.resolvido_em && <Info label="Resolvido em" value={formatDate(ticket.resolvido_em)} />}
              {ticket.fechado_em && <Info label="Fechado em" value={formatDate(ticket.fechado_em)} />}
            </CardContent>
          </Card>

          {isTI && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Ações TI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={statusByName.get(ticket.status)?.id ?? ""}
                    onValueChange={(v) => {
                      const s = activeStatuses.find((x) => x.id === v);
                      if (s) updateField({ status: s.nome, status_id: s.id });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {activeStatuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsável</Label>
                  <Select
                    value={ticket.responsavel_id ?? "none"}
                    onValueChange={(v) => updateField({ responsavel_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não atribuído</SelectItem>
                      {tecnicos.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prioridade</Label>
                  <Select
                    value={priorityByName.get(ticket.prioridade)?.id ?? ""}
                    onValueChange={(v) => {
                      const p = activePriorities.find((x) => x.id === v);
                      if (p) updateField({ prioridade: p.nome, priority_id: p.id });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {activePriorities.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select
                    value={categoryByName.get(ticket.categoria)?.id ?? ""}
                    onValueChange={(v) => {
                      const c = categories.find((x) => x.id === v);
                      if (c) updateField({ categoria: c.nome, category_id: c.id });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {statusByName.get(ticket.status)?.is_resolvido && (() => {
                  const closed = activeStatuses.find((s) => s.is_fechado);
                  if (!closed) return null;
                  return (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => updateField({ status: closed.nome, status_id: closed.id })}>
                      Encerrar Chamado
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ item }: { item: Extract<TimelineItem, { kind: "descricao" | "comentario" }> }) {
  const isTIauthor = item.kind === "comentario" ? item.isTI : false;
  const align = item.isMe ? "items-end" : "items-start";
  const bubble = item.isMe
    ? "bg-primary text-primary-foreground"
    : isTIauthor
      ? "bg-accent text-accent-foreground border"
      : "bg-secondary";
  const interno = item.kind === "comentario" && item.interno;
  return (
    <div className={`flex flex-col ${align}`}>
      <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
        <UserCircle2 className="h-3.5 w-3.5" />
        <span className="font-medium">
          {item.autor ?? "—"}
          {isTIauthor && <span className="ml-1 text-[10px] text-primary">(TI)</span>}
        </span>
        <span>·</span>
        <span>{formatDate(item.at)}</span>
        {interno && (
          <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning/40 text-[10px]">
            Nota interna
          </Badge>
        )}
      </div>
      <div className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${bubble} ${interno ? "ring-1 ring-warning/40" : ""}`}>
        {/<[a-z][\s\S]*>/i.test(item.texto) ? (
          <RichTextContent html={item.texto} />
        ) : (
          <div className="whitespace-pre-wrap">{item.texto}</div>
        )}
      </div>
    </div>
  );
}

function EventoRow({ item }: { item: Extract<TimelineItem, { kind: "evento" }> }) {
  const label = (() => {
    if (item.campo === "status") {
      return `Status alterado para "${item.novo ?? ""}"`;
    }
    if (item.campo === "prioridade") {
      return `Prioridade alterada para "${item.novo ?? ""}"`;
    }
    if (item.campo === "responsavel") {
      return item.novo ? "Responsável atribuído" : "Responsável removido";
    }
    if (item.campo === "solucao") return "Solução registrada";
    return `${item.campo} atualizado`;
  })();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground my-1">
      <div className="flex-1 border-t border-dashed" />
      <div className="px-2 py-0.5 rounded-full bg-muted text-[11px]">
        {label} · {formatDate(item.at)}
        {item.autor ? ` · por ${item.autor}` : ""}
      </div>
      <div className="flex-1 border-t border-dashed" />
    </div>
  );
}

function Info({
  label,
  value,
  valueNode,
  sub,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  sub?: string | null;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {valueNode ? <div className="font-medium">{valueNode}</div> : <div className="font-medium">{value}</div>}
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function EqRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

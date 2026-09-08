import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, BookOpen, Pencil, Trash2, Paperclip, Download, X, ExternalLink } from "lucide-react";
import { useIsTI, useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useServerFn } from "@tanstack/react-start";
import { softDeleteEntity } from "@/lib/admin-actions.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { sanitizeStorageFilename } from "@/lib/storage-utils";

export const Route = createFileRoute("/_authenticated/base-conhecimento")({
  component: KBPage,
});

type TipoConteudo = { id: string; nome: string; slug: string; ativo: boolean };
const FALLBACK_TIPOS: { value: string; label: string }[] = [
  { value: "artigo", label: "Artigo" },
  { value: "procedimento", label: "Procedimento" },
  { value: "manual", label: "Manual" },
  { value: "politica", label: "Política" },
];

const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png";
const ACCEPT_EXT = ["pdf", "docx", "xlsx", "pptx", "jpg", "jpeg", "png"];
const MAX_MB = 20;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function inferMime(nameOrPath?: string) {
  const ext = nameOrPath?.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  return ext ? map[ext] : undefined;
}

function KBPage() {
  const isTI = useIsTI();
  const { canDeleteKbArticles } = usePermissions();
  const softDelete = useServerFn(softDeleteEntity);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todos");
  
  const [viewing, setViewing] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-cats"],
    queryFn: async () => (await supabase.from("kb_categories").select("*").order("nome")).data ?? [],
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ["kb-content-types"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("kb_content_types").select("*").eq("ativo", true).order("nome");
      return (data ?? []) as TipoConteudo[];
    },
  });
  const TIPOS = tipos.length > 0 ? tipos.map((t) => ({ value: t.slug, label: t.nome })) : FALLBACK_TIPOS;
  const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

  const { data: articles = [] } = useQuery({
    queryKey: ["kb-articles"],
    queryFn: async () => (await supabase.from("kb_articles").select("*, categoria:kb_categories(nome,slug)").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: viewAttachments = [] } = useQuery({
    queryKey: ["kb-attachments", viewing?.id],
    enabled: !!viewing?.id,
    queryFn: async () =>
      (await supabase.from("kb_attachments").select("*").eq("article_id", viewing.id).order("created_at")).data ?? [],
  });

  const { data: editAttachments = [] } = useQuery({
    queryKey: ["kb-attachments-edit", editing?.id],
    enabled: !!editing?.id,
    queryFn: async () =>
      (await supabase.from("kb_attachments").select("*").eq("article_id", editing.id).order("created_at")).data ?? [],
  });

  const filtered = articles.filter((a: any) => {
    if (cat !== "todos" && a.categoria?.slug !== cat) return false;
    
    if (q) {
      const s = q.toLowerCase();
      return a.titulo.toLowerCase().includes(s) || a.conteudo.toLowerCase().includes(s);
    }
    return true;
  });

  async function viewArticle(a: any) {
    setViewing(a);
    await supabase.from("kb_articles").update({ views: (a.views ?? 0) + 1 }).eq("id", a.id);
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    const valid: File[] = [];
    for (const f of arr) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPT_EXT.includes(ext)) { toast.error(`${f.name}: tipo não permitido`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name} excede ${MAX_MB}MB`); continue; }
      valid.push(f);
    }
    setPendingFiles((p) => [...p, ...valid]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function uploadAttachments(articleId: string, files: File[]) {
    for (const f of files) {
      const path = `${articleId}/${Date.now()}-${sanitizeStorageFilename(f.name)}`;
      const { error: upErr } = await supabase.storage.from("kb-attachments").upload(path, f, { contentType: f.type || undefined });
      if (upErr) throw upErr;
      const { error } = await supabase.from("kb_attachments").insert({
        article_id: articleId,
        storage_path: path,
        nome: f.name,
        tamanho: f.size,
        mime: f.type,
        enviado_por: user!.id,
      });
      if (error) throw error;
    }
  }

  async function save() {
    if (!editing?.titulo || !editing?.conteudo) return toast.error("Título e conteúdo obrigatórios");
    setSaving(true);
    try {
      const payload = {
        titulo: editing.titulo,
        conteudo: editing.conteudo,
        categoria_id: editing.categoria_id || null,
        tipo_conteudo: editing.tipo_conteudo || "artigo",
        publicado: editing.publicado ?? true,
        slug: editing.slug || slugify(editing.titulo) + "-" + Math.random().toString(36).slice(2, 6),
        autor_id: user!.id,
      };
      let articleId = editing.id as string | undefined;
      if (articleId) {
        const { error } = await supabase.from("kb_articles").update(payload).eq("id", articleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("kb_articles").insert(payload).select("id").single();
        if (error) throw error;
        articleId = data!.id;
      }
      if (pendingFiles.length > 0 && articleId) {
        await uploadAttachments(articleId, pendingFiles);
      }
      toast.success("Salvo!");
      setOpen(false); setEditing(null); setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      qc.invalidateQueries({ queryKey: ["kb-attachments"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(att: any) {
    try {
      await supabase.storage.from("kb-attachments").remove([att.storage_path]);
      await supabase.from("kb_attachments").delete().eq("id", att.id);
      qc.invalidateQueries({ queryKey: ["kb-attachments-edit", editing?.id] });
      qc.invalidateQueries({ queryKey: ["kb-attachments", editing?.id] });
      toast.success("Anexo removido");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  async function downloadAttachment(path: string, nome?: string) {
    const previewWindow = window.open("about:blank", "_blank");
    try {
      const { data, error } = await supabase.storage.from("kb-attachments").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "arquivo não encontrado");
      }

      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("não foi possível carregar o arquivo");

      const buffer = await response.arrayBuffer();
      const contentType = inferMime(nome ?? path) ?? response.headers.get("content-type") ?? "application/octet-stream";
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: contentType }));

      if (previewWindow) {
        previewWindow.location.href = blobUrl;
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.download = nome ?? path.split("/").pop() ?? "anexo";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e: any) {
      previewWindow?.close();
      console.error("[kb] attachment open error:", e, "path:", path);
      toast.error(`Erro ao abrir: ${e.message ?? "arquivo não encontrado"}`);
    }
  }

  async function saveAttachment(path: string, nome?: string) {
    try {
      const { data, error } = await supabase.storage.from("kb-attachments").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "arquivo não encontrado");
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("não foi possível carregar o arquivo");
      const buffer = await response.arrayBuffer();
      const contentType = inferMime(nome ?? path) ?? response.headers.get("content-type") ?? "application/octet-stream";
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: contentType }));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = nome ?? path.split("/").pop() ?? "anexo";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e: any) {
      console.error("[kb] attachment download error:", e, "path:", path);
      toast.error(`Erro ao baixar: ${e.message ?? "arquivo não encontrado"}`);
    }
  }

  async function removeArticle(id: string, titulo: string) {
    try {
      await softDelete({ data: { entity_type: "kb_article", entity_id: id, metadata: { titulo } } });
      toast.success("Artigo excluído (auditado)");
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    }
  }

  function openNew() {
    setEditing({ publicado: true, tipo_conteudo: "artigo" });
    setPendingFiles([]);
    setOpen(true);
  }
  function openEdit(a: any) {
    setEditing(a);
    setPendingFiles([]);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Artigos e procedimentos de TI</p>
        </div>
        {isTI && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setPendingFiles([]); } }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Artigo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Artigo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Título *</Label><Input value={editing?.titulo ?? ""} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Categoria</Label>
                    <Select value={editing?.categoria_id ?? ""} onValueChange={(v) => setEditing({ ...editing, categoria_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Tipo de Conteúdo</Label>
                    <Select value={editing?.tipo_conteudo ?? "artigo"} onValueChange={(v) => setEditing({ ...editing, tipo_conteudo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Conteúdo *</Label><Textarea rows={10} value={editing?.conteudo ?? ""} onChange={(e) => setEditing({ ...editing, conteudo: e.target.value })} /></div>

                <div className="space-y-2">
                  <Label>Anexos</Label>
                  <div className="flex items-center gap-2">
                    <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => pickFiles(e.target.files)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                      <Paperclip className="h-4 w-4 mr-1" />Adicionar arquivos
                    </Button>
                    <span className="text-xs text-muted-foreground">PDF, DOCX, XLSX, PPTX, JPG, PNG · máx {MAX_MB}MB</span>
                  </div>

                  {editAttachments.length > 0 && (
                    <ul className="space-y-1">
                      {editAttachments.map((att: any) => (
                        <li key={att.id} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1">
                          <span className="truncate">{att.nome} <span className="text-muted-foreground text-xs">({fmtSize(att.tamanho)})</span></span>
                          <div className="flex gap-1 shrink-0">
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadAttachment(att.storage_path, att.nome)}><Download className="h-3 w-3" /></Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeAttachment(att)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {pendingFiles.length > 0 && (
                    <ul className="space-y-1">
                      {pendingFiles.map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                          <span className="truncate">{f.name} <span className="text-muted-foreground text-xs">({fmtSize(f.size)})</span></span>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing?.publicado ?? true} onCheckedChange={(v) => setEditing({ ...editing, publicado: !!v })} />
                  Publicado
                </label>
              </div>
              <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar artigos..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas categorias</SelectItem>
              {categories.map((c: any) => <SelectItem key={c.id} value={c.slug}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {viewing ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{viewing.titulo}</CardTitle>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{TIPO_LABEL[viewing.tipo_conteudo] ?? "Artigo"}</Badge>
                  <span>{viewing.categoria?.nome ?? "Sem categoria"}</span>
                  <span>· {viewing.views} visualizações</span>
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>Fechar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <article className="prose prose-sm max-w-none whitespace-pre-wrap">{viewing.conteudo}</article>

            {viewAttachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos ({viewAttachments.length})</h3>
                <ul className="space-y-1">
                  {viewAttachments.map((att: any) => (
                    <li key={att.id} className="flex items-center justify-between gap-2 text-sm border rounded px-3 py-2">
                      <span className="truncate">{att.nome} <span className="text-muted-foreground text-xs">({fmtSize(att.tamanho)})</span></span>
                      <div className="flex gap-1 shrink-0">
                        <Button type="button" size="sm" variant="outline" onClick={() => downloadAttachment(att.storage_path, att.nome)}>
                          <ExternalLink className="h-3 w-3 mr-1" />Abrir
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => saveAttachment(att.storage_path, att.nome)}>
                          <Download className="h-3 w-3 mr-1" />Baixar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-12">Nenhum artigo.</p>
          ) : filtered.map((a: any) => (
            <Card key={a.id} className="hover:border-primary/50 transition-colors cursor-pointer relative group" onClick={() => viewArticle(a)}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-2">
                  <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">{a.titulo}</h3>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{TIPO_LABEL[a.tipo_conteudo] ?? "Artigo"}</Badge>
                      <span className="text-xs text-muted-foreground">{a.categoria?.nome ?? "Geral"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.conteudo.slice(0, 120)}</p>
                  </div>
                </div>
                {isTI && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                    {canDeleteKbArticles && (
                      <ConfirmDeleteDialog
                        entityLabel={`o artigo "${a.titulo}"`}
                        onConfirm={() => removeArticle(a.id, a.titulo)}
                        trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

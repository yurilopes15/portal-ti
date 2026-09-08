import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Pencil, ShieldAlert, BookOpen, Tag, FileType, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/base-conhecimento-config")({
  component: KbConfigPage,
});

type Category = { id: string; nome: string; slug: string; descricao: string | null; ativo: boolean };

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function KbConfigPage() {
  const { isAdmin, isLoading } = usePermissions();
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem acessar as configurações da Base de Conhecimento.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />Configurações da Base de Conhecimento
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie as categorias e tipos de conteúdo dos artigos.</p>
      </div>
      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories"><Tag className="h-4 w-4 mr-1" />Categorias</TabsTrigger>
          <TabsTrigger value="types"><FileType className="h-4 w-4 mr-1" />Tipos de Conteúdo</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><CategoriesCrud /></TabsContent>
        <TabsContent value="types"><ContentTypesCrud /></TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesCrud() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["kb-categories-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kb_categories").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  async function save() {
    if (!editing?.nome?.trim()) return toast.error("Nome é obrigatório");
    const nome = editing.nome.trim();
    const slug = (editing.slug?.trim() || slugify(nome));
    const payload = { nome, slug, descricao: editing.descricao || null, ativo: editing.ativo ?? true };
    const op = editing.id
      ? (supabase as any).from("kb_categories").update(payload).eq("id", editing.id)
      : (supabase as any).from("kb_categories").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["kb-categories-admin"] });
    qc.invalidateQueries({ queryKey: ["kb-categories"] });
  }

  async function toggleAtivo(c: Category) {
    const { error } = await (supabase as any).from("kb_categories").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kb-categories-admin"] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Tag className="h-4 w-4" />Categorias de Artigos</h2>
          <p className="text-xs text-muted-foreground">Categorias em uso por artigos não podem ser excluídas — apenas desativadas.</p>
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
                <Input
                  value={editing?.nome ?? ""}
                  onChange={(e) => setEditing({
                    ...editing,
                    nome: e.target.value,
                    slug: editing?.id ? editing?.slug : slugify(e.target.value),
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                <Input value={editing?.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
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
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cats.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhuma categoria.</td></tr>
            ) : cats.map((c) => (
              <tr key={c.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 font-medium">{c.nome}</td>
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{c.slug}</td>
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

type ContentType = { id: string; nome: string; slug: string; descricao: string | null; ativo: boolean };

function ContentTypesCrud() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ContentType> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: types = [] } = useQuery({
    queryKey: ["kb-content-types-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kb_content_types").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as ContentType[];
    },
  });

  async function save() {
    if (!editing?.nome?.trim()) return toast.error("Nome é obrigatório");
    const nome = editing.nome.trim();
    const slug = (editing.slug?.trim() || slugify(nome));
    const payload = { nome, slug, descricao: editing.descricao || null, ativo: editing.ativo ?? true };
    const op = editing.id
      ? (supabase as any).from("kb_content_types").update(payload).eq("id", editing.id)
      : (supabase as any).from("kb_content_types").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["kb-content-types-admin"] });
    qc.invalidateQueries({ queryKey: ["kb-content-types"] });
  }

  async function toggleAtivo(t: ContentType) {
    const { error } = await (supabase as any).from("kb_content_types").update({ ativo: !t.ativo }).eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kb-content-types-admin"] });
    qc.invalidateQueries({ queryKey: ["kb-content-types"] });
  }

  async function remove(t: ContentType) {
    if (!confirm(`Excluir o tipo "${t.nome}"?`)) return;
    const { error } = await (supabase as any).from("kb_content_types").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["kb-content-types-admin"] });
    qc.invalidateQueries({ queryKey: ["kb-content-types"] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><FileType className="h-4 w-4" />Tipos de Conteúdo</h2>
          <p className="text-xs text-muted-foreground">Tipos disponíveis ao criar um artigo (ex: Artigo, Procedimento, Manual, Política).</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ativo: true })}><Plus className="h-4 w-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Tipo de Conteúdo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={editing?.nome ?? ""}
                  onChange={(e) => setEditing({
                    ...editing,
                    nome: e.target.value,
                    slug: editing?.id ? editing?.slug : slugify(e.target.value),
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                <Input value={editing?.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                <p className="text-[10px] text-muted-foreground">Identificador único. Alterar pode desvincular artigos existentes.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} rows={2} />
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
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {types.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum tipo cadastrado.</td></tr>
            ) : types.map((t) => (
              <tr key={t.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 font-medium">{t.nome}</td>
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.descricao ?? "—"}</td>
                <td className="px-4 py-2"><Badge variant={t.ativo ? "default" : "outline"}>{t.ativo ? "Ativo" : "Inativo"}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-1 justify-end items-center">
                    <Switch checked={t.ativo} onCheckedChange={() => toggleAtivo(t)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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

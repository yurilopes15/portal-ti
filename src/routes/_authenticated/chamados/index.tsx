import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Plus, Search, MessageSquareDot, X } from "lucide-react";
import { formatTicketNumber, timeAgo } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/ticket-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, useIsTI } from "@/hooks/use-auth";
import { useTicketLookups } from "@/hooks/use-ticket-lookups";

type ChamadosFilters = { status: string; categoria: string; prioridade: string; q: string };

export const DEFAULT_FILTERS: ChamadosFilters = { status: "nao_resolvidos", categoria: "todos", prioridade: "todos", q: "" };

export const Route = createFileRoute("/_authenticated/chamados/")({
  validateSearch: (search: Record<string, unknown>): ChamadosFilters => {
    const pick = (key: keyof ChamadosFilters) =>
      typeof search[key] === "string" ? (search[key] as string) : DEFAULT_FILTERS[key];
    return {
      status: pick("status"),
      categoria: pick("categoria"),
      prioridade: pick("prioridade"),
      q: pick("q"),
    };
  },
  component: ChamadosList,
});

function ChamadosList() {
  const { user } = useAuth();
  const isTI = useIsTI();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { activeCategories, activePriorities, activeStatuses } = useTicketLookups();
  const q = search.q;
  const statusTab = search.status;
  const cat = search.categoria;
  const prio = search.prioridade;

  // Filtros vivem na URL (search params) — compartilháveis e persistidos por aba.
  // Removida a sincronização com user_preferences que causou ~380k upserts.

  const setQ = (v: string) => navigate({ search: (p: any) => ({ ...p, q: v }) });
  const setStatusTab = (v: string) => navigate({ search: (p: any) => ({ ...p, status: v }) });
  const setCat = (v: string) => navigate({ search: (p: any) => ({ ...p, categoria: v }) });
  const setPrio = (v: string) => navigate({ search: (p: any) => ({ ...p, prioridade: v }) });
  const clearFilters = () => navigate({ search: () => ({ ...DEFAULT_FILTERS }) });
  const hasActiveFilters = statusTab !== DEFAULT_FILTERS.status || cat !== "todos" || prio !== "todos" || q !== "";

  const { data: tickets = [], isLoading, isError, error } = useQuery({
    queryKey: ["tickets-list", user?.id, isTI],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const profileIds = Array.from(new Set(
        rows.flatMap((t) => [t.criado_por, t.responsavel_id]).filter((id): id is string => !!id),
      ));
      if (profileIds.length === 0) return rows;
      const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", profileIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((t) => ({
        ...t,
        criador: byId.get(t.criado_por) ?? null,
        responsavel: t.responsavel_id ? byId.get(t.responsavel_id) ?? null : null,
      }));
    },
  });

  const { data: unreadByTicket = {} } = useQuery({
    queryKey: ["unread-by-ticket", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("ticket_id").eq("lida", false);
      const map: Record<string, number> = {};
      for (const n of data ?? []) if (n.ticket_id) map[n.ticket_id] = (map[n.ticket_id] ?? 0) + 1;
      return map;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("tickets-list-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["tickets-list"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["unread-by-ticket", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const statusByName = useMemo(() => new Map(activeStatuses.map((s) => [s.nome, s])), [activeStatuses]);
  const priorityByName = useMemo(() => new Map(activePriorities.map((p) => [p.nome, p])), [activePriorities]);
  const categoryByName = useMemo(() => new Map(activeCategories.map((c) => [c.nome, c])), [activeCategories]);

  const unresolvedStatusNames = useMemo(
    () => new Set(activeStatuses.filter((s) => !s.is_resolvido && !s.is_fechado).map((s) => s.nome)),
    [activeStatuses],
  );

  const filtered = useMemo(() => {
    return tickets.filter((t: any) => {
      if (statusTab === "nao_resolvidos") {
        if (!unresolvedStatusNames.has(t.status)) return false;
      } else if (statusTab !== "todos" && t.status !== statusTab) {
        return false;
      }
      if (cat !== "todos" && t.categoria !== cat) return false;
      if (prio !== "todos" && t.prioridade !== prio) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!t.titulo.toLowerCase().includes(s) && !String(t.numero).includes(s)) return false;
      }
      return true;
    });
  }, [tickets, q, statusTab, cat, prio, unresolvedStatusNames]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isTI ? "Chamados" : "Meus Chamados"}</h1>
          <p className="text-sm text-muted-foreground">
            {isTI ? "Gerencie todos os chamados de TI" : "Acompanhe a evolução do atendimento dos seus chamados"}
          </p>
        </div>
        <Button asChild><Link to="/chamados/novo"><Plus className="h-4 w-4 mr-1" />Novo Chamado</Link></Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por título ou número..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusTab} onValueChange={setStatusTab}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao_resolvidos">Não resolvidos</SelectItem>
              <SelectItem value="todos">Todos os status</SelectItem>
              {activeStatuses.map((s) => (
                <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas categorias</SelectItem>
              {activeCategories.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prio} onValueChange={setPrio}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas prioridades</SelectItem>
              {activePriorities.map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Filtros ativos serão mantidos até você limpá-los.</span>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Prioridade</th>
                <th className="px-4 py-3 text-left">Status</th>
                {isTI && <th className="px-4 py-3 text-left">Solicitante</th>}
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading || !user ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : isError ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-destructive">{error?.message ?? "Erro ao carregar chamados."}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhum chamado encontrado.</td></tr>
              ) : filtered.map((t: any) => {
                const unread = unreadByTicket[t.id] ?? 0;
                const sLook = statusByName.get(t.status);
                const pLook = priorityByName.get(t.prioridade);
                const cLook = categoryByName.get(t.categoria);
                return (
                  <tr key={t.id} className={`hover:bg-accent/40 cursor-pointer ${unread > 0 ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <Link to="/chamados/$id" params={{ id: t.id }} className="block">{formatTicketNumber(t.numero)}</Link>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link to="/chamados/$id" params={{ id: t.id }} className="flex items-center gap-2 hover:text-primary">
                        <span className="truncate">{t.titulo}</span>
                        {unread > 0 && (
                          <Badge className="gap-1 bg-primary text-primary-foreground shrink-0">
                            <MessageSquareDot className="h-3 w-3" />
                            {unread === 1 ? "Nova resposta" : `${unread} novas`}
                          </Badge>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge name={t.categoria} color={cLook?.cor} /></td>
                    <td className="px-4 py-3"><PriorityBadge name={t.prioridade} color={pLook?.cor} /></td>
                    <td className="px-4 py-3"><StatusBadge name={t.status} color={sLook?.cor} /></td>
                    {isTI && <td className="px-4 py-3 text-muted-foreground">{t.criador?.nome ?? "—"}</td>}
                    <td className="px-4 py-3 text-muted-foreground">{t.responsavel?.nome ?? <span className="text-muted-foreground/60">não atribuído</span>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(t.updated_at)}</td>
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

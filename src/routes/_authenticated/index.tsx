import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Ticket, Clock, CheckCircle2, AlertTriangle, TrendingUp, Plus, UserCheck, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTicketNumber, timeAgo } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/ticket-badges";
import { useTicketLookups } from "@/hooks/use-ticket-lookups";
import { useAuth, useIsTI } from "@/hooks/use-auth";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InventoryDashboard } from "@/components/inventory-dashboard";
import { usePermissions } from "@/hooks/use-permissions";
import { useUserPreferences, type DashboardView } from "@/hooks/use-user-preferences";

const CategoriaBarChart = lazy(() =>
  import("@/components/dashboard-charts").then((m) => ({ default: m.CategoriaBarChart })),
);
const PrioridadePieChart = lazy(() =>
  import("@/components/dashboard-charts").then((m) => ({ default: m.PrioridadePieChart })),
);

function ChartFallback() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando gráfico...</div>;
}

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

type DashView = DashboardView;

function Dashboard() {
  const isTI = useIsTI();
  const { canManageInventory } = usePermissions();
  const { user } = useAuth();
  const { preferences, update } = useUserPreferences();
  const view: DashView = preferences.dashboard_view;

  function changeView(v: DashView) {
    if (!v || v === view) return;
    update({ dashboard_view: v });
  }


  const { activeCategories, activePriorities, activeStatuses } = useTicketLookups();
  const { data: tickets = [] } = useQuery({
    queryKey: ["dashboard-tickets", user?.id, isTI],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("tickets").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (!isTI && user) q = q.eq("criado_por", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusByName = useMemo(() => new Map(activeStatuses.map((s) => [s.nome, s])), [activeStatuses]);
  const priorityByName = useMemo(() => new Map(activePriorities.map((p) => [p.nome, p])), [activePriorities]);
  const initialStatus = activeStatuses.find((s) => s.is_inicial);
  const resolvedStatuses = new Set(activeStatuses.filter((s) => s.is_resolvido).map((s) => s.nome));
  const closedStatuses = new Set(activeStatuses.filter((s) => s.is_fechado).map((s) => s.nome));
  const criticaName = activePriorities.find((p) => /cr[ií]tica/i.test(p.nome))?.nome;
  const emAtendName = activeStatuses.find((s) => /atend/i.test(s.nome))?.nome;
  const aguardName = activeStatuses.find((s) => /aguardando/i.test(s.nome))?.nome;
  const resolvidoName = activeStatuses.find((s) => s.is_resolvido)?.nome;
  const fechadoName = activeStatuses.find((s) => s.is_fechado)?.nome;

  const countByStatus = (name?: string) => name ? tickets.filter((t) => t.status === name).length : 0;
  const abertos = countByStatus(initialStatus?.nome);
  const emAtend = countByStatus(emAtendName);
  const aguard = countByStatus(aguardName);
  const resolvidos = tickets.filter((t) => resolvedStatuses.has(t.status)).length;
  const fechados = tickets.filter((t) => closedStatuses.has(t.status)).length;
  const criticos = tickets.filter((t) => t.prioridade === criticaName && !resolvedStatuses.has(t.status) && !closedStatuses.has(t.status)).length;

  const resolved = tickets.filter((t) => t.resolvido_em);
  const tempoMedio = resolved.length
    ? resolved.reduce((acc, t) => acc + (new Date(t.resolvido_em!).getTime() - new Date(t.created_at).getTime()), 0) / resolved.length / 36e5
    : 0;

  const porCategoria = activeCategories.map((c) => ({
    name: c.nome,
    total: tickets.filter((t) => t.categoria === c.nome).length,
  })).filter((x) => x.total > 0);

  const porPrioridade = activePriorities.map((p) => ({
    name: p.nome,
    value: tickets.filter((t) => t.prioridade === p.nome).length,
    color: p.cor,
  })).filter((x) => x.value > 0);

  const pieColors = ["hsl(var(--chart-3))", "var(--info)", "var(--warning)", "var(--destructive)"];

  const recentes = tickets.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {view === "inventario"
              ? "Visão geral do inventário de ativos"
              : isTI ? "Visão geral dos chamados de TI" : "Visão geral dos seus chamados"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManageInventory && (
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => changeView(v as DashView)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="chamados">Chamados</ToggleGroupItem>
              <ToggleGroupItem value="inventario">Inventário</ToggleGroupItem>
            </ToggleGroup>
          )}
          {view === "chamados" && (
            <Button asChild>
              <Link to="/chamados/novo"><Plus className="h-4 w-4 mr-1" />Novo Chamado</Link>
            </Button>
          )}
        </div>
      </div>

      {view === "inventario" && canManageInventory ? <InventoryDashboard /> : (
      <>


      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Abertos" value={abertos} icon={Ticket} accent="info" status={initialStatus?.nome ?? "todos"} />
        <MetricCard label="Em Atendimento" value={emAtend} icon={Clock} accent="warning" status={emAtendName ?? "todos"} />
        <MetricCard label="Aguardando Usuário" value={aguard} icon={UserCheck} accent="warning" status={aguardName ?? "todos"} />
        <MetricCard label="Resolvidos" value={resolvidos} icon={CheckCircle2} accent="success" status={resolvidoName ?? "todos"} />
        <MetricCard label="Fechados" value={fechados} icon={Archive} accent="muted" status={fechadoName ?? "todos"} />
        <MetricCard label="Críticos Pendentes" value={criticos} icon={AlertTriangle} accent="destructive" status="todos" priority={criticaName} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Chamados por Categoria</CardTitle>
            <CardDescription>Distribuição dos chamados no sistema</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {porCategoria.length === 0 ? (
              <EmptyChart />
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <CategoriaBarChart data={porCategoria} />
              </Suspense>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Prioridade</CardTitle>
            <CardDescription>Distribuição atual</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {porPrioridade.length === 0 ? (
              <EmptyChart />
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <PrioridadePieChart data={porPrioridade} colors={pieColors} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Tempo Médio</CardTitle>
            <CardDescription>Para resolução</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tempoMedio.toFixed(1)}<span className="text-base font-normal text-muted-foreground ml-1">h</span></div>
            <p className="text-xs text-muted-foreground mt-1">Baseado em {resolved.length} chamado(s)</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Chamados Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentes.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhum chamado ainda.</p>
            ) : (
              <ul className="divide-y">
                {recentes.map((t) => (
                  <li key={t.id}>
                    <Link to="/chamados/$id" params={{ id: t.id }} className="flex items-center gap-3 px-6 py-3 hover:bg-accent transition-colors">
                      <span className="text-xs font-mono text-muted-foreground w-16">{formatTicketNumber(t.numero)}</span>
                      <span className="flex-1 text-sm truncate">{t.titulo}</span>
                      <PriorityBadge name={t.prioridade} color={priorityByName.get(t.prioridade)?.cor} />
                      <StatusBadge name={t.status} color={statusByName.get(t.status)?.cor} />
                      <span className="text-xs text-muted-foreground hidden sm:inline">{timeAgo(t.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}


function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  status,
  priority,
}: {
  label: string;
  value: number;
  icon: any;
  accent: "info" | "warning" | "success" | "destructive" | "muted";
  status: string;
  priority?: string;
}) {
  const colors = {
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Link
      to="/chamados"
      search={{ status, ...(priority ? { prioridade: priority } : {}) } as any}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
    >
      <Card className="transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer h-full">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
              <p className="text-3xl font-bold mt-2">{value}</p>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colors[accent]}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}

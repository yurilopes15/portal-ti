import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Boxes, Monitor, Printer, Phone, Network, Smartphone, Laptop, UserX, Wrench, KeyRound } from "lucide-react";
import { INVENTORY_GROUPS, INVENTORY_GROUP_KEYS, type InventoryGroupKey } from "@/lib/inventory-groups";

const CategoriaBarChart = lazy(() =>
  import("@/components/dashboard-charts").then((m) => ({ default: m.CategoriaBarChart })),
);

function ChartFallback() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando gráfico...</div>;
}

const GROUP_ICON: Record<InventoryGroupKey, any> = {

  computadores: Laptop,
  monitores: Monitor,
  impressoras: Printer,
  telefones: Phone,
  rede: Network,
  celulares: Smartphone,
  licencas: KeyRound,
};


function normalize(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export function InventoryDashboard() {
  const { data: items = [] } = useQuery({
    queryKey: ["dashboard-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, status, responsavel_id, responsavel:profiles!inventory_items_responsavel_id_fkey(nome, departamento), categoria:inventory_categories(nome)")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const groupCounts = useMemo(() => {
    const counts: Record<InventoryGroupKey, number> = {
      computadores: 0, monitores: 0, impressoras: 0, telefones: 0, rede: 0, celulares: 0, licencas: 0,
    };

    const groupCatSets = INVENTORY_GROUP_KEYS.map((k) => ({
      key: k,
      set: new Set(INVENTORY_GROUPS[k].categorias.map((c) => c.toLowerCase())),
    }));
    for (const it of items) {
      const cat = normalize((it as any).categoria?.nome);
      if (!cat) continue;
      for (const g of groupCatSets) {
        if (g.set.has(cat)) { counts[g.key]++; break; }
      }
    }
    return counts;
  }, [items]);

  const porStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const s = (it as any).status || "Sem status";
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return Array.from(m, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [items]);

  const porDepto = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const d = (it as any).responsavel?.departamento?.trim() || "Sem departamento";
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return Array.from(m, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [items]);

  const semResponsavel = items.filter((i: any) => !i.responsavel_id).length;
  const emManutencao = items.filter((i: any) => /manuten/i.test(i.status ?? "")).length;
  const total = items.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <InvMetricCard label="Total de Ativos" value={total} icon={Boxes} accent="info" />
        {INVENTORY_GROUP_KEYS.map((k) => (
          <InvMetricCard
            key={k}
            label={INVENTORY_GROUPS[k].label}
            value={groupCounts[k]}
            icon={GROUP_ICON[k]}
            accent="muted"
            grupo={k}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ativos por Status</CardTitle>
            <CardDescription>Distribuição atual</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {porStatus.length === 0 ? (
              <Empty />
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <CategoriaBarChart data={porStatus} />
              </Suspense>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ativos por Departamento</CardTitle>
            <CardDescription>Baseado no responsável</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {porDepto.length === 0 ? (
              <Empty />
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <CategoriaBarChart data={porDepto} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4 text-warning" />
              Equipamentos sem Responsável
            </CardTitle>
            <CardDescription>Ativos sem usuário vinculado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{semResponsavel}</div>
            <p className="text-xs text-muted-foreground mt-1">de {total} ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-destructive" />
              Equipamentos em Manutenção
            </CardTitle>
            <CardDescription>Status contendo "manutenção"</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{emManutencao}</div>
            <p className="text-xs text-muted-foreground mt-1">de {total} ativos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InvMetricCard({
  label, value, icon: Icon, accent, grupo,
}: {
  label: string; value: number; icon: any;
  accent: "info" | "warning" | "success" | "destructive" | "muted";
  grupo?: InventoryGroupKey;
}) {
  const colors = {
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  const content = (
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
  );
  return (
    <Link
      to="/inventario"
      search={grupo ? ({ grupo } as any) : ({} as any)}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
    >
      {content}
    </Link>
  );
}

function Empty() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}

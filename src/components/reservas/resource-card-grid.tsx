import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Laptop2, Camera, Mic, Monitor, Package } from "lucide-react";

type Type = "room" | "equipment";

type Resource = {
  id: string;
  name: string;
  type: Type;
  patrimonio: string | null;
  status: string;
};

function iconFor(r: Resource) {
  if (r.type === "room") return Building2;
  const n = r.name.toLowerCase();
  if (n.includes("notebook")) return Laptop2;
  if (n.includes("webcam") || n.includes("câmera")) return Camera;
  if (n.includes("micro")) return Mic;
  if (n.includes("projetor") || n.includes("tv")) return Monitor;
  return Package;
}

export function ResourceCardGrid({ type, title, subtitle }: { type: Type; title: string; subtitle: string }) {
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources", type],
    queryFn: async () => {
      const { data, error } = await supabase.from("reservation_resources").select("*").eq("type", type).order("name");
      if (error) throw error;
      return (data ?? []) as Resource[];
    },
  });

  const ids = useMemo(() => resources.map((r) => r.id), [resources]);

  const { data: counts = {} } = useQuery({
    queryKey: ["resource-counts", type, ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("reservations")
        .select("resource_id,start_datetime,end_datetime,status")
        .in("resource_id", ids)
        .neq("status", "cancelado")
        .gte("end_datetime", now)
        .order("start_datetime", { ascending: true });
      if (error) throw error;
      type Entry = {
        upcoming: number;
        inUse: boolean;
        blockStart?: Date;
        blockEnd?: Date;
        nextStart?: Date;
        nextEnd?: Date;
      };
      const grouped: Record<string, { start: Date; end: Date }[]> = {};
      for (const r of data ?? []) {
        (grouped[r.resource_id] ??= []).push({
          start: new Date(r.start_datetime as string),
          end: new Date(r.end_datetime as string),
        });
      }
      const nowD = new Date();
      const GAP_MS = 15 * 60 * 1000; // treat <=15min gap as contiguous
      const map: Record<string, Entry> = {};
      for (const [rid, list] of Object.entries(grouped)) {
        list.sort((a, b) => a.start.getTime() - b.start.getTime());
        const e: Entry = { upcoming: list.length, inUse: false };
        // find current reservation
        const currentIdx = list.findIndex((r) => r.start <= nowD && r.end >= nowD);
        if (currentIdx >= 0) {
          e.inUse = true;
          e.blockStart = list[currentIdx].start;
          e.blockEnd = list[currentIdx].end;
          // extend through back-to-back reservations
          for (let i = currentIdx + 1; i < list.length; i++) {
            if (list[i].start.getTime() - e.blockEnd!.getTime() <= GAP_MS) {
              e.blockEnd = list[i].end;
            } else {
              e.nextStart = list[i].start;
              e.nextEnd = list[i].end;
              break;
            }
          }
        } else {
          const next = list.find((r) => r.start > nowD);
          if (next) {
            e.nextStart = next.start;
            e.nextEnd = next.end;
          }
        }
        map[rid] = e;
      }
      return map;
    },
  });

  const fmt = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isToday = (d: Date) => {
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  const linkTo = type === "room" ? "/reservas/salas/$id" : "/reservas/equipamentos/$id";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {resources.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Nenhum recurso cadastrado.</Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resources.map((r) => {
            const Icon = iconFor(r);
            const c = counts[r.id] ?? { upcoming: 0, inUse: false };
            const statusLabel = r.status === "manutencao" ? "Manutenção" : r.status === "inativo" ? "Inativo" : c.inUse ? "Em uso agora" : "Disponível";
            const statusTone = r.status !== "disponivel"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
              : c.inUse
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
            return (
              <Link
                key={r.id}
                to={linkTo}
                params={{ id: r.id }}
                className="group"
              >
                <Card className="p-4 h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.name}</div>
                      {r.patrimonio && <div className="text-[11px] text-muted-foreground truncate">Pat. {r.patrimonio}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] ${statusTone}`}>{statusLabel}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.upcoming === 0 ? "Sem reservas" : `${c.upcoming} reserva${c.upcoming > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground leading-snug min-h-[2.25rem]">
                    {r.status !== "disponivel" ? (
                      <span>Recurso indisponível</span>
                    ) : c.inUse && c.blockStart && c.blockEnd ? (
                      <span>
                        Reservado das {fmt(c.blockStart)} às {fmt(c.blockEnd)}.
                        {" "}Disponível após {fmt(c.blockEnd)}
                        {c.nextStart && c.nextEnd && isToday(c.nextStart)
                          ? `, até a próxima reserva das ${fmt(c.nextStart)} às ${fmt(c.nextEnd)}.`
                          : "."}
                      </span>
                    ) : c.nextStart && c.nextEnd && isToday(c.nextStart) ? (
                      <span>
                        Livre agora. Próxima reserva das {fmt(c.nextStart)} às {fmt(c.nextEnd)}.
                      </span>
                    ) : c.nextStart && c.nextEnd ? (
                      <span>
                        Livre hoje. Próxima em {c.nextStart.toLocaleDateString("pt-BR")} {fmt(c.nextStart)}–{fmt(c.nextEnd)}.
                      </span>
                    ) : (
                      <span>Disponível — sem reservas futuras.</span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

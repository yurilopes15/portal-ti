import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Timer, ChevronDown, PauseCircle, Zap, Flag } from "lucide-react";
import { useSlaConfigs } from "@/hooks/use-sla";
import { useTicketLookups } from "@/hooks/use-ticket-lookups";
import { computeSla, formatDuration, slaStatusLabel, slaStatusColor, consumptionBarColor, type TicketSlaFields } from "@/lib/sla";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  ticket: TicketSlaFields & { prioridade?: string | null; priority_id?: string | null };
};

export function TicketSlaCard({ ticket }: Props) {
  const { priorities } = useTicketLookups();
  const { data: configs = [] } = useSlaConfigs();
  const [, setTick] = useState(0);

  const priorityId = useMemo(() => {
    if (ticket.priority_id) return ticket.priority_id;
    if (ticket.prioridade) return priorities.find((p) => p.nome === ticket.prioridade)?.id ?? null;
    return null;
  }, [ticket.priority_id, ticket.prioridade, priorities]);

  const cfg = useMemo(() => configs.find((c) => c.priority_id === priorityId) ?? null, [configs, priorityId]);

  useEffect(() => {
    if (ticket.sla_finished_at) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [ticket.sla_finished_at]);

  const snap = useMemo(() => computeSla(ticket, cfg), [ticket, cfg, configs]);
  const color = slaStatusColor(snap.status);
  const barColor = consumptionBarColor(snap.percentUsed, snap.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Timer className="h-4 w-4" />SLA</span>
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", color.bg, color.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
            {slaStatusLabel(snap.status)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {snap.status === "sem_config" ? (
          <p className="text-xs text-muted-foreground">
            Nenhum SLA configurado para esta prioridade. Configure em Configurações → Chamados → SLA.
          </p>
        ) : (
          <>
            {/* Progress */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full transition-all", barColor)}
                     style={{ width: `${Math.min(100, snap.percentUsed)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{snap.percentUsed}% consumido</span>
                {snap.isPaused && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <PauseCircle className="h-3 w-3" />Contador pausado
                  </span>
                )}
              </div>
            </div>

            {/* Main metric */}
            <div className="space-y-0.5">
              <div className="text-2xl font-semibold tabular-nums leading-none">
                {formatDuration(snap.usedSeconds)}
                <span className="text-muted-foreground text-base font-normal"> / {formatDuration(snap.limitSeconds)}</span>
              </div>
              <div className={cn("text-xs tabular-nums",
                snap.status === "vencido" ? "text-destructive font-medium" :
                snap.status === "concluido" ? "text-muted-foreground" : "text-muted-foreground")}>
                {snap.isFinished
                  ? "SLA encerrado"
                  : snap.remainingSeconds >= 0
                    ? `Restam ${formatDuration(snap.remainingSeconds)}`
                    : `Vencido há ${formatDuration(Math.abs(snap.remainingSeconds))}`}
              </div>
            </div>

            {/* Secondary indicators */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <Indicator
                icon={<Zap className="h-3 w-3" />}
                label="1º atendimento"
                value={
                  snap.firstResponseAt
                    ? (snap.firstResponseMet ? "Cumprido" : "Atrasado")
                    : (snap.firstResponseMet === false ? "Vencido" : "Pendente")
                }
                tone={
                  snap.firstResponseAt
                    ? (snap.firstResponseMet ? "ok" : "bad")
                    : (snap.firstResponseMet === false ? "bad" : "muted")
                }
              />
              <Indicator
                icon={<PauseCircle className="h-3 w-3" />}
                label="Pausado"
                value={snap.pausedSeconds > 0 ? formatDuration(snap.pausedSeconds) : "—"}
                tone="muted"
              />
              <Indicator
                icon={<Flag className="h-3 w-3" />}
                label="Prioridade"
                value={ticket.prioridade ?? "—"}
                tone="muted"
              />
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs justify-between">
                  Ver detalhes
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-1.5 text-xs">
                <DetailRow label="Tempo limite" value={formatDuration(snap.limitSeconds)} />
                <DetailRow label="Tempo utilizado" value={formatDuration(snap.usedSeconds)} />
                <DetailRow label="Tempo pausado" value={formatDuration(snap.pausedSeconds)} />
                <DetailRow label="Alvo 1º atendimento" value={`${snap.firstResponseTargetMinutes} min`} />
                <DetailRow label="Aberto em" value={formatDate(ticket.created_at)} />
                <DetailRow label="1º atendimento em" value={snap.firstResponseAt ? formatDate(snap.firstResponseAt) : "—"} />
                <DetailRow label="Encerrado em" value={ticket.sla_finished_at ? formatDate(ticket.sla_finished_at) : "—"} />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Indicator({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "ok" | "bad" | "muted" }) {
  const toneCls =
    tone === "ok" ? "text-success" :
    tone === "bad" ? "text-destructive" :
    "text-foreground";
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div>
      <div className={cn("font-medium truncate", toneCls)}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

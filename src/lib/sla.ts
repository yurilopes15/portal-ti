export type SlaConfig = {
  id: string;
  priority_id: string;
  resolution_hours: number;
  first_response_minutes: number;
  enabled: boolean;
};

export type SlaStatusRule = {
  id: string;
  status_id: string;
  pause_sla: boolean;
  finish_sla: boolean;
};

export type TicketSlaFields = {
  created_at: string;
  first_response_at: string | null;
  sla_pause_started_at: string | null;
  sla_paused_seconds: number;
  sla_finished_at: string | null;
};

export type SlaStatus = "dentro" | "alerta" | "vencido" | "concluido" | "sem_config";

export type SlaSnapshot = {
  status: SlaStatus;
  limitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  pausedSeconds: number;
  percentUsed: number;
  isPaused: boolean;
  isFinished: boolean;
  firstResponseTargetMinutes: number;
  firstResponseAt: string | null;
  firstResponseDueAt: Date;
  firstResponseMet: boolean | null; // null = ainda em andamento
};

export function computeSla(ticket: TicketSlaFields, cfg: SlaConfig | null | undefined): SlaSnapshot {
  if (!cfg || !cfg.enabled) {
    return {
      status: "sem_config",
      limitSeconds: 0,
      usedSeconds: 0,
      remainingSeconds: 0,
      pausedSeconds: 0,
      percentUsed: 0,
      isPaused: false,
      isFinished: !!ticket.sla_finished_at,
      firstResponseTargetMinutes: 0,
      firstResponseAt: ticket.first_response_at,
      firstResponseDueAt: new Date(ticket.created_at),
      firstResponseMet: ticket.first_response_at ? true : null,
    };
  }

  const limitSeconds = Math.round(cfg.resolution_hours * 3600);
  const createdAt = new Date(ticket.created_at).getTime();
  const isFinished = !!ticket.sla_finished_at;
  const endRef = isFinished ? new Date(ticket.sla_finished_at!).getTime() : Date.now();

  let pausedSeconds = ticket.sla_paused_seconds || 0;
  const isPaused = !!ticket.sla_pause_started_at && !isFinished;
  if (isPaused) {
    pausedSeconds += Math.max(0, Math.floor((Date.now() - new Date(ticket.sla_pause_started_at!).getTime()) / 1000));
  }

  const elapsedSeconds = Math.max(0, Math.floor((endRef - createdAt) / 1000));
  const usedSeconds = Math.max(0, elapsedSeconds - pausedSeconds);
  const remainingSeconds = limitSeconds - usedSeconds;
  const percentUsed = limitSeconds > 0 ? Math.min(999, Math.round((usedSeconds / limitSeconds) * 100)) : 0;

  let status: SlaStatus;
  if (isFinished) status = "concluido";
  else if (usedSeconds > limitSeconds) status = "vencido";
  else if (remainingSeconds < limitSeconds * 0.2) status = "alerta";
  else status = "dentro";

  const firstResponseDueAt = new Date(createdAt + cfg.first_response_minutes * 60 * 1000);
  let firstResponseMet: boolean | null;
  if (ticket.first_response_at) {
    firstResponseMet = new Date(ticket.first_response_at).getTime() <= firstResponseDueAt.getTime();
  } else {
    firstResponseMet = Date.now() <= firstResponseDueAt.getTime() ? null : false;
  }

  return {
    status,
    limitSeconds,
    usedSeconds,
    remainingSeconds,
    pausedSeconds,
    percentUsed,
    isPaused,
    isFinished,
    firstResponseTargetMinutes: cfg.first_response_minutes,
    firstResponseAt: ticket.first_response_at,
    firstResponseDueAt,
    firstResponseMet,
  };
}

export function formatDuration(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  const s = Math.abs(Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  let out: string;
  if (days > 0) out = `${days}d${hours.toString().padStart(2, "0")}h`;
  else if (hours > 0) out = `${hours}h${mins.toString().padStart(2, "0")}`;
  else out = `${mins}min`;
  return neg ? `-${out}` : out;
}

export function slaStatusLabel(s: SlaStatus): string {
  switch (s) {
    case "dentro": return "Dentro do SLA";
    case "alerta": return "Atenção";
    case "vencido": return "Vencido";
    case "concluido": return "Concluído";
    case "sem_config": return "Sem SLA";
  }
}

export function slaStatusColor(s: SlaStatus): { bg: string; text: string; dot: string; bar: string } {
  switch (s) {
    case "dentro":    return { bg: "bg-success/10",     text: "text-success",     dot: "bg-success",     bar: "bg-success" };
    case "alerta":    return { bg: "bg-warning/10",     text: "text-warning",     dot: "bg-warning",     bar: "bg-warning" };
    case "vencido":   return { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", bar: "bg-destructive" };
    case "concluido": return { bg: "bg-muted",          text: "text-muted-foreground", dot: "bg-muted-foreground", bar: "bg-muted-foreground" };
    case "sem_config":return { bg: "bg-muted",          text: "text-muted-foreground", dot: "bg-muted-foreground", bar: "bg-muted-foreground" };
  }
}

export function consumptionBarColor(percent: number, status: SlaStatus): string {
  if (status === "vencido") return "bg-destructive";
  if (percent >= 90) return "bg-destructive";
  if (percent >= 70) return "bg-warning";
  return "bg-success";
}

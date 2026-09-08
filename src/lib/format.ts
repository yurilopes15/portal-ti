import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const STATUS_LABELS = {
  aberto: "Aberto",
  em_atendimento: "Em Atendimento",
  aguardando_usuario: "Aguardando Usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
} as const;

export const PRIORITY_LABELS = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
} as const;

export const CATEGORY_LABELS = {
  hardware: "Hardware",
  software: "Software",
  rede: "Rede",
  impressoras: "Impressoras",
  erp: "ERP",
  email: "E-mail",
  telefonia: "Telefonia",
  outros: "Outros",
} as const;

export const ROLE_LABELS = {
  usuario: "Usuário",
  tecnico: "Técnico de TI",
  admin: "Administrador",
} as const;

export type StatusKey = keyof typeof STATUS_LABELS;
export type PriorityKey = keyof typeof PRIORITY_LABELS;
export type CategoryKey = keyof typeof CATEGORY_LABELS;
export type RoleKey = keyof typeof ROLE_LABELS;

export function formatTicketNumber(n: number | bigint): string {
  return `#${String(n).padStart(6, "0")}`;
}

export function timeAgo(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

export function formatDate(date: string | Date, fmt = "dd/MM/yyyy HH:mm") {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, fmt, { locale: ptBR });
}

export function statusColor(status: StatusKey): string {
  switch (status) {
    case "aberto": return "bg-info/15 text-info border-info/30";
    case "em_atendimento": return "bg-warning/15 text-warning-foreground border-warning/30";
    case "aguardando_usuario": return "bg-accent text-accent-foreground border-accent";
    case "resolvido": return "bg-success/15 text-success border-success/30";
    case "fechado": return "bg-muted text-muted-foreground border-border";
  }
}

export function priorityColor(p: PriorityKey): string {
  switch (p) {
    case "baixa": return "bg-muted text-muted-foreground border-border";
    case "media": return "bg-info/15 text-info border-info/30";
    case "alta": return "bg-warning/20 text-warning-foreground border-warning/40";
    case "critica": return "bg-destructive/15 text-destructive border-destructive/40";
  }
}

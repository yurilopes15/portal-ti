import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Ticket as TicketIcon, Pencil, Laptop2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";

type Resource = {
  id: string;
  name: string;
  type: "room" | "equipment";
  patrimonio: string | null;
  status: string;
};

export type ReservationRow = {
  id: string;
  resource_id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  status: "reservado" | "concluido" | "cancelado";
  linked_ticket_id: string | null;
  parent_reservation_id?: string | null;
};

const HOUR_START = 7;
const HOUR_END = 20;
const SLOT_HEIGHT = 56;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function hourLabel(h: number) { return `${pad(h)}:00`; }
function buildLocalDT(dateISO: string, time: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

type ViewMode = "dia" | "semana" | "mes";

export function ResourceCalendar({ resource }: { resource: Resource }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const [view, setView] = useState<ViewMode>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "dia" : "semana"));
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ data: string; hora_inicio: string; hora_fim: string } | null>(null);
  const [editing, setEditing] = useState<ReservationRow | null>(null);

  const range = useMemo(() => {
    if (view === "dia") { const s = new Date(cursor); s.setHours(0,0,0,0); return { start: s, end: addDays(s, 1) }; }
    if (view === "semana") { const s = startOfWeek(cursor); return { start: s, end: addDays(s, 7) }; }
    const first = startOfMonth(cursor); const gridStart = startOfWeek(first); return { start: gridStart, end: addDays(gridStart, 42) };
  }, [view, cursor]);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["reservations", resource.id, range.start.toISOString(), range.end.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("resource_id", resource.id)
        .neq("status", "cancelado")
        .gte("start_datetime", range.start.toISOString())
        .lt("start_datetime", range.end.toISOString())
        .order("start_datetime");
      if (error) throw error;
      return (data ?? []) as ReservationRow[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(reservations.map((r) => r.user_id))), [reservations]);
  const { data: profilesById = {} } = useQuery({
    queryKey: ["profiles-by-id", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").in("id", userIds);
      const map: Record<string, { id: string; nome: string }> = {};
      for (const p of data ?? []) map[p.id] = p;
      return map;
    },
  });

  const byDate = useMemo(() => {
    const g: Record<string, ReservationRow[]> = {};
    for (const r of reservations) {
      const d = new Date(r.start_datetime);
      (g[toISO(d)] ??= []).push(r);
    }
    return g;
  }, [reservations]);

  const ticketIds = useMemo(() => reservations.map((r) => r.linked_ticket_id).filter(Boolean) as string[], [reservations]);
  const { data: ticketsById = {} } = useQuery({
    queryKey: ["tickets-by-id", ticketIds],
    enabled: ticketIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("id, numero").in("id", ticketIds);
      const map: Record<string, { id: string; numero: number }> = {};
      for (const t of data ?? []) map[t.id] = t as any;
      return map;
    },
  });

  const { data: blockedRows = [] } = useQuery({
    queryKey: ["reservation_blocked_dates"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("reservation_blocked_dates").select("data, descricao");
      if (error) throw error;
      return (data ?? []) as { data: string; descricao: string | null }[];
    },
  });
  const { data: reservationSettings } = useQuery({
    queryKey: ["reservation_settings"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("reservation_settings").select("block_weekends").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as { block_weekends: boolean } | null;
    },
  });
  const blockedByDate = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of blockedRows) m[b.data] = b.descricao || "Data bloqueada";
    return m;
  }, [blockedRows]);
  const blockWeekends = !!reservationSettings?.block_weekends;
  function blockedReasonFor(d: Date): string | null {
    const iso = toISO(d);
    if (blockedByDate[iso]) return blockedByDate[iso];
    if (blockWeekends && (d.getDay() === 0 || d.getDay() === 6)) return "Final de semana";
    return null;
  }

  function openNew(p?: { data: string; hora_inicio: string; hora_fim: string }) {
    setEditing(null);
    setPrefill(p ?? null);
    setDialogOpen(true);
  }
  function openEdit(r: ReservationRow) {
    setEditing(r);
    setPrefill(null);
    setDialogOpen(true);
  }

  function shift(dir: -1 | 1) {
    if (view === "dia") setCursor((c) => addDays(c, dir));
    else if (view === "semana") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  }

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservations").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reserva cancelada"); qc.invalidateQueries({ queryKey: ["reservations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const headerLabel = useMemo(() => {
    if (view === "dia") return formatDate(toISO(cursor) + "T00:00:00", "EEEE, dd 'de' MMMM 'de' yyyy");
    if (view === "semana") {
      const s = startOfWeek(cursor); const e = addDays(s, 6);
      return `${formatDate(toISO(s) + "T00:00:00", "dd MMM")} — ${formatDate(toISO(e) + "T00:00:00", "dd MMM yyyy")}`;
    }
    return formatDate(toISO(startOfMonth(cursor)) + "T00:00:00", "MMMM 'de' yyyy");
  }, [view, cursor]);

  return (
    <div className="space-y-4">
      <Card className="p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" className="ml-auto sm:hidden" onClick={() => openNew()}><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden xs:inline">Nova</span></Button>
        </div>
        <div className="text-xs sm:text-sm font-medium capitalize sm:ml-auto flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{headerLabel}</span>
        </div>
        <Button size="sm" className="hidden sm:inline-flex" onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" />Nova Reserva</Button>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Carregando agenda...</div>
        ) : view === "mes" ? (
          <MonthGrid cursor={cursor} byDate={byDate} blockedReasonFor={blockedReasonFor} onDay={(d) => { setCursor(d); setView("dia"); }} />
        ) : view === "semana" && isMobile ? (
          <WeekMobileAgenda
            cursor={cursor}
            byDate={byDate}
            profilesById={profilesById}
            ticketsById={ticketsById}
            userId={user?.id}
            isAdmin={isAdmin}
            blockedReasonFor={blockedReasonFor}
            onSlot={openNew}
            onEdit={openEdit}
            onCancel={(id) => cancelMut.mutate(id)}
            onPickDay={(d) => { setCursor(d); setView("dia"); }}
          />
        ) : (
          <WeekOrDay
            view={view}
            cursor={cursor}
            byDate={byDate}
            profilesById={profilesById}
            ticketsById={ticketsById}
            userId={user?.id}
            isAdmin={isAdmin}
            blockedReasonFor={blockedReasonFor}
            onSlot={openNew}
            onEdit={openEdit}
            onCancel={(id) => cancelMut.mutate(id)}
          />
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ReservationDialog
          key={editing?.id ?? (prefill ? `${prefill.data}-${prefill.hora_inicio}` : "blank")}
          resource={resource}
          defaultTitle={profile?.nome ? `Reserva — ${profile.nome}` : ""}
          prefill={prefill}
          existing={editing}
          onClose={() => setDialogOpen(false)}
        />
      </Dialog>
    </div>
  );
}

// ---------- Day + Week ----------
function WeekOrDay(props: {
  view: ViewMode;
  cursor: Date;
  byDate: Record<string, ReservationRow[]>;
  profilesById: Record<string, { id: string; nome: string }>;
  ticketsById: Record<string, { id: string; numero: number }>;
  userId?: string;
  isAdmin: boolean;
  blockedReasonFor: (d: Date) => string | null;
  onSlot: (p: { data: string; hora_inicio: string; hora_fim: string }) => void;
  onEdit: (r: ReservationRow) => void;
  onCancel: (id: string) => void;
}) {
  const days = props.view === "dia" ? [props.cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(props.cursor), i));
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const minWidth = props.view === "dia" ? "min-w-full" : "min-w-[640px] sm:min-w-[760px]";
  const labelCol = props.view === "dia" ? 56 : 44;
  return (
    <div className="overflow-x-auto -mx-px">
      <div className={`grid ${minWidth}`} style={{ gridTemplateColumns: `${labelCol}px repeat(${days.length}, minmax(0,1fr))` }}>
        <div className="border-r bg-muted/20">
          <div className="h-12" />
          {hours.map((h) => (
            <div key={h} className="text-[10px] sm:text-[11px] text-muted-foreground text-right pr-1 sm:pr-2 border-t" style={{ height: SLOT_HEIGHT }}>
              {hourLabel(h)}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn key={d.toDateString()} date={d} items={props.byDate[toISO(d)] ?? []}
            profilesById={props.profilesById} ticketsById={props.ticketsById}
            userId={props.userId} isAdmin={props.isAdmin}
            blockedReason={props.blockedReasonFor(d)}
            onSlot={props.onSlot} onEdit={props.onEdit} onCancel={props.onCancel} />
        ))}
      </div>
    </div>
  );
}

function DayColumn(props: {
  date: Date;
  items: ReservationRow[];
  profilesById: Record<string, { id: string; nome: string }>;
  ticketsById: Record<string, { id: string; numero: number }>;
  userId?: string;
  isAdmin: boolean;
  blockedReason?: string | null;
  onSlot: (p: { data: string; hora_inicio: string; hora_fim: string }) => void;
  onEdit: (r: ReservationRow) => void;
  onCancel: (id: string) => void;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = hours.length * SLOT_HEIGHT;
  const isToday = sameDay(props.date, new Date());
  const dataISO = toISO(props.date);
  const blocked = props.blockedReason;

  return (
    <div className="border-l">
      <div className={`h-12 border-b px-2 flex flex-col justify-center text-center ${blocked ? "bg-destructive/10" : isToday ? "bg-primary/10" : "bg-muted/20"}`}>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{WEEKDAYS[props.date.getDay()]}</div>
        <div className={`text-sm font-semibold leading-tight ${blocked ? "text-destructive" : isToday ? "text-primary" : ""}`}>
          {pad(props.date.getDate())}/{pad(props.date.getMonth() + 1)}
        </div>
      </div>
      <div className="relative" style={{ height: totalHeight }}>
        {blocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center bg-destructive/5 border border-dashed border-destructive/40">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-destructive">Bloqueado</div>
            <div className="text-xs text-destructive/90">{blocked}</div>
          </div>
        ) : (
          hours.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => props.onSlot({ data: dataISO, hora_inicio: `${pad(h)}:00`, hora_fim: `${pad(h + 1)}:00` })}
              className="absolute left-0 right-0 border-t border-border/60 hover:bg-accent/40 transition-colors"
              style={{ top: (h - HOUR_START) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              aria-label={`Reservar ${hourLabel(h)}`}
            />
          ))
        )}
        {props.items.map((r) => {
          const start = new Date(r.start_datetime);
          const end = new Date(r.end_datetime);
          const startMin = start.getHours() * 60 + start.getMinutes();
          const endMin = end.getHours() * 60 + end.getMinutes();
          const top = ((startMin - HOUR_START * 60) / 60) * SLOT_HEIGHT;
          const height = Math.max(28, ((endMin - startMin) / 60) * SLOT_HEIGHT - 2);
          const canCancel = props.isAdmin || r.user_id === props.userId;
          const ticket = r.linked_ticket_id ? props.ticketsById[r.linked_ticket_id] : null;
          return (
            <Popover key={r.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="absolute left-1 right-1 rounded-md text-left px-2 py-1 text-[11px] overflow-hidden transition-all bg-gradient-to-br from-primary/90 to-primary text-primary-foreground hover:shadow-md hover:from-primary hover:to-primary/80 border border-primary"
                  style={{ top, height }}
                >
                  <div className="font-semibold truncate">{r.title}</div>
                  <div className="text-[10px] opacity-90 truncate">
                    {pad(start.getHours())}:{pad(start.getMinutes())}–{pad(end.getHours())}:{pad(end.getMinutes())} · {props.profilesById[r.user_id]?.nome ?? "—"}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-2">
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(r.start_datetime, "EEEE, dd/MM/yyyy")} · {pad(start.getHours())}:{pad(start.getMinutes())}–{pad(end.getHours())}:{pad(end.getMinutes())}
                  </div>
                  <div className="text-xs"><span className="font-medium">Responsável:</span> {props.profilesById[r.user_id]?.nome ?? "—"}</div>
                  {r.description && <div className="text-xs italic text-muted-foreground whitespace-pre-wrap">{r.description}</div>}
                  {ticket && (
                    <Link to="/chamados/$id" params={{ id: ticket.id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <TicketIcon className="h-3.5 w-3.5" /> Chamado #{ticket.numero}
                    </Link>
                  )}
                  {canCancel && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => props.onEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={() => props.onCancel(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Week (mobile agenda) ----------
function WeekMobileAgenda(props: {
  cursor: Date;
  byDate: Record<string, ReservationRow[]>;
  profilesById: Record<string, { id: string; nome: string }>;
  ticketsById: Record<string, { id: string; numero: number }>;
  userId?: string;
  isAdmin: boolean;
  blockedReasonFor: (d: Date) => string | null;
  onSlot: (p: { data: string; hora_inicio: string; hora_fim: string }) => void;
  onEdit: (r: ReservationRow) => void;
  onCancel: (id: string) => void;
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(props.cursor), i));
  const today = new Date();
  return (
    <div className="divide-y">
      {days.map((d) => {
        const list = (props.byDate[toISO(d)] ?? []).slice().sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
        const blocked = props.blockedReasonFor(d);
        const isToday = sameDay(d, today);
        return (
          <div key={d.toDateString()} className={`p-3 ${blocked ? "bg-destructive/5" : isToday ? "bg-primary/5" : ""}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => props.onPickDay(d)}
                className="flex items-baseline gap-2 min-w-0 text-left"
              >
                <div className={`text-[10px] uppercase tracking-wide font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{WEEKDAYS[d.getDay()]}</div>
                <div className={`text-base font-bold ${blocked ? "text-destructive" : isToday ? "text-primary" : ""}`}>
                  {pad(d.getDate())}/{pad(d.getMonth() + 1)}
                </div>
              </button>
              {!blocked && (
                <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => props.onSlot({ data: toISO(d), hora_inicio: "08:00", hora_fim: "09:00" })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Reservar
                </Button>
              )}
            </div>
            {blocked ? (
              <div className="text-xs text-destructive font-medium">🚫 {blocked}</div>
            ) : list.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Sem reservas neste dia.</div>
            ) : (
              <div className="space-y-1.5">
                {list.map((r) => {
                  const start = new Date(r.start_datetime);
                  const end = new Date(r.end_datetime);
                  const canCancel = props.isAdmin || r.user_id === props.userId;
                  const ticket = r.linked_ticket_id ? props.ticketsById[r.linked_ticket_id] : null;
                  return (
                    <Popover key={r.id}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full text-left rounded-md px-2.5 py-2 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground border border-primary"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-xs truncate">{r.title}</div>
                            <div className="text-[10px] opacity-90 shrink-0">
                              {pad(start.getHours())}:{pad(start.getMinutes())}–{pad(end.getHours())}:{pad(end.getMinutes())}
                            </div>
                          </div>
                          <div className="text-[10px] opacity-90 truncate">{props.profilesById[r.user_id]?.nome ?? "—"}</div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-2">
                          <div className="font-semibold">{r.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(r.start_datetime, "EEEE, dd/MM/yyyy")} · {pad(start.getHours())}:{pad(start.getMinutes())}–{pad(end.getHours())}:{pad(end.getMinutes())}
                          </div>
                          <div className="text-xs"><span className="font-medium">Responsável:</span> {props.profilesById[r.user_id]?.nome ?? "—"}</div>
                          {r.description && <div className="text-xs italic text-muted-foreground whitespace-pre-wrap">{r.description}</div>}
                          {ticket && (
                            <Link to="/chamados/$id" params={{ id: ticket.id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <TicketIcon className="h-3.5 w-3.5" /> Chamado #{ticket.numero}
                            </Link>
                          )}
                          {canCancel && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => props.onEdit(r)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                              </Button>
                              <Button variant="destructive" size="sm" className="flex-1" onClick={() => props.onCancel(r.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancelar
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({ cursor, byDate, blockedReasonFor, onDay }: { cursor: Date; byDate: Record<string, ReservationRow[]>; blockedReasonFor: (d: Date) => string | null; onDay: (d: Date) => void }) {
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = cursor.getMonth();
  const today = new Date();
  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = byDate[toISO(d)] ?? [];
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const blocked = blockedReasonFor(d);
          return (
            <button key={i} type="button" onClick={() => onDay(d)}
              title={blocked ? `Bloqueado: ${blocked}` : undefined}
              className={`min-h-[56px] sm:min-h-[88px] border-b border-r p-1 sm:p-1.5 text-left hover:bg-accent/40 transition-colors flex flex-col gap-1 ${blocked ? "bg-destructive/5" : inMonth ? "" : "bg-muted/20 text-muted-foreground/60"}`}>
              <div className={`text-[11px] sm:text-xs font-semibold self-end ${isToday ? "bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center" : blocked ? "text-destructive" : ""}`}>{d.getDate()}</div>
              <div className="hidden sm:flex flex-col gap-0.5">
                {blocked && (
                  <div className="text-[10px] truncate rounded px-1 py-0.5 bg-destructive/15 text-destructive border border-destructive/30 font-medium">
                    🚫 {blocked}
                  </div>
                )}
                {list.slice(0, blocked ? 2 : 3).map((r) => (
                  <div key={r.id} className="text-[10px] truncate rounded px-1 py-0.5 bg-primary/15 text-primary border border-primary/30">
                    {new Date(r.start_datetime).getHours().toString().padStart(2,"0")}:{new Date(r.start_datetime).getMinutes().toString().padStart(2,"0")} {r.title}
                  </div>
                ))}
                {list.length > (blocked ? 2 : 3) && <div className="text-[10px] text-muted-foreground">+{list.length - (blocked ? 2 : 3)}</div>}
              </div>
              <div className="sm:hidden flex items-center gap-0.5 flex-wrap mt-auto">
                {blocked && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                {list.length > 0 && (
                  <span className="text-[9px] font-medium text-primary">{list.length}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Reservation dialog (create + edit) ----------
async function createEquipmentTicket(opts: {
  userId: string;
  equipment: { name: string; patrimonio: string | null };
  dataISO: string;
  horaInicio: string;
  horaFim: string;
  description: string;
}) {
  const { equipment, userId, dataISO, horaInicio, horaFim, description } = opts;
  const desc = `Equipamento reservado através do módulo de reservas.\n\nEquipamento: ${equipment.name}${equipment.patrimonio ? ` (Pat. ${equipment.patrimonio})` : ""}\nData: ${formatDate(dataISO + "T00:00:00", "dd/MM/yyyy")}\nHorário: ${horaInicio} às ${horaFim}\n${description ? `\nObservações: ${description}` : ""}`;
  const { data: cat } = await supabase.from("ticket_categories").select("id").eq("nome", "Reserva de Equipamentos").maybeSingle();
  const { data: status } = await supabase.from("ticket_statuses").select("id").eq("is_inicial", true).limit(1).maybeSingle();
  const { data: pri } = await supabase.from("ticket_priorities").select("id").eq("nome", "Baixa").maybeSingle();
  const { data: ticket, error: tErr } = await supabase.from("tickets").insert({
    titulo: `Reserva de Equipamento - ${equipment.name}`,
    descricao: desc,
    categoria: "Reserva de Equipamentos",
    prioridade: "Baixa",
    status: "Em Aberto",
    category_id: cat?.id ?? null,
    status_id: status?.id ?? null,
    priority_id: pri?.id ?? null,
    criado_por: userId,
  } as any).select("id").single();
  if (tErr) throw tErr;
  return ticket.id as string;
}

function ReservationDialog({
  resource, prefill, existing, defaultTitle, onClose,
}: {
  resource: Resource;
  prefill: { data: string; hora_inicio: string; hora_fim: string } | null;
  existing: ReservationRow | null;
  defaultTitle: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!existing;

  const initial = useMemo(() => {
    if (existing) {
      const s = new Date(existing.start_datetime);
      const e = new Date(existing.end_datetime);
      return {
        title: existing.title,
        description: existing.description ?? "",
        data: toISO(s),
        horaInicio: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
        horaFim: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      };
    }
    const todayISO = toISO(new Date());
    return {
      title: defaultTitle || `Reserva — ${resource.name}`,
      description: "",
      data: prefill?.data ?? todayISO,
      horaInicio: prefill?.hora_inicio ?? "08:00",
      horaFim: prefill?.hora_fim ?? "09:00",
    };
  }, [existing, prefill, defaultTitle, resource.name]);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [data, setData] = useState(initial.data);
  const [horaInicio, setHoraInicio] = useState(initial.horaInicio);
  const [horaFim, setHoraFim] = useState(initial.horaFim);
  const [selectedEquip, setSelectedEquip] = useState<Set<string>>(new Set());
  const [initialEquip, setInitialEquip] = useState<Set<string>>(new Set());

  const showEquipPicker = resource.type === "room";

  // Existing equipment children (edit mode for rooms)
  const { data: children = [] } = useQuery({
    queryKey: ["reservation-children", existing?.id],
    enabled: isEdit && resource.type === "room" && !!existing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id,resource_id,linked_ticket_id,start_datetime,end_datetime,status")
        .eq("parent_reservation_id", existing!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pre-select children once loaded
  useEffect(() => {
    if (isEdit && children.length > 0) {
      const active = children.filter((c) => c.status !== "cancelado").map((c) => c.resource_id);
      setSelectedEquip(new Set(active));
      setInitialEquip(new Set(active));
    }
  }, [isEdit, children]);

  // Available equipment list
  const initialEquipIds = useMemo(() => [...initialEquip].sort().join(","), [initialEquip]);
  const { data: equipList = [] } = useQuery({
    queryKey: ["available-equipment", resource.id, data, horaInicio, horaFim, existing?.id, initialEquipIds],
    enabled: showEquipPicker,
    queryFn: async () => {
      const start = buildLocalDT(data, horaInicio);
      const end = buildLocalDT(data, horaFim);
      const { data: equips } = await supabase
        .from("reservation_resources")
        .select("id,name,patrimonio,status")
        .eq("type", "equipment")
        .order("name");
      const { data: clashes } = await supabase
        .from("reservations")
        .select("resource_id,parent_reservation_id")
        .neq("status", "cancelado")
        .lt("start_datetime", end.toISOString())
        .gt("end_datetime", start.toISOString());
      const busy = new Set(
        (clashes ?? [])
          // exclude reservations that belong to this room reservation (linked children or already-selected items)
          .filter((r) => !(existing && r.parent_reservation_id === existing.id))
          .filter((r) => !initialEquip.has(r.resource_id))
          .map((r) => r.resource_id),
      );
      return (equips ?? []).map((e) => ({ ...e, busy: busy.has(e.id) || e.status !== "disponivel" }));
    },
  });

  async function postTicketComment(ticketId: string, conteudo: string) {
    if (!user) return;
    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      autor_id: user.id,
      conteudo,
      interno: false,
    });
  }

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const start = buildLocalDT(data, horaInicio);
      const end = buildLocalDT(data, horaFim);
      if (end <= start) throw new Error("Horário final deve ser maior que o inicial");

      // ---------- EDIT ----------
      if (isEdit && existing) {
        const timesChanged =
          new Date(existing.start_datetime).getTime() !== start.getTime() ||
          new Date(existing.end_datetime).getTime() !== end.getTime();

        const { error } = await supabase
          .from("reservations")
          .update({
            title,
            description: description || null,
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;

        // Equipment diff (rooms only)
        if (resource.type === "room") {
          const added = [...selectedEquip].filter((id) => !initialEquip.has(id));
          const removed = [...initialEquip].filter((id) => !selectedEquip.has(id));
          const kept = [...selectedEquip].filter((id) => initialEquip.has(id));

          // Removed → cancel reservation + comment ticket
          for (const eqId of removed) {
            const child = children.find((c) => c.resource_id === eqId && c.status !== "cancelado");
            if (!child) continue;
            await supabase.from("reservations").update({ status: "cancelado" }).eq("id", child.id);
            if (child.linked_ticket_id) {
              await postTicketComment(
                child.linked_ticket_id,
                `Equipamento removido da reserva da sala "${resource.name}". Reserva cancelada.`,
              );
            }
          }

          // Kept → update times + comment if changed
          if (timesChanged) {
            for (const eqId of kept) {
              const child = children.find((c) => c.resource_id === eqId && c.status !== "cancelado");
              if (!child) continue;
              await supabase
                .from("reservations")
                .update({ start_datetime: start.toISOString(), end_datetime: end.toISOString() })
                .eq("id", child.id);
              if (child.linked_ticket_id) {
                await postTicketComment(
                  child.linked_ticket_id,
                  `Horário da reserva atualizado.\nNovo horário: ${formatDate(data + "T00:00:00", "dd/MM/yyyy")} das ${horaInicio} às ${horaFim}.`,
                );
              }
            }
          }

          // Find an existing ticket to reuse (original chamado of this room reservation)
          const existingTicketId =
            existing.linked_ticket_id ??
            children.find((c) => c.linked_ticket_id)?.linked_ticket_id ??
            null;

          // Added → reuse existing ticket if any (just comment); otherwise create a new one
          for (const eqId of added) {
            const eq = equipList.find((e) => e.id === eqId);
            if (!eq) continue;
            let ticketId: string;
            if (existingTicketId) {
              ticketId = existingTicketId;
              await postTicketComment(
                ticketId,
                `Equipamento adicionado à reserva da sala "${resource.name}": ${eq.name}${eq.patrimonio ? ` (Pat. ${eq.patrimonio})` : ""}.\nData: ${formatDate(data + "T00:00:00", "dd/MM/yyyy")} das ${horaInicio} às ${horaFim}.`,
              );
            } else {
              ticketId = await createEquipmentTicket({
                userId: user.id,
                equipment: { name: eq.name, patrimonio: eq.patrimonio },
                dataISO: data, horaInicio, horaFim,
                description: `Adicionado à reserva existente da sala "${resource.name}".`,
              });
            }
            await supabase.from("reservations").insert({
              resource_id: eq.id,
              user_id: user.id,
              title: `${title} — ${eq.name}`,
              description: `Vinculada à reserva da sala "${resource.name}".`,
              start_datetime: start.toISOString(),
              end_datetime: end.toISOString(),
              status: "reservado",
              linked_ticket_id: ticketId,
              parent_reservation_id: existing.id,
            });
          }
        }
        return;
      }

      // ---------- CREATE ----------
      let linkedTicketId: string | null = null;
      if (resource.type === "equipment") {
        linkedTicketId = await createEquipmentTicket({
          userId: user.id,
          equipment: { name: resource.name, patrimonio: resource.patrimonio },
          dataISO: data, horaInicio, horaFim, description,
        });
      }

      const { data: roomRes, error } = await supabase.from("reservations").insert({
        resource_id: resource.id,
        user_id: user.id,
        title,
        description: description || null,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: "reservado",
        linked_ticket_id: linkedTicketId,
      }).select("id").single();
      if (error) {
        if (linkedTicketId) await supabase.from("tickets").delete().eq("id", linkedTicketId);
        throw error;
      }

      // Equipment add-on (rooms only)
      if (resource.type === "room" && selectedEquip.size > 0) {
        const picked = equipList.filter((e) => selectedEquip.has(e.id));
        const createdTickets: string[] = [];
        const createdReservations: string[] = [];
        try {
          for (const eq of picked) {
            const ticketId = await createEquipmentTicket({
              userId: user.id,
              equipment: { name: eq.name, patrimonio: eq.patrimonio },
              dataISO: data, horaInicio, horaFim,
              description: `Vinculada à reserva de sala "${resource.name}".${description ? `\n${description}` : ""}`,
            });
            createdTickets.push(ticketId);
            const { data: er, error: eErr } = await supabase.from("reservations").insert({
              resource_id: eq.id,
              user_id: user.id,
              title: `${title} — ${eq.name}`,
              description: `Vinculada à reserva da sala "${resource.name}".`,
              start_datetime: start.toISOString(),
              end_datetime: end.toISOString(),
              status: "reservado",
              linked_ticket_id: ticketId,
              parent_reservation_id: roomRes.id,
            }).select("id").single();
            if (eErr) throw eErr;
            createdReservations.push(er.id);
          }
        } catch (err: any) {
          for (const id of createdReservations) await supabase.from("reservations").delete().eq("id", id);
          for (const id of createdTickets) await supabase.from("tickets").delete().eq("id", id);
          await supabase.from("reservations").delete().eq("id", roomRes.id);
          throw new Error(`Reserva da sala foi revertida. Falha ao reservar equipamento: ${err.message}`);
        }
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Reserva atualizada" : "Reserva criada");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["resource-counts"] });
      qc.invalidateQueries({ queryKey: ["reservation-children"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar Reserva" : "Nova Reserva"} — {resource.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Início</Label>
            <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        {showEquipPicker && (
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Laptop2 className="h-4 w-4 text-primary" />
              Reservar equipamentos para esta sala
            </div>
            <p className="text-[11px] text-muted-foreground">
              Selecione equipamentos que devem ser reservados no mesmo horário. Cada equipamento marcado abre um chamado automaticamente.
            </p>
            {equipList.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum equipamento cadastrado.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {equipList.map((eq) => {
                  const checked = selectedEquip.has(eq.id);
                  return (
                    <label
                      key={eq.id}
                      className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 border ${
                        eq.busy ? "opacity-50 cursor-not-allowed bg-muted" : "cursor-pointer hover:bg-accent/40"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={eq.busy}
                        onCheckedChange={(v) => {
                          setSelectedEquip((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(eq.id); else next.delete(eq.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 truncate">{eq.name}</span>
                      {eq.patrimonio && <span className="text-[10px] text-muted-foreground">Pat. {eq.patrimonio}</span>}
                      {eq.busy && <Badge variant="outline" className="text-[9px]">indisponível</Badge>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!isEdit && resource.type === "equipment" && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
            Um chamado será aberto automaticamente para esta reserva de equipamento.
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || !title.trim()}>
          {submitMut.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Confirmar reserva"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

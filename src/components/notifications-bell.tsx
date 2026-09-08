import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  disablePush,
  enablePush,
  getExistingSubscription,
  isPushSupported,
  pushPermission,
} from "@/lib/push";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { timeAgo } from "@/lib/format";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unread = items.filter((n) => !n.lida).length;

  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const supported = isPushSupported();

  const refreshPush = useCallback(async () => {
    if (!isPushSupported()) return;
    const sub = await getExistingSubscription();
    setPushOn(!!sub && pushPermission() === "granted");
  }, []);

  useEffect(() => {
    void refreshPush();
  }, [refreshPush, user]);

  async function togglePush() {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Notificações push desativadas neste navegador.");
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPushOn(true);
          toast.success("Notificações push ativadas neste navegador.");
        } else {
          toast.error(res.reason ?? "Não foi possível ativar as notificações.");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao configurar notificações.");
    } finally {
      setPushBusy(false);
    }
  }

  async function markAll() {
    await supabase.from("notifications").update({ lida: true }).eq("lida", false);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-destructive text-destructive-foreground">{unread}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-primary hover:underline">Marcar todas como lidas</button>
          )}
        </div>
        {supported && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
            <div className="flex items-center gap-2 min-w-0">
              {pushOn ? <BellRing className="h-4 w-4 text-primary shrink-0" /> : <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="text-xs text-muted-foreground truncate">
                {pushOn ? "Push ativo neste navegador" : "Receba avisos mesmo fora do sistema"}
              </span>
            </div>
            <Button size="sm" variant={pushOn ? "outline" : "default"} className="h-7 text-xs shrink-0" disabled={pushBusy} onClick={togglePush}>
              {pushBusy ? "..." : pushOn ? "Desativar" : "Ativar"}
            </Button>
          </div>
        )}
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={!n.lida ? "bg-accent/40" : ""}>
                  <Link
                    to={n.ticket_id ? "/chamados/$id" : "/"}
                    params={n.ticket_id ? { id: n.ticket_id } : undefined as never}
                    onClick={() => setOpen(false)}
                    className="block p-3 hover:bg-accent transition-colors"
                  >
                    <div className="text-sm font-medium leading-tight">{n.titulo}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{n.mensagem}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

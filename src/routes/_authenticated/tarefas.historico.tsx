import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTaskBoard, applyScope } from "@/hooks/use-task-board";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorBadge } from "@/components/ticket-badges";
import { PRIORITIES, cardTextColor } from "@/components/tarefas/tarefas-board";
import { ArrowLeft, Search, RotateCcw, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tarefas/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de Tarefas | Portal TI Slotter" },
      {
        name: "description",
        content:
          "Consulte as tarefas finalizadas pela equipe de TI, com responsável, prioridade e data de conclusão.",
      },
      { property: "og:title", content: "Histórico de Tarefas | Portal TI Slotter" },
      {
        property: "og:description",
        content: "Consulte as tarefas já finalizadas pela equipe de TI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoricoPage,
});

const ALL = "__all__";
const NONE = "__none__";

type FinishedTask = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  column_id: string;
  assignee_id: string | null;
  finished_at: string;
  finished_by: string | null;
  created_at: string;
  color: string | null;
};

function priority(value: string) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0];
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function HistoricoPage() {
  const { isLoading, scope, options: boardOptions, kind: boardKind, setKind: setBoardKind, department } =
    useTaskBoard();
  const scopeKey = scope.key;
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [fResp, setFResp] = useState(ALL);
  const [fPrio, setFPrio] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["tasks-finished", scopeKey],
    queryFn: async (): Promise<FinishedTask[]> => {
      const query = applyScope(
        supabase
          .from("tasks")
          .select(
            "id, titulo, descricao, prioridade, column_id, assignee_id, finished_at, finished_by, created_at, color",
          )
          .not("finished_at", "is", null),
        scope,
      );
      const { data, error } = await query.order("finished_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinishedTask[];
    },
  });

  const columnsQuery = useQuery({
    queryKey: ["task-columns", scopeKey],
    queryFn: async () => {
      const query = applyScope(
        supabase.from("task_columns").select("id, nome, ordem, is_final"),
        scope,
      );
      const { data } = await query;
      return data ?? [];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["board-members", scopeKey],
    queryFn: async () => {
      if (scope.kind === "meu") {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("id", scope.owner_id ?? "");
        return (data ?? []) as { id: string; nome: string }[];
      }
      if (scope.kind === "departamento") {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("departamento", department?.nome ?? "")
          .order("nome", { ascending: true });
        return (data ?? []) as { id: string; nome: string }[];
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["tecnico", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [] as { id: string; nome: string }[];
      const { data } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids)
        .order("nome", { ascending: true });
      return (data ?? []) as { id: string; nome: string }[];
    },
  });


  const tasks = tasksQuery.data ?? [];
  const columns = columnsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const memberName = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.nome ?? "—") : "Sem responsável";
  const columnName = (id: string) => columns.find((c) => c.id === id)?.nome ?? "—";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (term && !t.titulo.toLowerCase().includes(term)) return false;
      if (fResp !== ALL) {
        if (fResp === NONE ? !!t.assignee_id : t.assignee_id !== fResp) return false;
      }
      if (fPrio !== ALL && t.prioridade !== fPrio) return false;
      if (from && new Date(t.finished_at) < new Date(`${from}T00:00:00`)) return false;
      if (to && new Date(t.finished_at) > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [tasks, q, fResp, fPrio, from, to]);

  async function reopen(task: FinishedTask) {
    const { error } = await supabase
      .from("tasks")
      .update({ finished_at: null, finished_by: null })
      .eq("id", task.id);
    if (error) return toast.error("Erro ao reabrir a tarefa.");
    toast.success("Tarefa reaberta no quadro.");
    qc.invalidateQueries({ queryKey: ["tasks-finished"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Histórico de Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {boardKind === "ti"
              ? "Tarefas finalizadas pela equipe de TI."
              : boardKind === "departamento"
                ? `Tarefas finalizadas do departamento ${department?.nome ?? ""}.`
                : "Suas tarefas finalizadas."}
          </p>
          <Select value={boardKind} onValueChange={(v) => setBoardKind(v as typeof boardKind)}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boardOptions.map((o) => (
                <SelectItem key={o.kind} value={o.kind}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/tarefas">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao quadro
          </Link>
        </Button>
      </div>

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título..."
              className="pl-8"
            />
          </div>
          <Select value={fResp} onValueChange={setFResp}>
            <SelectTrigger>
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
              <SelectItem value={NONE}>Sem responsável</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fPrio} onValueChange={setFPrio}>
            <SelectTrigger>
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as prioridades</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {tasksQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa finalizada encontrada.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const p = priority(t.prioridade);
            return (
              <Card
                key={t.id}
                className="p-3 sm:p-4"
                style={
                  t.color
                    ? {
                        backgroundColor: t.color,
                        borderColor: t.color,
                        color: cardTextColor(t.color),
                      }
                    : undefined
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{t.titulo}</p>
                      <ColorBadge name={p.label} color={p.color} />
                      <ColorBadge name={columnName(t.column_id)} color="#3AA85B" />
                    </div>
                    {t.descricao && (
                      <p
                        className={`text-xs whitespace-pre-wrap line-clamp-3 ${t.color ? "opacity-80" : "text-muted-foreground"}`}
                      >
                        {t.descricao}
                      </p>
                    )}
                    <div
                      className={`text-[11px] flex flex-wrap gap-x-4 gap-y-1 ${t.color ? "opacity-80" : "text-muted-foreground"}`}
                    >
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {memberName(t.assignee_id)}
                      </span>
                      <span>Finalizada em {formatDateTime(t.finished_at)}</span>
                      <span>Por {memberName(t.finished_by)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void reopen(t)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reabrir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

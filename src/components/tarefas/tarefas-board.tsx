import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTaskBoard, applyScope } from "@/hooks/use-task-board";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ColorBadge } from "@/components/ticket-badges";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  User as UserIcon,
  CalendarDays,
  CheckCircle2,
  History,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

export type TaskColumn = { id: string; nome: string; ordem: number; is_final: boolean };
export type Task = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  column_id: string;
  assignee_id: string | null;
  position: number;
  created_at: string;
  finished_at?: string | null;
  finished_by?: string | null;
  color?: string | null;
};
type Member = { id: string; nome: string };

const ALL = "__all__";
const NONE = "__none__";

export const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "#64748b" },
  { value: "media", label: "Média", color: "#2563eb" },
  { value: "alta", label: "Alta", color: "#f59e0b" },
  { value: "urgente", label: "Urgente", color: "#ef4444" },
];

function priority(value: string) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0];
}

export const TASK_COLORS = [
  { value: "#3AA85B", label: "Verde" },
  { value: "#2563eb", label: "Azul" },
  { value: "#f59e0b", label: "Âmbar" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#8b5cf6", label: "Roxo" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#0ea5e9", label: "Ciano" },
  { value: "#64748b", label: "Cinza" },
];

// Retorna cor de texto legível (clara ou escura) conforme a luminosidade do fundo
export function cardTextColor(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#1f2937" : "#ffffff";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function TarefasBoard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { scope, options: boardOptions, kind: boardKind, setKind: setBoardKind, department } =
    useTaskBoard();
  const scopeKey = scope.key;

  const [q, setQ] = useState("");
  const [fResp, setFResp] = useState<string>(ALL);
  const [fPrio, setFPrio] = useState<string>(ALL);

  const [taskDialog, setTaskDialog] = useState<{ mode: "new" | "edit"; task?: Task } | null>(null);
  const [finishTarget, setFinishTarget] = useState<Task | null>(null);
  const [columnDialog, setColumnDialog] = useState<{ mode: "new" | "rename"; column?: TaskColumn } | null>(null);
  const [deleteColumn, setDeleteColumn] = useState<TaskColumn | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const columnsQuery = useQuery({
    queryKey: ["task-columns", scopeKey],
    queryFn: async (): Promise<TaskColumn[]> => {
      const query = applyScope(
        supabase.from("task_columns").select("id, nome, ordem, is_final"),
        scope,
      );
      const { data, error } = await query.order("ordem", { ascending: true });
      if (error) throw error;

      // Quadro pessoal/departamental recém-criado: gera as colunas padrão
      if ((data ?? []).length === 0 && scope.kind !== "ti") {
        const base = { owner_id: scope.owner_id, department_id: scope.department_id };
        const defaults = [
          { nome: "A Fazer", ordem: 0, is_final: false, ...base },
          { nome: "Em andamento", ordem: 1, is_final: false, ...base },
          { nome: "Concluído", ordem: 2, is_final: true, ...base },
        ];
        const { data: created } = await supabase
          .from("task_columns")
          .insert(defaults)
          .select("id, nome, ordem, is_final");
        return (created ?? []).sort((a, b) => a.ordem - b.ordem);
      }
      return data ?? [];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", scopeKey],
    queryFn: async (): Promise<Task[]> => {
      const query = applyScope(
        supabase
          .from("tasks")
          .select("id, titulo, descricao, prioridade, column_id, assignee_id, position, created_at, color")
          .is("finished_at", null),
        scope,
      );
      const { data, error } = await query
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["board-members", scopeKey],
    queryFn: async (): Promise<Member[]> => {
      if (scope.kind === "meu") {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("id", scope.owner_id ?? "");
        return (data ?? []) as Member[];
      }
      if (scope.kind === "departamento") {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("departamento", department?.nome ?? "")
          .eq("ativo", true)
          .order("nome", { ascending: true });
        return (data ?? []) as Member[];
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["tecnico", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids)
        .order("nome", { ascending: true });
      return (data ?? []) as Member[];
    },
  });


  const columns = columnsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const memberName = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.nome ?? "—") : "Sem responsável";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (term && !t.titulo.toLowerCase().includes(term)) return false;
      if (fResp !== ALL) {
        if (fResp === NONE ? !!t.assignee_id : t.assignee_id !== fResp) return false;
      }
      if (fPrio !== ALL && t.prioridade !== fPrio) return false;
      return true;
    });
  }, [tasks, q, fResp, fPrio]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task-columns"] });
    qc.invalidateQueries({ queryKey: ["tasks-finished"] });
  }

  function columnTasksSorted(columnId: string) {
    return tasks
      .filter((t) => t.column_id === columnId)
      .slice()
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }

  async function reorderTask(taskId: string, columnId: string, targetIndex: number) {
    const moving = tasks.find((t) => t.id === taskId);
    if (!moving) return;
    const list = columnTasksSorted(columnId).filter((t) => t.id !== taskId);
    const idx = Math.max(0, Math.min(targetIndex, list.length));
    list.splice(idx, 0, { ...moving, column_id: columnId });

    const updates = list.map((t, i) => ({ id: t.id, position: i, column_id: columnId }));
    qc.setQueryData<Task[]>(["tasks", scopeKey], (old) =>
      (old ?? []).map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u ? { ...t, position: u.position, column_id: u.column_id } : t;
      }),
    );

    const results = await Promise.all(
      updates.map((u) =>
        supabase.from("tasks").update({ position: u.position, column_id: u.column_id }).eq("id", u.id),
      ),
    );
    if (results.some((r) => r.error)) toast.error("Não foi possível reordenar as tarefas.");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function moveTask(taskId: string, columnId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.column_id === columnId) return;
    await reorderTask(taskId, columnId, columnTasksSorted(columnId).length);
  }

  async function nudgeTask(task: Task, dir: -1 | 1) {
    const list = columnTasksSorted(task.column_id);
    const i = list.findIndex((t) => t.id === task.id);
    const target = i + dir;
    if (i < 0 || target < 0 || target >= list.length) return;
    await reorderTask(task.id, task.column_id, target);
  }


  async function saveColumn(nome: string, isFinal: boolean) {
    if (!columnDialog) return;
    if (!nome.trim()) return toast.error("Informe o nome da coluna.");
    if (columnDialog.mode === "new") {
      const ordem = columns.length ? Math.max(...columns.map((c) => c.ordem)) + 1 : 0;
      const { error } = await supabase
        .from("task_columns")
        .insert({ nome: nome.trim(), ordem, is_final: isFinal, owner_id: scope.owner_id, department_id: scope.department_id });
      if (error) return toast.error("Erro ao criar coluna.");
      toast.success("Coluna criada.");
    } else {
      const { error } = await supabase
        .from("task_columns")
        .update({ nome: nome.trim(), is_final: isFinal })
        .eq("id", columnDialog.column!.id);
      if (error) return toast.error("Erro ao renomear coluna.");
      toast.success("Coluna atualizada.");
    }
    setColumnDialog(null);
    refresh();
  }

  async function finishTask(task: Task) {
    const { error } = await supabase
      .from("tasks")
      .update({ finished_at: new Date().toISOString(), finished_by: user?.id ?? null })
      .eq("id", task.id);
    if (error) return toast.error("Erro ao finalizar a tarefa.");
    toast.success("Tarefa finalizada e enviada para o histórico.");
    setFinishTarget(null);
    setTaskDialog(null);
    refresh();
  }

  async function moveColumn(col: TaskColumn, dir: -1 | 1) {
    const idx = columns.findIndex((c) => c.id === col.id);
    const target = columns[idx + dir];
    if (!target) return;
    await supabase.from("task_columns").update({ ordem: target.ordem }).eq("id", col.id);
    await supabase.from("task_columns").update({ ordem: col.ordem }).eq("id", target.id);
    refresh();
  }

  async function confirmDeleteColumn(destinationId: string | null) {
    if (!deleteColumn) return;
    const count = tasks.filter((t) => t.column_id === deleteColumn.id).length;
    if (count > 0) {
      if (!destinationId) return toast.error("Escolha a coluna de destino das tarefas.");
      const { error } = await supabase
        .from("tasks")
        .update({ column_id: destinationId })
        .eq("column_id", deleteColumn.id);
      if (error) return toast.error("Erro ao mover as tarefas.");
    }
    const { error } = await supabase.from("task_columns").delete().eq("id", deleteColumn.id);
    if (error) return toast.error("Erro ao excluir coluna.");
    toast.success("Coluna excluída.");
    setDeleteColumn(null);
    refresh();
  }

  async function saveTask(values: {
    titulo: string;
    descricao: string;
    assignee_id: string | null;
    prioridade: string;
    column_id: string;
    color: string | null;
  }) {
    if (!taskDialog) return;
    if (!values.titulo.trim()) return toast.error("Informe o título da tarefa.");
    if (taskDialog.mode === "new") {
      const { error } = await supabase.from("tasks").insert({
        titulo: values.titulo.trim(),
        descricao: values.descricao || null,
        assignee_id: values.assignee_id,
        prioridade: values.prioridade,
        column_id: values.column_id,
        color: values.color,
        owner_id: scope.owner_id,
        department_id: scope.department_id,
        created_by: user?.id ?? null,
        position: tasks.length ? Math.max(...tasks.map((t) => t.position)) + 1 : 0,
      });
      if (error) return toast.error("Erro ao criar tarefa.");
      toast.success("Tarefa criada.");
    } else {
      const { error } = await supabase
        .from("tasks")
        .update({
          titulo: values.titulo.trim(),
          descricao: values.descricao || null,
          assignee_id: values.assignee_id,
          prioridade: values.prioridade,
          column_id: values.column_id,
          color: values.color,
        })
        .eq("id", taskDialog.task!.id);
      if (error) return toast.error("Erro ao salvar tarefa.");
      toast.success("Tarefa atualizada.");
    }
    setTaskDialog(null);
    refresh();
  }

  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir tarefa.");
    toast.success("Tarefa excluída.");
    setTaskDialog(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100dvh-5rem)] sm:h-[calc(100dvh-6.5rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {boardKind === "ti"
              ? "Quadro compartilhado da equipe de TI."
              : boardKind === "departamento"
                ? `Quadro compartilhado do departamento ${department?.nome ?? ""}.`
                : "Seu quadro pessoal, visível somente para você."}
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
        <div className="flex gap-2">

          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link to="/tarefas/historico">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setColumnDialog({ mode: "new" })}
            className="flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Coluna
          </Button>
          <Button
            onClick={() => setTaskDialog({ mode: "new" })}
            disabled={columns.length === 0}
            className="flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      <Card className="p-3 shrink-0">
        <div className="grid gap-2 sm:grid-cols-3">
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
        </div>
      </Card>

      <div className="flex-1 min-h-0 overflow-x-auto pb-3">
        <div className="flex gap-3 items-stretch h-full w-full">
          {columns.map((col, idx) => {
            const colTasks = filtered.filter((t) => t.column_id === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.id);
                }}
                onDragLeave={() => setDragOverColumn((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  if (dragTaskId) void moveTask(dragTaskId, col.id);
                  setDragTaskId(null);
                }}
                className={`flex-1 basis-0 min-w-[260px] rounded-lg border bg-muted/30 p-2 transition-colors flex flex-col max-h-full ${
                  dragOverColumn === col.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <span className="text-sm font-medium truncate">{col.nome}</span>
                  <span className="text-[11px] rounded bg-background border border-border px-1.5 py-0.5 text-muted-foreground">
                    {colTasks.length}
                  </span>
                  <div className="ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setColumnDialog({ mode: "rename", column: col })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Renomear coluna
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={idx === 0} onClick={() => void moveColumn(col, -1)}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Mover para esquerda
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={idx === columns.length - 1}
                          onClick={() => void moveColumn(col, 1)}
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Mover para direita
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteColumn(col)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir coluna
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2 min-h-[80px] flex-1 overflow-y-auto">
                  {colTasks.map((t) => {
                    const p = priority(t.prioridade);
                    const textColor = t.color ? cardTextColor(t.color) : undefined;
                    const fullList = columnTasksSorted(col.id);
                    const fullIdx = fullList.findIndex((x) => x.id === t.id);
                    return (
                      <Card
                        key={t.id}
                        draggable
                        onDragStart={() => setDragTaskId(t.id)}
                        onDragEnd={() => setDragTaskId(null)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverColumn(null);
                          if (dragTaskId && dragTaskId !== t.id) {
                            void reorderTask(dragTaskId, col.id, Math.max(0, fullIdx));
                          }
                          setDragTaskId(null);
                        }}
                        onClick={() => setTaskDialog({ mode: "edit", task: t })}
                        style={
                          t.color
                            ? { backgroundColor: t.color, borderColor: t.color, color: textColor }
                            : undefined
                        }
                        className={`p-3 cursor-pointer hover:shadow-sm transition-shadow space-y-2 ${
                          dragTaskId === t.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-medium leading-snug flex-1">{t.titulo}</p>
                          <div className="flex flex-col -my-1 -mr-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-black/10"
                              style={textColor ? { color: textColor } : undefined}
                              disabled={fullIdx <= 0}
                              title="Mover para cima"
                              onClick={(e) => {
                                e.stopPropagation();
                                void nudgeTask(t, -1);
                              }}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-black/10"
                              style={textColor ? { color: textColor } : undefined}
                              disabled={fullIdx === fullList.length - 1}
                              title="Mover para baixo"
                              onClick={(e) => {
                                e.stopPropagation();
                                void nudgeTask(t, 1);
                              }}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <ColorBadge
                          name={p.label}
                          color={p.color}
                          style={
                            t.color
                              ? {
                                  color: textColor,
                                  borderColor: textColor,
                                  backgroundColor: `${textColor}33`,
                                }
                              : undefined
                          }
                        />
                        <div
                          className={`text-[11px] space-y-1 rounded-md px-2 py-1.5 ${
                            t.color
                              ? "bg-black/15 font-medium"
                              : "bg-muted font-medium text-foreground/90"
                          }`}
                          style={t.color ? { color: textColor } : undefined}
                        >
                          <div className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{memberName(t.assignee_id)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            <span>Criado em {formatDate(t.created_at)}</span>
                          </div>
                        </div>
                        {col.is_final && (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFinishTarget(t);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Finalizar tarefa
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">
                      Nenhuma tarefa
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {taskDialog && (
        <TaskDialog
          key={taskDialog.task?.id ?? "new"}
          mode={taskDialog.mode}
          task={taskDialog.task}
          columns={columns}
          members={members}
          onClose={() => setTaskDialog(null)}
          onSave={saveTask}
          onDelete={removeTask}
        />
      )}

      {columnDialog && (
        <ColumnDialog
          mode={columnDialog.mode}
          initial={columnDialog.column?.nome ?? ""}
          initialFinal={columnDialog.column?.is_final ?? false}
          onClose={() => setColumnDialog(null)}
          onSave={saveColumn}
        />
      )}

      {finishTarget && (
        <Dialog open onOpenChange={(o) => !o && setFinishTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Finalizar tarefa</DialogTitle>
              <DialogDescription>
                A tarefa "{finishTarget.titulo}" sairá do quadro e ficará disponível na tela de
                Histórico.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFinishTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void finishTask(finishTarget)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteColumn && (
        <DeleteColumnDialog
          column={deleteColumn}
          count={tasks.filter((t) => t.column_id === deleteColumn.id).length}
          options={columns.filter((c) => c.id !== deleteColumn.id)}
          onClose={() => setDeleteColumn(null)}
          onConfirm={confirmDeleteColumn}
        />
      )}
    </div>
  );
}

function TaskDialog({
  mode,
  task,
  columns,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  mode: "new" | "edit";
  task?: Task;
  columns: TaskColumn[];
  members: Member[];
  onClose: () => void;
  onSave: (v: {
    titulo: string;
    descricao: string;
    assignee_id: string | null;
    prioridade: string;
    column_id: string;
    color: string | null;
  }) => unknown;
  onDelete: (id: string) => unknown;
}) {
  const [titulo, setTitulo] = useState(task?.titulo ?? "");
  const [descricao, setDescricao] = useState(task?.descricao ?? "");
  const [assignee, setAssignee] = useState(task?.assignee_id ?? NONE);
  const [prio, setPrio] = useState(task?.prioridade ?? "media");
  const [columnId, setColumnId] = useState(task?.column_id ?? columns[0]?.id ?? "");
  const [color, setColor] = useState<string | null>(task?.color ?? null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({
      titulo,
      descricao,
      assignee_id: assignee === NONE ? null : assignee,
      prioridade: prio,
      column_id: columnId,
      color,
    });
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "Nova Tarefa" : "Detalhes da Tarefa"}</DialogTitle>
          {task && (
            <DialogDescription>Criada em {formatDate(task.created_at)}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Verificar falha no acesso ao sistema de produção"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={7}
              placeholder="Detalhe o problema, atividade ou solicitação..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prio} onValueChange={setPrio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cor do card</Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                title="Padrão (sem cor)"
                className={`h-8 w-8 rounded-full border bg-card flex items-center justify-center text-[10px] transition-transform ${
                  color === null ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
              >
                —
              </button>
              {TASK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`h-8 w-8 rounded-full border border-black/10 transition-transform hover:scale-110 ${
                    color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          {mode === "edit" && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {mode === "edit" && task ? (
            <Button variant="outline" onClick={() => void onDelete(task.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {mode === "new" ? "Criar tarefa" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnDialog({
  mode,
  initial,
  initialFinal,
  onClose,
  onSave,
}: {
  mode: "new" | "rename";
  initial: string;
  initialFinal: boolean;
  onClose: () => void;
  onSave: (nome: string, isFinal: boolean) => unknown;
}) {
  const [nome, setNome] = useState(initial);
  const [isFinal, setIsFinal] = useState(initialFinal);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "Nova Coluna" : "Editar Coluna"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome da coluna</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Em Homologação"
              autoFocus
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={isFinal} onCheckedChange={(v) => setIsFinal(v === true)} />
            <span className="text-sm leading-snug">
              Coluna de conclusão
              <span className="block text-xs text-muted-foreground">
                Tarefas nesta coluna exibem o botão "Finalizar tarefa".
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void onSave(nome, isFinal)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteColumnDialog({
  column,
  count,
  options,
  onClose,
  onConfirm,
}: {
  column: TaskColumn;
  count: number;
  options: TaskColumn[];
  onClose: () => void;
  onConfirm: (destinationId: string | null) => unknown;
}) {
  const [dest, setDest] = useState(options[0]?.id ?? "");
  const blocked = count > 0 && options.length === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir coluna</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `A coluna "${column.nome}" possui ${count} tarefa(s). Escolha para onde elas serão movidas.`
              : `Confirma a exclusão da coluna "${column.nome}"?`}
          </DialogDescription>
        </DialogHeader>
        {count > 0 && !blocked && (
          <div className="space-y-1.5">
            <Label>Mover tarefas para</Label>
            <Select value={dest} onValueChange={setDest}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {blocked && (
          <p className="text-sm text-destructive">
            Crie outra coluna antes de excluir esta, para não perder as tarefas.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={blocked}
            onClick={() => void onConfirm(count > 0 ? dest : null)}
          >
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { TarefasBoard } from "@/components/tarefas/tarefas-board";

export const Route = createFileRoute("/_authenticated/tarefas/")({
  head: () => ({
    meta: [
      { title: "Tarefas | Portal TI Slotter" },
      {
        name: "description",
        content:
          "Quadro Kanban interno da equipe de TI para organizar e acompanhar as atividades do dia a dia.",
      },
      { property: "og:title", content: "Tarefas | Portal TI Slotter" },
      {
        property: "og:description",
        content: "Organize e acompanhe as atividades internas da equipe de TI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

function TarefasPage() {
  const { canUseTarefas, isLoading } = usePermissions();

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  if (!canUseTarefas) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar o módulo de Tarefas.
        </p>
      </Card>
    );
  }

  return <TarefasBoard />;
}

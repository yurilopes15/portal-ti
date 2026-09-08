import { createFileRoute } from "@tanstack/react-router";
import { ResourceCardGrid } from "@/components/reservas/resource-card-grid";

export const Route = createFileRoute("/_authenticated/reservas/equipamentos/")({
  component: () => <ResourceCardGrid type="equipment" title="Equipamentos" subtitle="Selecione um equipamento para visualizar a agenda." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { ResourceCardGrid } from "@/components/reservas/resource-card-grid";

export const Route = createFileRoute("/_authenticated/reservas/salas/")({
  component: () => <ResourceCardGrid type="room" title="Salas" subtitle="Selecione uma sala para visualizar a agenda." />,
});

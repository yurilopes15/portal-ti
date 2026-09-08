import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResourceCalendar } from "@/components/reservas/resource-calendar";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reservas/salas/$id")({
  component: SalaCalendarPage,
});

function SalaCalendarPage() {
  const { id } = useParams({ from: "/_authenticated/reservas/salas/$id" });
  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reservation_resources").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!resource) return <Card className="p-8 text-center">Sala não encontrada.</Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" asChild><Link to="/reservas/salas"><ChevronLeft className="h-4 w-4 mr-1" />Salas</Link></Button>
        <span>/</span>
        <span className="font-medium text-foreground">{resource.name}</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{resource.name}</h1>
        <p className="text-sm text-muted-foreground">Agenda da sala. Clique em um horário para reservar.</p>
      </div>
      <ResourceCalendar resource={resource as any} />
    </div>
  );
}

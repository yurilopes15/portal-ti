import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TicketCategory = { id: string; nome: string; cor: string; ordem: number; ativo: boolean };
export type TicketPriority = { id: string; nome: string; cor: string; ordem: number; ativo: boolean };
export type TicketStatus = {
  id: string; nome: string; cor: string; ordem: number; ativo: boolean;
  is_inicial: boolean; is_resolvido: boolean; is_fechado: boolean;
};

function useLookup<T>(table: string) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table).select("*").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as T[];
    },
    staleTime: 60_000,
  });
}

export function useTicketCategories() { return useLookup<TicketCategory>("ticket_categories"); }
export function useTicketPriorities() { return useLookup<TicketPriority>("ticket_priorities"); }
export function useTicketStatuses()   { return useLookup<TicketStatus>("ticket_statuses"); }

export function useTicketLookups() {
  const categories = useTicketCategories();
  const priorities = useTicketPriorities();
  const statuses = useTicketStatuses();
  return {
    categories: categories.data ?? [],
    priorities: priorities.data ?? [],
    statuses: statuses.data ?? [],
    activeCategories: (categories.data ?? []).filter((c) => c.ativo),
    activePriorities: (priorities.data ?? []).filter((p) => p.ativo),
    activeStatuses: (statuses.data ?? []).filter((s) => s.ativo),
    isLoading: categories.isLoading || priorities.isLoading || statuses.isLoading,
  };
}

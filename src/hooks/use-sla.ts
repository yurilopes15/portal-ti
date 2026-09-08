import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SlaConfig, SlaStatusRule } from "@/lib/sla";

export function useSlaConfigs() {
  return useQuery({
    queryKey: ["sla_configs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sla_configs").select("*");
      if (error) throw error;
      return (data ?? []) as SlaConfig[];
    },
    staleTime: 60_000,
  });
}

export function useSlaStatusRules() {
  return useQuery({
    queryKey: ["sla_status_rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sla_status_rules").select("*");
      if (error) throw error;
      return (data ?? []) as SlaStatusRule[];
    },
    staleTime: 60_000,
  });
}

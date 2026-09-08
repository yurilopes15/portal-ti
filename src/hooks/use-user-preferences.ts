import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type DashboardView = "chamados" | "inventario";

export type UserPreferences = {
  dashboard_view: DashboardView;
  tickets_filter_status: string;
  tickets_filter_categoria: string;
  tickets_filter_prioridade: string;
  tickets_filter_q: string;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  dashboard_view: "chamados",
  tickets_filter_status: "todos",
  tickets_filter_categoria: "todos",
  tickets_filter_prioridade: "todos",
  tickets_filter_q: "",
};

function prefsKey(userId?: string) {
  return ["user-preferences", userId] as const;
}

const PERSIST_DEBOUNCE_MS = 600;

export function useUserPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: prefsKey(user?.id),
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<UserPreferences> => {
      if (!user) return DEFAULT_PREFERENCES;
      const { data, error } = await supabase
        .from("user_preferences")
        .select(
          "dashboard_view, tickets_filter_status, tickets_filter_categoria, tickets_filter_prioridade, tickets_filter_q",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as UserPreferences;
      await supabase
        .from("user_preferences")
        .insert({ user_id: user.id })
        .select()
        .maybeSingle();
      return DEFAULT_PREFERENCES;
    },
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<UserPreferences>) => {
      if (!user) return;
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: prefsKey(user?.id) });
      const prev = qc.getQueryData<UserPreferences>(prefsKey(user?.id));
      qc.setQueryData<UserPreferences>(prefsKey(user?.id), {
        ...(prev ?? DEFAULT_PREFERENCES),
        ...patch,
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(prefsKey(user?.id), ctx.prev);
    },
  });

  // Stable refs so callbacks below don't change identity each render
  // (this avoids re-firing caller useEffects on every render).
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const mutateAsyncRef = useRef(mutation.mutateAsync);
  mutateAsyncRef.current = mutation.mutateAsync;

  const current = query.data ?? DEFAULT_PREFERENCES;
  const currentRef = useRef(current);
  currentRef.current = current;

  // Debounce + diff: only writes to Supabase when values actually change,
  // and at most once per PERSIST_DEBOUNCE_MS while filters keep changing.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<UserPreferences>>({});

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    const diff: Partial<UserPreferences> = {};
    for (const [k, v] of Object.entries(patch) as [keyof UserPreferences, any][]) {
      if (currentRef.current[k] !== v && pendingPatch.current[k] !== v) {
        (diff as any)[k] = v;
      }
    }
    if (Object.keys(diff).length === 0) return;
    pendingPatch.current = { ...pendingPatch.current, ...diff };

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const toSend = pendingPatch.current;
      pendingPatch.current = {};
      debounceTimer.current = null;
      if (Object.keys(toSend).length > 0) mutateRef.current(toSend);
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const updateAsync = useCallback(
    (patch: Partial<UserPreferences>) => mutateAsyncRef.current(patch),
    [],
  );

  return {
    preferences: current,
    isLoading: query.isLoading,
    update,
    updateAsync,
  };
}

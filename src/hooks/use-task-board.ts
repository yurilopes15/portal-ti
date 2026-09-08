import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "./use-auth";
import { usePermissions } from "./use-permissions";

export type BoardKind = "meu" | "departamento" | "ti";

export type BoardScope = {
  kind: BoardKind;
  key: string;
  owner_id: string | null;
  department_id: string | null;
};

export type BoardOption = { kind: BoardKind; label: string };

const STORAGE_KEY = "tarefas:board";

export function useMyDepartment() {
  const { data: profile } = useProfile();
  const nome = profile?.departamento?.trim() ?? "";
  return useQuery({
    queryKey: ["my-department", nome],
    enabled: !!nome,
    queryFn: async (): Promise<{ id: string; nome: string } | null> => {
      const { data } = await supabase.from("departments").select("id, nome").eq("ativo", true);
      const match = (data ?? []).find(
        (d) => d.nome.trim().toLowerCase() === nome.toLowerCase(),
      );
      return match ?? null;
    },
  });
}

export function useTaskBoard() {
  const { user } = useAuth();
  const { isTI, isLoading: rolesLoading } = usePermissions();
  const deptQuery = useMyDepartment();
  const department = deptQuery.data ?? null;

  const isTIDepartment =
    !!department && /^t[.]?i[.]?$|^tecnologia/i.test(department.nome.trim());

  const options: BoardOption[] = [];
  if (isTI) options.push({ kind: "ti", label: "Equipe de TI" });
  // Não duplicar: se o usuário é de TI e seu departamento é TI, o quadro "Equipe de TI" já cobre
  if (department && !(isTI && isTIDepartment)) {
    options.push({ kind: "departamento", label: `Departamento · ${department.nome}` });
  }
  options.push({ kind: "meu", label: "Meu Kanban" });

  const [kind, setKind] = useState<BoardKind>(() => {
    if (typeof window === "undefined") return "meu";
    return (localStorage.getItem(STORAGE_KEY) as BoardKind | null) ?? "meu";
  });

  // Garante que o quadro selecionado é válido para este usuário
  const available = options.map((o) => o.kind);
  const activeKind: BoardKind = available.includes(kind) ? kind : (available[0] ?? "meu");

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, activeKind);
  }, [activeKind]);

  const scope: BoardScope =
    activeKind === "ti"
      ? { kind: "ti", key: "ti", owner_id: null, department_id: null }
      : activeKind === "departamento" && department
        ? {
            kind: "departamento",
            key: `dept:${department.id}`,
            owner_id: null,
            department_id: department.id,
          }
        : {
            kind: "meu",
            key: `user:${user?.id ?? "none"}`,
            owner_id: user?.id ?? null,
            department_id: null,
          };

  return {
    isLoading: rolesLoading || deptQuery.isLoading,
    options,
    kind: activeKind,
    setKind,
    department,
    scope,
    canUseTarefas: true,
  };
}

/** Aplica o filtro do quadro ativo em uma query do Supabase. */
export function applyScope<T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(
  query: T,
  scope: BoardScope,
): T {
  if (scope.owner_id) return query.eq("owner_id", scope.owner_id).is("department_id", null);
  if (scope.department_id) return query.eq("department_id", scope.department_id);
  return query.is("owner_id", null).is("department_id", null);
}

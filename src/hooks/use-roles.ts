import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import type { Role, RolePermission, PermissionModule } from "@/lib/permissions";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async (): Promise<Role[]> => {
      const { data } = await supabase
        .from("roles")
        .select("id, slug, nome, descricao, base_role, is_system")
        .order("is_system", { ascending: false })
        .order("nome");
      return (data ?? []) as Role[];
    },
  });
}

export function useRolePermissions(roleId?: string | null) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    enabled: !!roleId,
    queryFn: async (): Promise<RolePermission[]> => {
      const { data } = await supabase
        .from("role_permissions")
        .select("module, can_view, can_create, can_edit, can_delete")
        .eq("role_id", roleId!);
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        module: r.module as PermissionModule,
      }));
    },
  });
}

/** Perfil (roles) do usuário logado + suas permissões. */
export function useMyRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-role", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<{ role: Role | null; permissions: RolePermission[] }> => {
      const { data: ur } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", user!.id)
        .not("role_id", "is", null)
        .limit(1)
        .maybeSingle();

      const roleId = (ur as any)?.role_id as string | undefined;
      if (!roleId) return { role: null, permissions: [] };

      const [{ data: role }, { data: perms }] = await Promise.all([
        supabase
          .from("roles")
          .select("id, slug, nome, descricao, base_role, is_system")
          .eq("id", roleId)
          .maybeSingle(),
        supabase
          .from("role_permissions")
          .select("module, can_view, can_create, can_edit, can_delete")
          .eq("role_id", roleId),
      ]);

      return {
        role: (role ?? null) as Role | null,
        permissions: ((perms ?? []) as any[]).map((r) => ({
          ...r,
          module: r.module as PermissionModule,
        })),
      };
    },
  });
}

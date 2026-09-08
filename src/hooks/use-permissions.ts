import { useAuth, useUserRole, type AppRole } from "./use-auth";
import { useMyRole } from "./use-roles";
import {
  defaultPermission,
  type BaseRole,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();
  const { data: roles = [], isLoading } = useUserRole();
  const { data: myRole, isLoading: roleLoading } = useMyRole();

  const has = (r: AppRole) => roles.includes(r);
  const isAdmin = has("admin");
  const isTecnico = has("tecnico");
  const isTI = isAdmin || isTecnico;
  const isUsuario = !isTI;

  const base: BaseRole = isAdmin ? "admin" : isTecnico ? "tecnico" : "usuario";

  function can(module: PermissionModule, action: PermissionAction = "view"): boolean {
    if (isAdmin) return true;
    const row =
      myRole?.permissions.find((p) => p.module === module) ?? defaultPermission(base, module);
    switch (action) {
      case "view": return row.can_view;
      case "create": return row.can_create;
      case "edit": return row.can_edit;
      case "delete": return row.can_delete;
    }
  }

  return {
    isLoading: isLoading || roleLoading,
    roles,
    role: myRole?.role ?? null,
    isAdmin,
    isTecnico,
    isTI,
    isUsuario,
    can,

    // Tarefas (Kanban) — todos possuem quadro pessoal; TI tem o da equipe
    canUseTarefas: can("tarefas", "view"),
    // null = quadro compartilhado da equipe de TI; uuid = quadro pessoal
    boardOwnerId: isTI ? null : (user?.id ?? null),
    isPersonalBoard: !isTI,

    // Chamados
    canViewAllTickets: isTI,
    canAssignTickets: isTI,
    canChangeTicketStatus: isTI,
    canDeleteTickets: isAdmin,

    // Usuários
    canManageUsers: isAdmin,
    canDeleteUsers: isAdmin,
    canChangeUserRole: isAdmin,
    canResetPassword: isAdmin,

    // Inventário
    canViewInventory: isTI && can("inventario", "view"),
    canManageInventory: isTI && can("inventario", "edit"),
    canDeleteInventory: isAdmin,
    canManageInventoryCategories: isTI,

    // Base de Conhecimento
    canManageKb: isTI && can("base_conhecimento", "edit"),
    canDeleteKbArticles: isAdmin,

    // Departamentos
    canManageDepartments: isAdmin,
  };
}

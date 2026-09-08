import { useAuth, useUserRole, type AppRole } from "./use-auth";

export function usePermissions() {
  const { user } = useAuth();
  const { data: roles = [], isLoading } = useUserRole();
  const has = (r: AppRole) => roles.includes(r);
  const isAdmin = has("admin");
  const isTecnico = has("tecnico");
  const isTI = isAdmin || isTecnico;
  const isUsuario = !isTI;
  const isKanban = has("kanban");

  return {
    isLoading,
    roles,
    isAdmin,
    isTecnico,
    isTI,
    isUsuario,

    // Tarefas (Kanban) — todos possuem quadro pessoal; TI tem o da equipe
    isKanban,
    canUseTarefas: true,
    // null = quadro compartilhado da equipe de TI; uuid = quadro pessoal
    boardOwnerId: isTI ? null : (user?.id ?? null),
    isPersonalBoard: !isTI && isKanban,


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
    canViewInventory: isTI,
    canManageInventory: isTI,
    canDeleteInventory: isAdmin,
    canManageInventoryCategories: isTI,

    // Base de Conhecimento
    canManageKb: isTI,
    canDeleteKbArticles: isAdmin,

    // Departamentos
    canManageDepartments: isAdmin,
  };
}

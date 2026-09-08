export const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "chamados", label: "Chamados" },
  { key: "tarefas", label: "Tarefas" },
  { key: "inventario", label: "Inventário" },
  { key: "base_conhecimento", label: "Base de Conhecimento" },
  { key: "reservas", label: "Reservas" },
  { key: "toners", label: "Toners" },
  { key: "usuarios", label: "Usuários" },
  { key: "configuracoes", label: "Configurações" },
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number]["key"];
export type PermissionAction = "view" | "create" | "edit" | "delete";

export const PERMISSION_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "Ver" },
  { key: "create", label: "Criar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Excluir" },
];

export type BaseRole = "usuario" | "tecnico" | "admin";

export const BASE_ROLE_LABELS: Record<BaseRole, string> = {
  usuario: "Usuário",
  tecnico: "Técnico",
  admin: "Administrador",
};

export type RolePermission = {
  module: PermissionModule;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type Role = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  base_role: BaseRole;
  is_system: boolean;
};

/** Permissões usadas quando o perfil ainda não tem linhas cadastradas. */
export function defaultPermission(
  base: BaseRole,
  module: PermissionModule,
): RolePermission {
  if (base === "admin") {
    return { module, can_view: true, can_create: true, can_edit: true, can_delete: true };
  }
  if (base === "tecnico") {
    const allowed = module !== "usuarios";
    return { module, can_view: allowed, can_create: allowed, can_edit: allowed, can_delete: false };
  }
  const view = ["dashboard", "chamados", "tarefas", "reservas", "base_conhecimento"].includes(module);
  const create = ["chamados", "tarefas", "reservas"].includes(module);
  const edit = ["tarefas", "reservas"].includes(module);
  return { module, can_view: view, can_create: create, can_edit: edit, can_delete: edit };
}

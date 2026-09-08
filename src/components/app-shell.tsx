import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LayoutDashboard, Ticket, Package, BookOpen, Users, LogOut, UserCog, Settings, ChevronRight, Monitor, Printer, Phone, Network, Smartphone, Laptop, CalendarDays, Building2, Wrench, KeyRound, ListChecks, History as HistoryIcon } from "lucide-react";
import { INVENTORY_GROUPS, INVENTORY_GROUP_KEYS, type InventoryGroupKey } from "@/lib/inventory-groups";
import { useBranding } from "@/hooks/use-branding";
import { useAuth, useIsTI, useIsAdmin, useProfile } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationsBell } from "./notifications-bell";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <div className="p-3 sm:p-6 max-w-[1600px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

type ConfigChild = { title: string; url?: string; hash?: string; soon?: boolean };
type ConfigSection = { title: string; children: ConfigChild[] };

function AppSidebar() {
  const { branding } = useBranding();
  const isTI = useIsTI();
  const isAdmin = useIsAdmin();
  const { canUseTarefas } = usePermissions();
  const { isMobile, setOpenMobile } = useSidebar();
  const loc = useRouterState({ select: (s) => s.location });
  const path = loc.pathname;
  const hash = loc.hash;

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, hash]);

  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    { title: "Chamados", url: "/chamados", icon: Ticket, show: true },
    { title: "Base de Conhecimento", url: "/base-conhecimento", icon: BookOpen, show: true },
  ];

  const reservasActive = path === "/reservas" || path.startsWith("/reservas/");
  const [reservasOpen, setReservasOpen] = useState(reservasActive);

  const tarefasActive = path === "/tarefas" || path.startsWith("/tarefas/");
  const [tarefasOpen, setTarefasOpen] = useState(tarefasActive);

  const inventoryGroupIcons: Record<InventoryGroupKey, typeof Package> = {
    computadores: Laptop,
    monitores: Monitor,
    impressoras: Printer,
    telefones: Phone,
    rede: Network,
    celulares: Smartphone,
    licencas: KeyRound,
  };

  const search = loc.search as { grupo?: string } | undefined;
  const currentGrupo = search?.grupo;
  const inventoryActive = path === "/inventario" || path.startsWith("/inventario/");
  const [inventoryOpen, setInventoryOpen] = useState(inventoryActive);

  const configSections: ConfigSection[] = [
    {
      title: "Chamados",
      children: [
        { title: "Categorias", url: "/admin/chamados-config", hash: "categories" },
        { title: "Prioridades", url: "/admin/chamados-config", hash: "priorities" },
        { title: "Status", url: "/admin/chamados-config", hash: "statuses" },
        { title: "SLA", url: "/admin/chamados-config", hash: "sla" },
      ],
    },
    {
      title: "Inventário",
      children: [
        { title: "Categorias", url: "/admin/inventario-config", hash: "categorias" },
        
        { title: "Fabricantes", url: "/admin/inventario-config", hash: "inventory_manufacturers" },
        { title: "Sistemas Operacionais", url: "/admin/inventario-config", hash: "inventory_operating_systems" },
        { title: "Status", url: "/admin/inventario-config", hash: "inventory_statuses" },
      ],
    },
    {
      title: "Base de Conhecimento",
      children: [{ title: "Categorias", url: "/admin/base-conhecimento-config" }],
    },
    {
      title: "Reservas",
      children: [
        { title: "Salas", url: "/admin/reservas-config", hash: "salas" },
        { title: "Equipamentos", url: "/admin/reservas-config", hash: "equipamentos" },
        { title: "Bloqueios", url: "/admin/reservas-config", hash: "bloqueios" },
      ],
    },
    {
      title: "Organização",
      children: [{ title: "Departamentos", url: "/admin/departamentos" }],
    },
    {
      title: "Aparência",
      children: [{ title: "Personalização", url: "/admin/personalizacao" }],
    },
    {
      title: "Segurança",
      children: [
        { title: "Perfis", url: "/admin/seguranca", hash: "perfis" },
        { title: "Permissões", url: "/admin/seguranca", hash: "permissoes" },
        { title: "Regras de Acesso", soon: true },
      ],
    },
  ];

  const isActive = (url: string) => url === "/" ? path === "/" : path === url || path.startsWith(url + "/");
  const isSubActive = (c: ConfigChild) => !!c.url && path === c.url && (c.hash ? hash === c.hash : !hash);
  const configOpenDefault = configSections.some((s) => s.children.some((c) => c.url && isActive(c.url)));
  const [configOpen, setConfigOpen] = useState(configOpenDefault);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-white flex items-center justify-center shrink-0 overflow-hidden">
            {branding.sidebar_logo_url && (
              <img src={branding.sidebar_logo_url} alt={branding.company_name} className="h-7 w-7 object-contain" />
            )}
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold text-sidebar-foreground leading-tight">{branding.app_name}</div>
            <div className="text-[11px] text-sidebar-foreground/60 leading-tight">{branding.company_name}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.filter((i) => i.show && i.url !== "/base-conhecimento").map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {isTI && (
                <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen} className="group/inv">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Inventário" isActive={inventoryActive}>
                        <Package className="h-4 w-4" />
                        <span>Inventário</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/inv:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={inventoryActive && !currentGrupo}>
                            <Link to="/inventario" search={{ grupo: undefined }}>
                              <span>Todos</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {INVENTORY_GROUP_KEYS.map((key) => {
                          const g = INVENTORY_GROUPS[key];
                          const Icon = inventoryGroupIcons[key];
                          return (
                            <SidebarMenuSubItem key={key}>
                              <SidebarMenuSubButton asChild isActive={inventoryActive && currentGrupo === key}>
                                <Link to="/inventario" search={{ grupo: key }}>
                                  <Icon className="h-3.5 w-3.5" />
                                  <span>{g.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={path === "/admin/toners"}>
                            <Link to="/admin/toners">
                              <Printer className="h-3.5 w-3.5" />
                              <span>Estoque de Toners</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              <Collapsible open={reservasOpen} onOpenChange={setReservasOpen} className="group/res">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Reservas" isActive={reservasActive}>
                      <CalendarDays className="h-4 w-4" />
                      <span>Reservas</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/res:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={path.startsWith("/reservas/salas")}>
                          <Link to="/reservas/salas">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>Salas</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={path.startsWith("/reservas/equipamentos")}>
                          <Link to="/reservas/equipamentos">
                            <Wrench className="h-3.5 w-3.5" />
                            <span>Equipamentos</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>


              {canUseTarefas && (
                <Collapsible open={tarefasOpen} onOpenChange={setTarefasOpen} className="group/tar">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Tarefas" isActive={tarefasActive}>
                        <ListChecks className="h-4 w-4" />
                        <span>Tarefas</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/tar:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={path === "/tarefas"}>
                            <Link to="/tarefas">
                              <ListChecks className="h-3.5 w-3.5" />
                              <span>Quadro</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={path.startsWith("/tarefas/historico")}>
                            <Link to="/tarefas/historico">
                              <HistoryIcon className="h-3.5 w-3.5" />
                              <span>Histórico</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {items.filter((i) => i.show && i.url === "/base-conhecimento").map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/usuarios")} tooltip="Usuários">
                    <Link to="/admin/usuarios">
                      <Users className="h-4 w-4" />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <Collapsible open={configOpen} onOpenChange={setConfigOpen} className="group/config">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Configurações" isActive={configOpenDefault}>
                        <Settings className="h-4 w-4" />
                        <span>Configurações</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/config:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {configSections.map((section) => {
                          const sectionActive = section.children.some((c) => c.url && isActive(c.url));
                          return (
                            <ConfigSectionNode
                              key={section.title}
                              section={section}
                              defaultOpen={sectionActive}
                              isSubActive={isSubActive}
                            />
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isTI && !isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Configurações</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/personalizacao")} tooltip="Personalização">
                    <Link to="/admin/personalizacao">
                      <Settings className="h-4 w-4" />
                      <span>Personalização</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 group-data-[collapsible=icon]:hidden" />

    </Sidebar>
  );
}

function AppHeader() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isTI = useIsTI();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.nome ?? user?.email ?? "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 sticky top-0 z-10">
      <SidebarTrigger />
      <div className="flex-1" />
      <NotificationsBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium leading-tight">{profile?.nome ?? "Usuário"}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{isTI ? "Equipe de TI" : "Usuário"}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/perfil"><UserCog className="h-4 w-4 mr-2" />Meu Perfil</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function ConfigSectionNode({
  section,
  defaultOpen,
  isSubActive,
}: {
  section: ConfigSection;
  defaultOpen: boolean;
  isSubActive: (c: ConfigChild) => boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/section">
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer">
            <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/section:rotate-90" />
            <span>{section.title}</span>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-2">
            {section.children.map((c) => (
              <SidebarMenuSubItem key={`${section.title}-${c.title}`}>
                {c.soon || !c.url ? (
                  <SidebarMenuSubButton
                    onClick={() => toast.info(`${c.title} — em breve`)}
                    className="opacity-60 cursor-not-allowed"
                  >
                    <span>{c.title}</span>
                    <span className="ml-auto text-[9px] uppercase">em breve</span>
                  </SidebarMenuSubButton>
                ) : (
                  <SidebarMenuSubButton asChild isActive={isSubActive(c)}>
                    <Link to={c.url} hash={c.hash}>
                      <span>{c.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                )}
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

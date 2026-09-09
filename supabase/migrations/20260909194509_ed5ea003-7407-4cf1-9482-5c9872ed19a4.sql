-- Toner movements: apenas TI
DROP POLICY IF EXISTS "toner_mov_select_all" ON public.toner_movements;
CREATE POLICY "toner_mov_select_ti" ON public.toner_movements FOR SELECT TO authenticated
USING (public.is_ti(auth.uid()));

-- Reservas de sala (módulo antigo): dono ou TI
DROP POLICY IF EXISTS "Todos veem reservas" ON public.room_reservations;
DROP POLICY IF EXISTS "room_reservations_select_all" ON public.room_reservations;
DROP POLICY IF EXISTS "Usuarios veem reservas" ON public.room_reservations;
CREATE POLICY "room_reservations_select_own_or_ti" ON public.room_reservations FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_ti(auth.uid()));

-- Perfis e permissões: apenas o próprio perfil, ou TI/admin
DROP POLICY IF EXISTS "roles_select_all" ON public.roles;
DROP POLICY IF EXISTS "Todos veem roles" ON public.roles;
CREATE POLICY "roles_select_own_or_ti" ON public.roles FOR SELECT TO authenticated
USING (
  public.is_ti(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role_id = roles.id)
);

DROP POLICY IF EXISTS "role_permissions_select_all" ON public.role_permissions;
DROP POLICY IF EXISTS "Todos veem permissoes" ON public.role_permissions;
CREATE POLICY "role_permissions_select_own_or_ti" ON public.role_permissions FOR SELECT TO authenticated
USING (
  public.is_ti(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role_id = role_permissions.role_id)
);
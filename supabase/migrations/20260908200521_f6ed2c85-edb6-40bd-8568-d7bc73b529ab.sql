CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  base_role app_role NOT NULL DEFAULT 'usuario',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_auth" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_all" ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, module)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_perms_select_auth" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_perms_admin_all" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.roles (slug, nome, descricao, base_role, is_system) VALUES
  ('usuario', 'Usuário', 'Acesso padrão para colaboradores.', 'usuario', true),
  ('tecnico', 'Técnico', 'Equipe de TI, com acesso operacional completo.', 'tecnico', true),
  ('admin', 'Administrador', 'Acesso total ao sistema.', 'admin', true);

INSERT INTO public.role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, m.module,
  CASE r.slug
    WHEN 'admin' THEN true
    WHEN 'tecnico' THEN m.module <> 'usuarios'
    ELSE m.module IN ('dashboard','chamados','tarefas','reservas','base_conhecimento')
  END,
  CASE r.slug
    WHEN 'admin' THEN true
    WHEN 'tecnico' THEN m.module <> 'usuarios'
    ELSE m.module IN ('chamados','tarefas','reservas')
  END,
  CASE r.slug
    WHEN 'admin' THEN true
    WHEN 'tecnico' THEN m.module <> 'usuarios'
    ELSE m.module IN ('tarefas','reservas')
  END,
  CASE r.slug
    WHEN 'admin' THEN true
    WHEN 'tecnico' THEN false
    ELSE m.module IN ('tarefas','reservas')
  END
FROM public.roles r
CROSS JOIN (VALUES ('dashboard'),('chamados'),('tarefas'),('inventario'),('base_conhecimento'),('reservas'),('toners'),('usuarios'),('configuracoes')) AS m(module);

ALTER TABLE public.user_roles ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

UPDATE public.user_roles SET role = 'usuario' WHERE role = 'kanban';

UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE r.slug = ur.role::text AND ur.role_id IS NULL;

CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
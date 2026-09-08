SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- ============ TYPES ============
CREATE TYPE public.app_role AS ENUM ('usuario','tecnico','admin');
CREATE TYPE public.kb_content_type AS ENUM ('artigo','procedimento','manual','politica');
CREATE TYPE public.ticket_category AS ENUM ('hardware','software','rede','impressoras','erp','email','telefonia','outros');
CREATE TYPE public.ticket_priority AS ENUM ('baixa','media','alta','critica');
CREATE TYPE public.ticket_status AS ENUM ('aberto','em_atendimento','aguardando_usuario','resolvido','fechado');

-- ============ FUNCTIONS ============
CREATE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, departamento, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'departamento',
    NEW.raw_user_meta_data->>'telefone'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'usuario'))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;$$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE FUNCTION public.is_ti(_user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('tecnico','admin'))
$$;

CREATE FUNCTION public.log_admin_action(_action text, _entity_type text, _entity_id uuid, _metadata jsonb DEFAULT '{}'::jsonb) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, _action, _entity_type, _entity_id, _metadata);
END;$$;

CREATE FUNCTION public.log_ticket_changes() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_history(ticket_id, autor_id, campo, valor_novo)
    VALUES (NEW.id, NEW.criado_por, 'criado', NEW.status::text);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_history(ticket_id, autor_id, campo, valor_antigo, valor_novo)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.ticket_history(ticket_id, autor_id, campo, valor_antigo, valor_novo)
    VALUES (NEW.id, auth.uid(), 'responsavel', COALESCE(OLD.responsavel_id::text,''), COALESCE(NEW.responsavel_id::text,''));
  END IF;
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.ticket_history(ticket_id, autor_id, campo, valor_antigo, valor_novo)
    VALUES (NEW.id, auth.uid(), 'prioridade', OLD.prioridade::text, NEW.prioridade::text);
  END IF;
  IF NEW.solucao IS DISTINCT FROM OLD.solucao AND NEW.solucao IS NOT NULL THEN
    INSERT INTO public.ticket_history(ticket_id, autor_id, campo, valor_novo)
    VALUES (NEW.id, auth.uid(), 'solucao', 'registrada');
  END IF;
  RETURN NEW;
END;$$;

CREATE FUNCTION public.notify_comment() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ticket RECORD;
BEGIN
  SELECT criado_por, responsavel_id, numero, titulo INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  IF v_ticket.criado_por <> NEW.autor_id AND NOT NEW.interno THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (v_ticket.criado_por, NEW.ticket_id, 'Novo comentario no chamado #'||v_ticket.numero, v_ticket.titulo);
  END IF;
  IF v_ticket.responsavel_id IS NOT NULL AND v_ticket.responsavel_id <> NEW.autor_id THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (v_ticket.responsavel_id, NEW.ticket_id, 'Novo comentario no chamado #'||v_ticket.numero, v_ticket.titulo);
  END IF;
  RETURN NEW;
END;$$;

CREATE FUNCTION public.notify_ticket_event() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tecnicos UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_tecnicos IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('tecnico','admin') LOOP
      INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
      VALUES (v_tecnicos, NEW.id, 'Novo chamado #'||NEW.numero, NEW.titulo);
    END LOOP;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.criado_por <> COALESCE(auth.uid(), NEW.criado_por) THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (NEW.criado_por, NEW.id, 'Chamado #'||NEW.numero||' atualizado', 'Status: '||NEW.status::text);
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id AND NEW.responsavel_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (NEW.responsavel_id, NEW.id, 'Chamado #'||NEW.numero||' atribuido', NEW.titulo);
  END IF;
  RETURN NEW;
END;$$;

CREATE FUNCTION public.restore_entity(_entity_type text, _entity_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Apenas administradores podem restaurar registros'; END IF;
  IF _entity_type = 'ticket' THEN
    UPDATE public.tickets SET deleted_at = NULL, deleted_by = NULL WHERE id = _entity_id;
  ELSIF _entity_type = 'inventory_item' THEN
    UPDATE public.inventory_items SET deleted_at = NULL, deleted_by = NULL WHERE id = _entity_id;
  ELSIF _entity_type = 'kb_article' THEN
    UPDATE public.kb_articles SET deleted_at = NULL, deleted_by = NULL WHERE id = _entity_id;
  ELSIF _entity_type = 'profile' THEN
    UPDATE public.profiles SET deleted_at = NULL, deleted_by = NULL, ativo = true WHERE id = _entity_id;
  ELSE RAISE EXCEPTION 'Tipo inválido'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id) VALUES (v_uid, 'restore', _entity_type, _entity_id);
END;$$;

CREATE FUNCTION public.set_ticket_timestamps() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_is_resolvido BOOLEAN := false; v_is_fechado BOOLEAN := false;
  v_was_resolvido BOOLEAN := false; v_was_fechado BOOLEAN := false;
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT is_resolvido, is_fechado INTO v_is_resolvido, v_is_fechado FROM public.ticket_statuses WHERE id = NEW.status_id;
  ELSIF NEW.status IS NOT NULL THEN
    SELECT is_resolvido, is_fechado INTO v_is_resolvido, v_is_fechado FROM public.ticket_statuses WHERE nome = NEW.status;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status_id IS NOT NULL THEN
      SELECT is_resolvido, is_fechado INTO v_was_resolvido, v_was_fechado FROM public.ticket_statuses WHERE id = OLD.status_id;
    ELSIF OLD.status IS NOT NULL THEN
      SELECT is_resolvido, is_fechado INTO v_was_resolvido, v_was_fechado FROM public.ticket_statuses WHERE nome = OLD.status;
    END IF;
  END IF;
  IF COALESCE(v_is_resolvido,false) AND NOT COALESCE(v_was_resolvido,false) THEN NEW.resolvido_em := now(); END IF;
  IF COALESCE(v_is_fechado,false) AND NOT COALESCE(v_was_fechado,false) THEN
    NEW.fechado_em := now();
    IF NEW.resolvido_em IS NULL THEN NEW.resolvido_em := now(); END IF;
  END IF;
  IF NOT COALESCE(v_is_resolvido,false) AND NOT COALESCE(v_is_fechado,false) THEN NEW.resolvido_em := NULL; END IF;
  IF NOT COALESCE(v_is_fechado,false) THEN NEW.fechado_em := NULL; END IF;
  RETURN NEW;
END;$$;

CREATE FUNCTION public.soft_delete_entity(_entity_type text, _entity_id uuid, _metadata jsonb DEFAULT '{}'::jsonb) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Apenas administradores podem excluir registros'; END IF;
  IF _entity_type = 'ticket' THEN
    UPDATE public.tickets SET deleted_at = now(), deleted_by = v_uid WHERE id = _entity_id AND deleted_at IS NULL;
  ELSIF _entity_type = 'inventory_item' THEN
    UPDATE public.inventory_items SET deleted_at = now(), deleted_by = v_uid WHERE id = _entity_id AND deleted_at IS NULL;
  ELSIF _entity_type = 'kb_article' THEN
    UPDATE public.kb_articles SET deleted_at = now(), deleted_by = v_uid WHERE id = _entity_id AND deleted_at IS NULL;
  ELSIF _entity_type = 'profile' THEN
    UPDATE public.profiles SET deleted_at = now(), deleted_by = v_uid, ativo = false WHERE id = _entity_id AND deleted_at IS NULL;
  ELSE RAISE EXCEPTION 'Tipo de entidade inválido: %', _entity_type; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'delete', _entity_type, _entity_id, _metadata);
END;$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

-- ============ TABLES ============
CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.departments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_manufacturers (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_operating_systems (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  departamento text,
  telefone text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.inventory_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  patrimonio text NOT NULL UNIQUE,
  tipo text NOT NULL,
  fabricante text,
  modelo text,
  numero_serie text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  localizacao text,
  status text DEFAULT 'ativo' NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  anydesk_id text,
  teamviewer_id text,
  computer_name text,
  operating_system text,
  ip_address text,
  mac_address text,
  category_id uuid REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  type_id uuid REFERENCES public.inventory_types(id) ON DELETE RESTRICT,
  status_id uuid REFERENCES public.inventory_statuses(id) ON DELETE RESTRICT,
  manufacturer_id uuid REFERENCES public.inventory_manufacturers(id) ON DELETE RESTRICT,
  operating_system_id uuid REFERENCES public.inventory_operating_systems(id) ON DELETE RESTRICT
);

CREATE TABLE public.kb_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz DEFAULT now() NOT NULL,
  ativo boolean DEFAULT true NOT NULL
);

CREATE TABLE public.kb_articles (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  titulo text NOT NULL,
  slug text NOT NULL UNIQUE,
  conteudo text NOT NULL,
  categoria_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publicado boolean DEFAULT true NOT NULL,
  views integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  tipo_conteudo public.kb_content_type DEFAULT 'artigo' NOT NULL
);

CREATE TABLE public.kb_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text NOT NULL,
  tamanho bigint NOT NULL,
  mime text,
  enviado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.ticket_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  cor text DEFAULT '#64748b' NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.ticket_priorities (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  cor text DEFAULT '#64748b' NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.ticket_statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  cor text DEFAULT '#64748b' NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  is_inicial boolean DEFAULT false NOT NULL,
  is_resolvido boolean DEFAULT false NOT NULL,
  is_fechado boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.tickets_numero_seq START 1;

CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  numero bigint NOT NULL DEFAULT nextval('public.tickets_numero_seq') UNIQUE,
  titulo text NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL,
  prioridade text DEFAULT 'Média' NOT NULL,
  status text DEFAULT 'Aberto' NOT NULL,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solucao text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  resolvido_em timestamptz,
  fechado_em timestamptz,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  category_id uuid REFERENCES public.ticket_categories(id) ON DELETE RESTRICT,
  priority_id uuid REFERENCES public.ticket_priorities(id) ON DELETE RESTRICT,
  status_id uuid REFERENCES public.ticket_statuses(id) ON DELETE RESTRICT
);
ALTER SEQUENCE public.tickets_numero_seq OWNED BY public.tickets.numero;
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

CREATE TABLE public.ticket_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text NOT NULL,
  tamanho bigint NOT NULL,
  mime text,
  enviado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_attachments REPLICA IDENTITY FULL;

CREATE TABLE public.ticket_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  interno boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_comments REPLICA IDENTITY FULL;

CREATE TABLE public.ticket_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_history REPLICA IDENTITY FULL;

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============ INDEXES ============
CREATE INDEX idx_attachments_ticket ON public.ticket_attachments(ticket_id);
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_comments_ticket ON public.ticket_comments(ticket_id);
CREATE INDEX idx_history_ticket ON public.ticket_history(ticket_id);
CREATE INDEX idx_inv_not_deleted ON public.inventory_items(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kb_attachments_article ON public.kb_attachments(article_id);
CREATE INDEX idx_kb_not_deleted ON public.kb_articles(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notif_user ON public.notifications(user_id, lida);
CREATE INDEX idx_tickets_categoria ON public.tickets(categoria);
CREATE INDEX idx_tickets_criado_por ON public.tickets(criado_por);
CREATE INDEX idx_tickets_not_deleted ON public.tickets(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_responsavel ON public.tickets(responsavel_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX inventory_items_category_id_idx ON public.inventory_items(category_id);
CREATE INDEX inventory_items_responsavel_id_idx ON public.inventory_items(responsavel_id);

-- ============ TRIGGERS ============
CREATE TRIGGER comments_notify AFTER INSERT ON public.ticket_comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment();
CREATE TRIGGER inventory_categories_updated_at BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER kb_updated_at BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_ticket_timestamps_trg BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_timestamps();
CREATE TRIGGER tickets_log_insert AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();
CREATE TRIGGER tickets_log_update AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();
CREATE TRIGGER tickets_notify_insert AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_event();
CREATE TRIGGER tickets_notify_update AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_event();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_manufacturers_updated BEFORE UPDATE ON public.inventory_manufacturers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_os_updated BEFORE UPDATE ON public.inventory_operating_systems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_statuses_updated BEFORE UPDATE ON public.inventory_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_types_updated BEFORE UPDATE ON public.inventory_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ticket_categories_updated BEFORE UPDATE ON public.ticket_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ticket_priorities_updated BEFORE UPDATE ON public.ticket_priorities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ticket_statuses_updated BEFORE UPDATE ON public.ticket_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ GRANTS ============
DO $$
DECLARE t text;
  tables text[] := ARRAY['audit_log','departments','inventory_categories','inventory_items','inventory_manufacturers','inventory_operating_systems','inventory_statuses','inventory_types','kb_articles','kb_attachments','kb_categories','notifications','profiles','ticket_attachments','ticket_categories','ticket_comments','ticket_history','ticket_priorities','ticket_statuses','tickets','user_roles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.tickets_numero_seq TO authenticated, service_role;

-- ============ RLS ENABLE ============
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_operating_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY "Admin deleta tickets" ON public.tickets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia papeis" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia perfis" ON public.profiles TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin reads audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Atualiza propria notificacao" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cria comentario" ON public.ticket_comments FOR INSERT TO authenticated WITH CHECK ((autor_id = auth.uid()) AND (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))) AND ((NOT interno) OR public.is_ti(auth.uid())));
CREATE POLICY "Cria notificacao restrita" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR public.is_ti(auth.uid()));
CREATE POLICY "Deleta propria notificacao" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Deleta proprio anexo" ON public.ticket_attachments FOR DELETE TO authenticated USING ((enviado_por = auth.uid()) OR public.is_ti(auth.uid()));
CREATE POLICY "Envia anexo" ON public.ticket_attachments FOR INSERT TO authenticated WITH CHECK ((enviado_por = auth.uid()) AND (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_attachments.ticket_id AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))));
CREATE POLICY "TI atualiza tickets" ON public.tickets FOR UPDATE TO authenticated USING (public.is_ti(auth.uid()) OR criado_por = auth.uid()) WITH CHECK (public.is_ti(auth.uid()) OR criado_por = auth.uid());
CREATE POLICY "TI gerencia anexos KB" ON public.kb_attachments TO authenticated USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()) AND enviado_por = auth.uid());
CREATE POLICY "TI gerencia artigos" ON public.kb_articles TO authenticated USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));
CREATE POLICY "TI gerencia categorias KB" ON public.kb_categories TO authenticated USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));
CREATE POLICY "TI gerencia inventario" ON public.inventory_items TO authenticated USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));
CREATE POLICY "Todos veem categorias KB" ON public.kb_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario cria ticket" ON public.tickets FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());
CREATE POLICY "Usuario ve seus tickets" ON public.tickets FOR SELECT TO authenticated USING (((deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin')) AND (criado_por = auth.uid() OR public.is_ti(auth.uid())));
CREATE POLICY "Usuarios atualizam proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuarios veem proprio papel" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_ti(auth.uid()));
CREATE POLICY "Usuarios veem proprio perfil" ON public.profiles FOR SELECT TO authenticated USING (((deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin')) AND (auth.uid() = id OR public.is_ti(auth.uid())));
CREATE POLICY "Ve anexos de artigos visiveis" ON public.kb_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.kb_articles a WHERE a.id = kb_attachments.article_id AND ((a.deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin')) AND (a.publicado = true OR public.is_ti(auth.uid()))));
CREATE POLICY "Ve anexos do ticket" ON public.ticket_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_attachments.ticket_id AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid()))));
CREATE POLICY "Ve artigos publicados" ON public.kb_articles FOR SELECT TO authenticated USING (((deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin')) AND (publicado = true OR public.is_ti(auth.uid())));
CREATE POLICY "Ve comentarios do ticket" ON public.ticket_comments FOR SELECT TO authenticated USING ((EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))) AND ((NOT interno) OR public.is_ti(auth.uid())));
CREATE POLICY "Ve historico" ON public.ticket_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_history.ticket_id AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid()))));
CREATE POLICY "Ve inventario" ON public.inventory_items FOR SELECT TO authenticated USING (((deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin')) AND (public.is_ti(auth.uid()) OR responsavel_id = auth.uid()));
CREATE POLICY "Ve proprias notificacoes" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin manage inventory_manufacturers" ON public.inventory_manufacturers TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage inventory_os" ON public.inventory_operating_systems TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage inventory_statuses" ON public.inventory_statuses TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage inventory_types" ON public.inventory_types TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage ticket_categories" ON public.ticket_categories TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage ticket_priorities" ON public.ticket_priorities TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage ticket_statuses" ON public.ticket_statuses TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth read categories" ON public.inventory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "read inventory_manufacturers" ON public.inventory_manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "read inventory_os" ON public.inventory_operating_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "read inventory_statuses" ON public.inventory_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "read inventory_types" ON public.inventory_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "read ticket_categories" ON public.ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "read ticket_priorities" ON public.ticket_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "read ticket_statuses" ON public.ticket_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti manage categories" ON public.inventory_categories TO authenticated USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));
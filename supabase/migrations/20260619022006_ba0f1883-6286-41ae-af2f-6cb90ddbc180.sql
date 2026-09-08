
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('usuario', 'tecnico', 'admin');
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'em_atendimento', 'aguardando_usuario', 'resolvido', 'fechado');
CREATE TYPE public.ticket_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.ticket_category AS ENUM ('hardware', 'software', 'rede', 'impressoras', 'erp', 'email', 'telefonia', 'outros');

-- =========================
-- updated_at helper
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  departamento TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ti(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('tecnico','admin')
  )
$$;

-- Profiles policies
CREATE POLICY "Usuarios veem proprio perfil" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_ti(auth.uid()));
CREATE POLICY "Usuarios atualizam proprio perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin gerencia perfis" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles policies
CREATE POLICY "Usuarios veem proprio papel" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_ti(auth.uid()));
CREATE POLICY "Admin gerencia papeis" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- handle new user: cria profile + role usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, departamento, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'departamento',
    NEW.raw_user_meta_data->>'telefone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'usuario'))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- TICKETS
-- =========================
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria public.ticket_category NOT NULL,
  prioridade public.ticket_priority NOT NULL DEFAULT 'media',
  status public.ticket_status NOT NULL DEFAULT 'aberto',
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  solucao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em TIMESTAMPTZ,
  fechado_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_categoria ON public.tickets(categoria);
CREATE INDEX idx_tickets_criado_por ON public.tickets(criado_por);
CREATE INDEX idx_tickets_responsavel ON public.tickets(responsavel_id);

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- set resolvido/fechado timestamps
CREATE OR REPLACE FUNCTION public.set_ticket_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'resolvido' AND (OLD.status IS DISTINCT FROM 'resolvido') THEN
    NEW.resolvido_em = now();
  END IF;
  IF NEW.status = 'fechado' AND (OLD.status IS DISTINCT FROM 'fechado') THEN
    NEW.fechado_em = now();
    IF NEW.resolvido_em IS NULL THEN NEW.resolvido_em = now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_ticket_timestamps_trg
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_timestamps();

CREATE POLICY "Usuario ve seus tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (criado_por = auth.uid() OR public.is_ti(auth.uid()));
CREATE POLICY "Usuario cria ticket" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());
CREATE POLICY "TI atualiza tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.is_ti(auth.uid()) OR criado_por = auth.uid())
  WITH CHECK (public.is_ti(auth.uid()) OR criado_por = auth.uid());
CREATE POLICY "Admin deleta tickets" ON public.tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================
-- TICKET COMMENTS
-- =========================
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  interno BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_comments_ticket ON public.ticket_comments(ticket_id);

CREATE POLICY "Ve comentarios do ticket" ON public.ticket_comments
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))
    AND (NOT interno OR public.is_ti(auth.uid()))
  );
CREATE POLICY "Cria comentario" ON public.ticket_comments
  FOR INSERT TO authenticated WITH CHECK (
    autor_id = auth.uid() AND
    EXISTS(SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))
    AND (NOT interno OR public.is_ti(auth.uid()))
  );

-- =========================
-- TICKET ATTACHMENTS
-- =========================
CREATE TABLE public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome TEXT NOT NULL,
  tamanho BIGINT NOT NULL,
  mime TEXT,
  enviado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attachments_ticket ON public.ticket_attachments(ticket_id);

CREATE POLICY "Ve anexos do ticket" ON public.ticket_attachments
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))
  );
CREATE POLICY "Envia anexo" ON public.ticket_attachments
  FOR INSERT TO authenticated WITH CHECK (
    enviado_por = auth.uid() AND
    EXISTS(SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))
  );
CREATE POLICY "Deleta proprio anexo" ON public.ticket_attachments
  FOR DELETE TO authenticated USING (enviado_por = auth.uid() OR public.is_ti(auth.uid()));

-- =========================
-- TICKET HISTORY
-- =========================
CREATE TABLE public.ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  campo TEXT NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_history TO authenticated;
GRANT ALL ON public.ticket_history TO service_role;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_history_ticket ON public.ticket_history(ticket_id);

CREATE POLICY "Ve historico" ON public.ticket_history
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid())))
  );

-- Trigger automatica de historico
CREATE OR REPLACE FUNCTION public.log_ticket_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    VALUES (NEW.id, auth.uid(), 'responsavel',
      COALESCE(OLD.responsavel_id::text,''), COALESCE(NEW.responsavel_id::text,''));
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
END;
$$;

CREATE TRIGGER tickets_log_insert AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();
CREATE TRIGGER tickets_log_update AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();

-- =========================
-- NOTIFICATIONS (in-app)
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notif_user ON public.notifications(user_id, lida);

CREATE POLICY "Ve proprias notificacoes" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Atualiza propria notificacao" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Deleta propria notificacao" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Sistema cria notificacao" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Gera notificacoes automaticamente
CREATE OR REPLACE FUNCTION public.notify_ticket_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tecnicos UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- notifica todos os tecnicos/admins
    FOR v_tecnicos IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('tecnico','admin')
    LOOP
      INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
      VALUES (v_tecnicos, NEW.id, 'Novo chamado #'||NEW.numero, NEW.titulo);
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.criado_por <> COALESCE(auth.uid(), NEW.criado_por) THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (NEW.criado_por, NEW.id, 'Chamado #'||NEW.numero||' atualizado',
      'Status: '||NEW.status::text);
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id AND NEW.responsavel_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (NEW.responsavel_id, NEW.id, 'Chamado #'||NEW.numero||' atribuido', NEW.titulo);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tickets_notify_insert AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_event();
CREATE TRIGGER tickets_notify_update AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_event();

CREATE OR REPLACE FUNCTION public.notify_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  SELECT criado_por, responsavel_id, numero, titulo INTO v_ticket
  FROM public.tickets WHERE id = NEW.ticket_id;

  -- notifica autor (se nao for ele que comentou) e responsavel
  IF v_ticket.criado_por <> NEW.autor_id AND NOT NEW.interno THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (v_ticket.criado_por, NEW.ticket_id,
      'Novo comentario no chamado #'||v_ticket.numero, v_ticket.titulo);
  END IF;
  IF v_ticket.responsavel_id IS NOT NULL AND v_ticket.responsavel_id <> NEW.autor_id THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (v_ticket.responsavel_id, NEW.ticket_id,
      'Novo comentario no chamado #'||v_ticket.numero, v_ticket.titulo);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER comments_notify AFTER INSERT ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

-- =========================
-- INVENTORY
-- =========================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  fabricante TEXT,
  modelo TEXT,
  numero_serie TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  localizacao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Ve inventario" ON public.inventory_items
  FOR SELECT TO authenticated USING (
    public.is_ti(auth.uid()) OR responsavel_id = auth.uid()
  );
CREATE POLICY "TI gerencia inventario" ON public.inventory_items
  FOR ALL TO authenticated USING (public.is_ti(auth.uid()))
  WITH CHECK (public.is_ti(auth.uid()));

-- =========================
-- KB
-- =========================
CREATE TABLE public.kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kb_categories TO authenticated;
GRANT ALL ON public.kb_categories TO service_role;
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem categorias KB" ON public.kb_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TI gerencia categorias KB" ON public.kb_categories
  FOR ALL TO authenticated USING (public.is_ti(auth.uid()))
  WITH CHECK (public.is_ti(auth.uid()));

CREATE TABLE public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  conteudo TEXT NOT NULL,
  categoria_id UUID REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publicado BOOLEAN NOT NULL DEFAULT true,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER kb_updated_at BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Ve artigos publicados" ON public.kb_articles
  FOR SELECT TO authenticated USING (publicado = true OR public.is_ti(auth.uid()));
CREATE POLICY "TI gerencia artigos" ON public.kb_articles
  FOR ALL TO authenticated USING (public.is_ti(auth.uid()))
  WITH CHECK (public.is_ti(auth.uid()));

-- Seed categorias KB
INSERT INTO public.kb_categories(nome, slug, descricao) VALUES
 ('Hardware','hardware','Artigos sobre hardware'),
 ('Software','software','Artigos sobre software'),
 ('Rede','rede','Artigos sobre rede'),
 ('ERP','erp','Artigos sobre o ERP'),
 ('E-mail','email','Artigos sobre e-mail'),
 ('Outros','outros','Outros tópicos');

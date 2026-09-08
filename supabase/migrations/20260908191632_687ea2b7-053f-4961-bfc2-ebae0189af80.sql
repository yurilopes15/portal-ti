DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.prokind='f' AND p.proname <> 'rls_auto_enable' LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
  FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
           WHERE n.nspname='public' AND t.typtype='e' LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END $$;
DROP SEQUENCE IF EXISTS public.tickets_numero_seq CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TYPE public.app_role AS ENUM ('usuario', 'tecnico', 'admin', 'kanban');
CREATE TYPE public.reservation_status AS ENUM ('reservado', 'concluido', 'cancelado');
CREATE TYPE public.resource_status AS ENUM ('disponivel', 'manutencao', 'inativo');
CREATE TYPE public.resource_type AS ENUM ('room', 'equipment');
CREATE TYPE public.ticket_category AS ENUM ('hardware', 'software', 'rede', 'impressoras', 'erp', 'email', 'telefonia', 'outros');
CREATE TYPE public.ticket_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'em_atendimento', 'aguardando_usuario', 'resolvido', 'fechado');
CREATE TYPE public.toner_color AS ENUM ('preto', 'ciano', 'magenta', 'amarelo', 'unico');

CREATE SEQUENCE public.tickets_numero_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);
CREATE INDEX idx_audit_created ON public.audit_log USING btree (created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);

CREATE TABLE public.departments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE public.departments ADD CONSTRAINT departments_nome_key UNIQUE (nome);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  departamento text,
  telefone text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  deleted_by uuid
);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE public.inventory_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.inventory_categories ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_categories ADD CONSTRAINT inventory_categories_nome_key UNIQUE (nome);

CREATE TABLE public.inventory_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.inventory_types ADD CONSTRAINT inventory_types_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_types ADD CONSTRAINT inventory_types_nome_key UNIQUE (nome);

CREATE TABLE public.inventory_statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.inventory_statuses ADD CONSTRAINT inventory_statuses_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_statuses ADD CONSTRAINT inventory_statuses_nome_key UNIQUE (nome);

CREATE TABLE public.inventory_manufacturers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.inventory_manufacturers ADD CONSTRAINT inventory_manufacturers_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_manufacturers ADD CONSTRAINT inventory_manufacturers_nome_key UNIQUE (nome);

CREATE TABLE public.inventory_operating_systems (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.inventory_operating_systems ADD CONSTRAINT inventory_operating_systems_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_operating_systems ADD CONSTRAINT inventory_operating_systems_nome_key UNIQUE (nome);

CREATE TABLE public.inventory_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  patrimonio text NOT NULL,
  tipo text NOT NULL,
  fabricante text,
  modelo text,
  numero_serie text,
  responsavel_id uuid,
  localizacao text,
  status text DEFAULT 'ativo'::text NOT NULL,
  observacoes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  anydesk_id text,
  teamviewer_id text,
  computer_name text,
  operating_system text,
  ip_address text,
  mac_address text,
  category_id uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  type_id uuid,
  status_id uuid,
  manufacturer_id uuid,
  operating_system_id uuid,
  license_url text,
  license_username text,
  license_password text,
  license_expires_at date,
  license_quantity integer,
  license_alert_days integer[] DEFAULT ARRAY[30, 7] NOT NULL,
  bitlocker_id text,
  bitlocker_recovery_key text
);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_patrimonio_key UNIQUE (patrimonio);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES inventory_manufacturers(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_operating_system_id_fkey FOREIGN KEY (operating_system_id) REFERENCES inventory_operating_systems(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_status_id_fkey FOREIGN KEY (status_id) REFERENCES inventory_statuses(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_type_id_fkey FOREIGN KEY (type_id) REFERENCES inventory_types(id) ON DELETE RESTRICT;
CREATE INDEX idx_inv_not_deleted ON public.inventory_items USING btree (id) WHERE (deleted_at IS NULL);
CREATE INDEX inventory_items_category_id_idx ON public.inventory_items USING btree (category_id);
CREATE INDEX inventory_items_responsavel_id_idx ON public.inventory_items USING btree (responsavel_id);

CREATE TABLE public.kb_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  ativo boolean DEFAULT true NOT NULL
);
ALTER TABLE public.kb_categories ADD CONSTRAINT kb_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.kb_categories ADD CONSTRAINT kb_categories_slug_key UNIQUE (slug);

CREATE TABLE public.kb_content_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.kb_content_types ADD CONSTRAINT kb_content_types_pkey PRIMARY KEY (id);
ALTER TABLE public.kb_content_types ADD CONSTRAINT kb_content_types_slug_key UNIQUE (slug);

CREATE TABLE public.kb_articles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  slug text NOT NULL,
  conteudo text NOT NULL,
  categoria_id uuid,
  autor_id uuid NOT NULL,
  publicado boolean DEFAULT true NOT NULL,
  views integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  tipo_conteudo text DEFAULT 'artigo'::text NOT NULL
);
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_pkey PRIMARY KEY (id);
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_slug_key UNIQUE (slug);
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES kb_categories(id) ON DELETE SET NULL;
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
CREATE INDEX idx_kb_not_deleted ON public.kb_articles USING btree (id) WHERE (deleted_at IS NULL);

CREATE TABLE public.kb_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  article_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome text NOT NULL,
  tamanho bigint NOT NULL,
  mime text,
  enviado_por uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.kb_attachments ADD CONSTRAINT kb_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.kb_attachments ADD CONSTRAINT kb_attachments_article_id_fkey FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE;
ALTER TABLE public.kb_attachments ADD CONSTRAINT kb_attachments_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_kb_attachments_article ON public.kb_attachments USING btree (article_id);

CREATE TABLE public.ticket_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  cor text DEFAULT '#64748b'::text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_nome_key UNIQUE (nome);

CREATE TABLE public.ticket_priorities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  cor text DEFAULT '#64748b'::text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_priorities ADD CONSTRAINT ticket_priorities_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_priorities ADD CONSTRAINT ticket_priorities_nome_key UNIQUE (nome);

CREATE TABLE public.ticket_statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  cor text DEFAULT '#64748b'::text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  is_inicial boolean DEFAULT false NOT NULL,
  is_resolvido boolean DEFAULT false NOT NULL,
  is_fechado boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_statuses ADD CONSTRAINT ticket_statuses_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_statuses ADD CONSTRAINT ticket_statuses_nome_key UNIQUE (nome);

CREATE TABLE public.toners (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  modelo text NOT NULL,
  cor text NOT NULL,
  quantidade integer DEFAULT 0 NOT NULL,
  quantidade_minima integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.toners ADD CONSTRAINT toners_pkey PRIMARY KEY (id);
ALTER TABLE public.toners ADD CONSTRAINT toners_modelo_cor_key UNIQUE (modelo, cor);

CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero bigint DEFAULT nextval('tickets_numero_seq'::regclass) NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL,
  prioridade text DEFAULT 'Média'::text NOT NULL,
  status text DEFAULT 'Aberto'::text NOT NULL,
  criado_por uuid NOT NULL,
  responsavel_id uuid,
  solucao text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  resolvido_em timestamp with time zone,
  fechado_em timestamp with time zone,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  category_id uuid,
  priority_id uuid,
  status_id uuid,
  printer_id uuid,
  toner_id uuid,
  toner_baixado boolean DEFAULT false NOT NULL,
  first_response_at timestamp with time zone,
  sla_pause_started_at timestamp with time zone,
  sla_paused_seconds integer DEFAULT 0 NOT NULL,
  sla_finished_at timestamp with time zone
);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_numero_key UNIQUE (numero);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE RESTRICT;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_printer_id_fkey FOREIGN KEY (printer_id) REFERENCES inventory_items(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id) ON DELETE RESTRICT;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES ticket_statuses(id) ON DELETE RESTRICT;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_toner_id_fkey FOREIGN KEY (toner_id) REFERENCES toners(id) ON DELETE SET NULL;
CREATE INDEX idx_tickets_categoria ON public.tickets USING btree (categoria);
CREATE INDEX idx_tickets_criado_por ON public.tickets USING btree (criado_por);
CREATE INDEX idx_tickets_not_deleted ON public.tickets USING btree (id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_tickets_responsavel ON public.tickets USING btree (responsavel_id);
CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);

CREATE TABLE public.ticket_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  conteudo text NOT NULL,
  interno boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
CREATE INDEX idx_comments_ticket ON public.ticket_comments USING btree (ticket_id);

CREATE TABLE public.ticket_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome text NOT NULL,
  tamanho bigint NOT NULL,
  mime text,
  enviado_por uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_attachments ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_attachments ADD CONSTRAINT ticket_attachments_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ticket_attachments ADD CONSTRAINT ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
CREATE INDEX idx_attachments_ticket ON public.ticket_attachments USING btree (ticket_id);

CREATE TABLE public.ticket_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  autor_id uuid,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.ticket_history ADD CONSTRAINT ticket_history_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_history ADD CONSTRAINT ticket_history_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ticket_history ADD CONSTRAINT ticket_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
CREATE INDEX idx_history_ticket ON public.ticket_history USING btree (ticket_id);

CREATE TABLE public.sla_configs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  priority_id uuid NOT NULL,
  resolution_hours numeric DEFAULT 24 NOT NULL,
  first_response_minutes integer DEFAULT 60 NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.sla_configs ADD CONSTRAINT sla_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.sla_configs ADD CONSTRAINT sla_configs_priority_id_key UNIQUE (priority_id);
ALTER TABLE public.sla_configs ADD CONSTRAINT sla_configs_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id) ON DELETE CASCADE;

CREATE TABLE public.sla_status_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  status_id uuid NOT NULL,
  pause_sla boolean DEFAULT false NOT NULL,
  finish_sla boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.sla_status_rules ADD CONSTRAINT sla_status_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.sla_status_rules ADD CONSTRAINT sla_status_rules_status_id_key UNIQUE (status_id);
ALTER TABLE public.sla_status_rules ADD CONSTRAINT sla_rule_exclusive CHECK ((NOT (pause_sla AND finish_sla)));
ALTER TABLE public.sla_status_rules ADD CONSTRAINT sla_status_rules_status_id_fkey FOREIGN KEY (status_id) REFERENCES ticket_statuses(id) ON DELETE CASCADE;

CREATE TABLE public.printer_toner_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  inventory_item_id uuid NOT NULL,
  toner_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.printer_toner_links ADD CONSTRAINT printer_toner_links_pkey PRIMARY KEY (id);
ALTER TABLE public.printer_toner_links ADD CONSTRAINT printer_toner_links_inventory_item_id_toner_id_key UNIQUE (inventory_item_id, toner_id);
ALTER TABLE public.printer_toner_links ADD CONSTRAINT printer_toner_links_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
ALTER TABLE public.printer_toner_links ADD CONSTRAINT printer_toner_links_toner_id_fkey FOREIGN KEY (toner_id) REFERENCES toners(id) ON DELETE CASCADE;

CREATE TABLE public.printer_departments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  inventory_item_id uuid NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.printer_departments ADD CONSTRAINT printer_departments_pkey PRIMARY KEY (id);
ALTER TABLE public.printer_departments ADD CONSTRAINT printer_departments_inventory_item_id_department_id_key UNIQUE (inventory_item_id, department_id);
ALTER TABLE public.printer_departments ADD CONSTRAINT printer_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE public.printer_departments ADD CONSTRAINT printer_departments_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
CREATE INDEX idx_printer_departments_dept ON public.printer_departments USING btree (department_id);
CREATE INDEX idx_printer_departments_item ON public.printer_departments USING btree (inventory_item_id);

CREATE TABLE public.toner_movements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  toner_id uuid NOT NULL,
  inventory_item_id uuid,
  tipo text NOT NULL,
  quantidade integer NOT NULL,
  origem text NOT NULL,
  ticket_id uuid,
  observacoes text,
  responsavel_id uuid,
  data timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_pkey PRIMARY KEY (id);
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_quantidade_check CHECK ((quantidade > 0));
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_origem_check CHECK ((origem = ANY (ARRAY['recebimento_manual'::text, 'chamado_resolvido'::text, 'ajuste'::text])));
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE public.toner_movements ADD CONSTRAINT toner_movements_toner_id_fkey FOREIGN KEY (toner_id) REFERENCES toners(id) ON DELETE CASCADE;
CREATE INDEX idx_toner_mov_item ON public.toner_movements USING btree (inventory_item_id);
CREATE INDEX idx_toner_mov_toner ON public.toner_movements USING btree (toner_id);

CREATE TABLE public.reservation_resources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type resource_type NOT NULL,
  description text,
  patrimonio text,
  status resource_status DEFAULT 'disponivel'::resource_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.reservation_resources ADD CONSTRAINT reservation_resources_pkey PRIMARY KEY (id);

CREATE TABLE public.reservations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  resource_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  start_datetime timestamp with time zone NOT NULL,
  end_datetime timestamp with time zone NOT NULL,
  status reservation_status DEFAULT 'reservado'::reservation_status NOT NULL,
  linked_ticket_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  parent_reservation_id uuid
);
ALTER TABLE public.reservations ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);
ALTER TABLE public.reservations ADD CONSTRAINT reservations_check CHECK ((end_datetime > start_datetime));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_linked_ticket_id_fkey FOREIGN KEY (linked_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_parent_reservation_id_fkey FOREIGN KEY (parent_reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES reservation_resources(id) ON DELETE CASCADE;
CREATE INDEX idx_reservations_resource ON public.reservations USING btree (resource_id, start_datetime);
CREATE INDEX idx_reservations_user ON public.reservations USING btree (user_id);
CREATE INDEX reservations_parent_idx ON public.reservations USING btree (parent_reservation_id);

CREATE TABLE public.reservation_blocked_dates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  data date NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);
ALTER TABLE public.reservation_blocked_dates ADD CONSTRAINT reservation_blocked_dates_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_blocked_dates ADD CONSTRAINT reservation_blocked_dates_data_key UNIQUE (data);

CREATE TABLE public.reservation_settings (
  id boolean DEFAULT true NOT NULL,
  block_weekends boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.reservation_settings ADD CONSTRAINT reservation_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_settings ADD CONSTRAINT reservation_settings_id_check CHECK ((id = true));

CREATE TABLE public.room_reservations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  data date NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fim time without time zone NOT NULL,
  departamento text NOT NULL,
  assunto text NOT NULL,
  observacoes text,
  equipamentos text[] DEFAULT '{}'::text[] NOT NULL,
  ticket_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.room_reservations ADD CONSTRAINT room_reservations_pkey PRIMARY KEY (id);
ALTER TABLE public.room_reservations ADD CONSTRAINT room_reservations_hora_check CHECK ((hora_fim > hora_inicio));
ALTER TABLE public.room_reservations ADD CONSTRAINT room_reservations_weekday_check CHECK (((EXTRACT(dow FROM data) >= (1)::numeric) AND (EXTRACT(dow FROM data) <= (5)::numeric)));
ALTER TABLE public.room_reservations ADD CONSTRAINT room_reservations_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE public.room_reservations ADD CONSTRAINT room_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.room_reservations ADD CONSTRAINT room_reservations_no_overlap EXCLUDE USING gist (tsrange((data + hora_inicio), (data + hora_fim), '[)'::text) WITH &&);
CREATE INDEX room_reservations_data_idx ON public.room_reservations USING btree (data);
CREATE INDEX room_reservations_user_idx ON public.room_reservations USING btree (user_id);

CREATE TABLE public.task_columns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_final boolean DEFAULT false NOT NULL,
  owner_id uuid,
  department_id uuid
);
ALTER TABLE public.task_columns ADD CONSTRAINT task_columns_pkey PRIMARY KEY (id);
ALTER TABLE public.task_columns ADD CONSTRAINT task_columns_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
CREATE INDEX idx_task_columns_department_id ON public.task_columns USING btree (department_id);
CREATE INDEX idx_task_columns_owner ON public.task_columns USING btree (owner_id);

CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  descricao text,
  prioridade text DEFAULT 'media'::text NOT NULL,
  column_id uuid NOT NULL,
  assignee_id uuid,
  created_by uuid,
  "position" integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  finished_by uuid,
  color text,
  owner_id uuid,
  department_id uuid
);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_column_id_fkey FOREIGN KEY (column_id) REFERENCES task_columns(id) ON DELETE RESTRICT;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_column ON public.tasks USING btree (column_id);
CREATE INDEX idx_tasks_department_id ON public.tasks USING btree (department_id);
CREATE INDEX idx_tasks_owner ON public.tasks USING btree (owner_id);
CREATE INDEX tasks_finished_at_idx ON public.tasks USING btree (finished_at);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  ticket_id uuid,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_notif_user ON public.notifications USING btree (user_id, lida);

CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  dashboard_view text DEFAULT 'chamados'::text NOT NULL,
  tickets_filter_status text DEFAULT 'todos'::text NOT NULL,
  tickets_filter_categoria text DEFAULT 'todos'::text NOT NULL,
  tickets_filter_prioridade text DEFAULT 'todos'::text NOT NULL,
  tickets_filter_q text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_dashboard_view_check CHECK ((dashboard_view = ANY (ARRAY['chamados'::text, 'inventario'::text])));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.tickets_numero_seq TO authenticated, service_role;
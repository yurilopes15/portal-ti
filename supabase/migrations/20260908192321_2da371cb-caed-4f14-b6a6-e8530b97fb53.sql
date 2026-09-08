CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.is_ti(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('tecnico','admin'))
$function$;

CREATE OR REPLACE FUNCTION public.current_department_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.id
  FROM public.profiles p
  JOIN public.departments d ON lower(trim(d.nome)) = lower(trim(p.departamento))
  WHERE p.id = auth.uid()
    AND p.departamento IS NOT NULL
    AND d.ativo = true
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END;$function$;

CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _entity_type text, _entity_id uuid, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, _action, _entity_type, _entity_id, _metadata);
END;$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_entity(_entity_type text, _entity_id uuid, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END;$function$;

CREATE OR REPLACE FUNCTION public.restore_entity(_entity_type text, _entity_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END;$function$;

CREATE OR REPLACE FUNCTION public.log_ticket_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END;$function$;

CREATE OR REPLACE FUNCTION public.notify_ticket_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_target UUID; v_actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_target IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE role IN ('tecnico','admin') AND user_id <> COALESCE(v_actor, NEW.criado_por)
    LOOP
      INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
      VALUES (v_target, NEW.id, 'Novo chamado aberto: ' || NEW.titulo, 'Chamado #' || NEW.numero);
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.criado_por <> COALESCE(v_actor, NEW.criado_por) THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (NEW.criado_por, NEW.id, 'Chamado #'||NEW.numero||' atualizado', 'Status: '||NEW.status::text);
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     AND NEW.responsavel_id IS NOT NULL
     AND NEW.responsavel_id <> COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
    VALUES (NEW.responsavel_id, NEW.id, 'Chamado #'||NEW.numero||' atribuído a você', NEW.titulo);
  END IF;

  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.notify_comment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket RECORD;
  v_autor_nome text;
  v_autor_ti boolean;
  v_target uuid;
  v_titulo text;
  v_msg text;
BEGIN
  SELECT criado_por, responsavel_id, numero, titulo INTO v_ticket
  FROM public.tickets WHERE id = NEW.ticket_id;

  SELECT COALESCE(nome, 'Usuário') INTO v_autor_nome FROM public.profiles WHERE id = NEW.autor_id;
  v_autor_nome := COALESCE(v_autor_nome, 'Usuário');

  v_autor_ti := public.has_role(NEW.autor_id, 'admin') OR public.has_role(NEW.autor_id, 'tecnico');

  v_titulo := v_autor_nome || ' enviou uma nova atualização no chamado #' || v_ticket.numero;
  v_msg := v_ticket.titulo;

  IF v_autor_ti THEN
    IF NOT NEW.interno AND v_ticket.criado_por <> NEW.autor_id THEN
      INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
      VALUES (v_ticket.criado_por, NEW.ticket_id, v_titulo, v_msg);
    END IF;
  ELSE
    IF v_ticket.responsavel_id IS NOT NULL AND v_ticket.responsavel_id <> NEW.autor_id THEN
      INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
      VALUES (v_ticket.responsavel_id, NEW.ticket_id, v_titulo, v_msg);
    ELSIF v_ticket.responsavel_id IS NULL THEN
      FOR v_target IN
        SELECT DISTINCT user_id FROM public.user_roles
        WHERE role IN ('tecnico','admin') AND user_id <> NEW.autor_id
      LOOP
        INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
        VALUES (v_target, NEW.ticket_id, v_titulo, v_msg);
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.set_ticket_first_response()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.autor_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_ti(NEW.autor_id) THEN RETURN NEW; END IF;
  UPDATE public.tickets
    SET first_response_at = now()
  WHERE id = NEW.ticket_id AND first_response_at IS NULL;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.set_ticket_timestamps()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
END;$function$;

CREATE OR REPLACE FUNCTION public.apply_sla_status_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_new_status_id UUID;
  v_old_status_id UUID;
  v_pause BOOLEAN := false;
  v_finish BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_status_id := NULL;
  ELSE
    IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
      RETURN NEW;
    END IF;
    IF OLD.status_id IS NOT NULL THEN
      v_old_status_id := OLD.status_id;
    ELSIF OLD.status IS NOT NULL THEN
      SELECT id INTO v_old_status_id FROM public.ticket_statuses WHERE nome = OLD.status;
    END IF;
  END IF;

  IF NEW.status_id IS NOT NULL THEN
    v_new_status_id := NEW.status_id;
  ELSIF NEW.status IS NOT NULL THEN
    SELECT id INTO v_new_status_id FROM public.ticket_statuses WHERE nome = NEW.status;
  END IF;

  IF v_new_status_id IS NOT NULL THEN
    SELECT pause_sla, finish_sla INTO v_pause, v_finish
      FROM public.sla_status_rules WHERE status_id = v_new_status_id;
  END IF;
  v_pause := COALESCE(v_pause, false);
  v_finish := COALESCE(v_finish, false);

  IF NOT v_pause AND NEW.sla_pause_started_at IS NOT NULL THEN
    NEW.sla_paused_seconds := COALESCE(NEW.sla_paused_seconds, 0)
      + GREATEST(0, EXTRACT(EPOCH FROM (now() - NEW.sla_pause_started_at))::INTEGER);
    NEW.sla_pause_started_at := NULL;
  END IF;

  IF v_pause AND NEW.sla_pause_started_at IS NULL THEN
    NEW.sla_pause_started_at := now();
  END IF;

  IF v_finish THEN
    IF NEW.sla_pause_started_at IS NOT NULL THEN
      NEW.sla_paused_seconds := COALESCE(NEW.sla_paused_seconds, 0)
        + GREATEST(0, EXTRACT(EPOCH FROM (now() - NEW.sla_pause_started_at))::INTEGER);
      NEW.sla_pause_started_at := NULL;
    END IF;
    IF NEW.sla_finished_at IS NULL THEN
      NEW.sla_finished_at := now();
    END IF;
  ELSE
    NEW.sla_finished_at := NULL;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.process_ticket_toner_discharge()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_is_resolvido BOOLEAN := false;
  v_cat_nome TEXT;
  v_toner RECORD;
  v_new_qtd INTEGER;
  v_tecnico UUID;
BEGIN
  IF NEW.toner_baixado THEN RETURN NEW; END IF;
  IF NEW.toner_id IS NULL THEN RETURN NEW; END IF;

  SELECT LOWER(c.nome) INTO v_cat_nome FROM public.ticket_categories c WHERE c.id = NEW.category_id;
  IF v_cat_nome IS NULL THEN v_cat_nome := LOWER(COALESCE(NEW.categoria, '')); END IF;
  IF v_cat_nome NOT LIKE 'toner%' THEN RETURN NEW; END IF;

  IF NEW.status_id IS NOT NULL THEN
    SELECT is_resolvido INTO v_is_resolvido FROM public.ticket_statuses WHERE id = NEW.status_id;
  ELSIF NEW.status IS NOT NULL THEN
    SELECT is_resolvido INTO v_is_resolvido FROM public.ticket_statuses WHERE nome = NEW.status;
  END IF;
  IF NOT COALESCE(v_is_resolvido, false) THEN RETURN NEW; END IF;

  SELECT * INTO v_toner FROM public.toners WHERE id = NEW.toner_id FOR UPDATE;
  IF v_toner.id IS NULL THEN RETURN NEW; END IF;

  v_new_qtd := GREATEST(0, v_toner.quantidade - 1);
  UPDATE public.toners SET quantidade = v_new_qtd WHERE id = v_toner.id;

  INSERT INTO public.toner_movements (toner_id, inventory_item_id, tipo, quantidade, origem, ticket_id, responsavel_id, observacoes)
  VALUES (v_toner.id, NEW.printer_id, 'saida', 1, 'chamado_resolvido', NEW.id,
          COALESCE(NEW.responsavel_id, auth.uid()),
          'Baixa automática ao resolver chamado #' || NEW.numero);

  NEW.toner_baixado := true;

  IF v_new_qtd <= v_toner.quantidade_minima THEN
    FOR v_tecnico IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('tecnico','admin') LOOP
      INSERT INTO public.notifications (user_id, ticket_id, titulo, mensagem)
      VALUES (v_tecnico, NEW.id,
              'Estoque de toner ' || (CASE WHEN v_new_qtd = 0 THEN 'ZERADO' ELSE 'BAIXO' END),
              'Toner ' || v_toner.modelo || ' (' || v_toner.cor || ') atingiu ' || v_new_qtd || ' unidade(s).');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_reservation_blocked()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_block_weekends BOOLEAN; v_dow INT;
BEGIN
  IF NEW.status <> 'reservado' THEN RETURN NEW; END IF;
  SELECT block_weekends INTO v_block_weekends FROM public.reservation_settings WHERE id = true;
  v_dow := EXTRACT(DOW FROM NEW.start_datetime);
  IF COALESCE(v_block_weekends, false) AND (v_dow = 0 OR v_dow = 6) THEN
    RAISE EXCEPTION 'Reservas não são permitidas em finais de semana.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservation_blocked_dates b
    WHERE b.data >= NEW.start_datetime::date
      AND b.data <= NEW.end_datetime::date
  ) THEN
    RAISE EXCEPTION 'A data selecionada está bloqueada para reservas.';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'reservado' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.resource_id = NEW.resource_id
      AND r.id <> NEW.id
      AND r.status = 'reservado'
      AND r.start_datetime < NEW.end_datetime
      AND r.end_datetime > NEW.start_datetime
  ) THEN
    RAISE EXCEPTION 'Já existe uma reserva para este recurso no intervalo selecionado.';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--3025a6dd-b313-4517-a5ee-5303b289f649.lovable.app/api/public/hooks/push-dispatch',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZ25xYmJ1YnJld3FoY3plZHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODk5NzEsImV4cCI6MjEwNDQ2NTk3MX0.AdBO4KorUyLqIlQJdOj5NK5QDsNuaGIxJ51gjCy98rk"}'::jsonb,
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_ti(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_department_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_entity(text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_entity(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ticket_changes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_comment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_ticket_first_response() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sla_status_transition() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_ticket_toner_discharge() FROM anon, authenticated;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Regras de notificação de comentários/movimentações
CREATE OR REPLACE FUNCTION public.notify_comment() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    -- Técnico/Admin -> usuário que abriu o chamado
    IF NOT NEW.interno AND v_ticket.criado_por <> NEW.autor_id THEN
      INSERT INTO public.notifications(user_id, ticket_id, titulo, mensagem)
      VALUES (v_ticket.criado_por, NEW.ticket_id, v_titulo, v_msg);
    END IF;
  ELSE
    -- Usuário -> responsável, ou todos os técnicos/admins se não houver responsável
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
END;$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_event() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END;$$;

-- Dispara o envio de push para cada notificação criada
CREATE OR REPLACE FUNCTION public.dispatch_push_notification() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--559e0cfe-33a6-4328-a027-70900e6db12a.lovable.app/api/public/hooks/push-dispatch',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aWJnbHpmY2t1eGZibXFnZXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzIwMTcsImV4cCI6MjA5Nzg0ODAxN30.epBGxWsn_CmbH5q2PKq0YNo5XKx3RAIChhGzjjG841k"}'::jsonb,
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.notifications;
CREATE TRIGGER trg_dispatch_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();
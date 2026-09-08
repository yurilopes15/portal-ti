CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'usuario');
  v_role_id uuid;
BEGIN
  INSERT INTO public.profiles (id, nome, email, departamento, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'departamento',
    NEW.raw_user_meta_data->>'telefone'
  ) ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_role_id FROM public.roles WHERE slug = v_role::text LIMIT 1;

  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, v_role, v_role_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;$function$;
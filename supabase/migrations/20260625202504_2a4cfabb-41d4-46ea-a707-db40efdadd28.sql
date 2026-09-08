
-- 0. Remove política em inventory_items que depende de printer_toners
DROP POLICY IF EXISTS "Ve impressoras com toner cadastrado" ON public.inventory_items;

-- 1. Tabela consolidada de toners
CREATE TABLE public.toners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo text NOT NULL,
  cor text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  quantidade_minima integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modelo, cor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toners TO authenticated;
GRANT ALL ON public.toners TO service_role;
ALTER TABLE public.toners ENABLE ROW LEVEL SECURITY;
CREATE POLICY toners_select_all ON public.toners FOR SELECT USING (true);
CREATE POLICY toners_ti_manage ON public.toners FOR ALL USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));
CREATE TRIGGER trg_toners_updated_at BEFORE UPDATE ON public.toners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Migra dados consolidando por (modelo, cor)
INSERT INTO public.toners (modelo, cor, quantidade, quantidade_minima)
SELECT modelo, cor::text, COALESCE(SUM(quantidade),0)::int, GREATEST(COALESCE(MAX(quantidade_minima),1),1)::int
FROM public.printer_toners
GROUP BY modelo, cor::text;

-- 3. Vínculo impressora x toner (many-to-many)
CREATE TABLE public.printer_toner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  toner_id uuid NOT NULL REFERENCES public.toners(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_item_id, toner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_toner_links TO authenticated;
GRANT ALL ON public.printer_toner_links TO service_role;
ALTER TABLE public.printer_toner_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptl_select_all ON public.printer_toner_links FOR SELECT USING (true);
CREATE POLICY ptl_ti_manage ON public.printer_toner_links FOR ALL USING (public.is_ti(auth.uid())) WITH CHECK (public.is_ti(auth.uid()));

INSERT INTO public.printer_toner_links (inventory_item_id, toner_id)
SELECT DISTINCT pt.inventory_item_id, t.id
FROM public.printer_toners pt
JOIN public.toners t ON t.modelo = pt.modelo AND t.cor = pt.cor::text
ON CONFLICT DO NOTHING;

-- 4. Recria política em inventory_items usando o novo vínculo
CREATE POLICY "Ve impressoras com toner cadastrado" ON public.inventory_items
FOR SELECT USING (
  (deleted_at IS NULL) AND EXISTS (
    SELECT 1 FROM public.printer_toner_links ptl WHERE ptl.inventory_item_id = inventory_items.id
  )
);

-- 5. Reaponta tickets.toner_id
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_toner_id_fkey;
UPDATE public.tickets tk
SET toner_id = t.id
FROM public.printer_toners pt
JOIN public.toners t ON t.modelo = pt.modelo AND t.cor = pt.cor::text
WHERE tk.toner_id = pt.id;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_toner_id_fkey FOREIGN KEY (toner_id) REFERENCES public.toners(id) ON DELETE SET NULL;

-- 6. Reaponta toner_movements
ALTER TABLE public.toner_movements DROP CONSTRAINT IF EXISTS toner_movements_printer_toner_id_fkey;
ALTER TABLE public.toner_movements RENAME COLUMN printer_toner_id TO toner_id;
UPDATE public.toner_movements tm
SET toner_id = t.id
FROM public.printer_toners pt
JOIN public.toners t ON t.modelo = pt.modelo AND t.cor = pt.cor::text
WHERE tm.toner_id = pt.id;
ALTER TABLE public.toner_movements
  ADD CONSTRAINT toner_movements_toner_id_fkey FOREIGN KEY (toner_id) REFERENCES public.toners(id) ON DELETE CASCADE;
ALTER TABLE public.toner_movements ALTER COLUMN inventory_item_id DROP NOT NULL;

-- 7. Remove tabela antiga
DROP TABLE public.printer_toners;

-- 8. Atualiza trigger de baixa automática
CREATE OR REPLACE FUNCTION public.process_ticket_toner_discharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

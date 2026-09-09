DROP VIEW IF EXISTS public.inventory_items_safe;

CREATE OR REPLACE FUNCTION public.inventory_safe()
RETURNS TABLE (
  id uuid, patrimonio text, tipo text, category_id uuid, fabricante text, modelo text,
  numero_serie text, computer_name text, operating_system text, operating_system_id uuid,
  localizacao text, status text, status_id uuid, responsavel_id uuid, observacoes text,
  ip_address text, mac_address text, anydesk_id text, teamviewer_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.patrimonio, i.tipo, i.category_id, i.fabricante, i.modelo,
         i.numero_serie, i.computer_name, i.operating_system, i.operating_system_id,
         i.localizacao, i.status, i.status_id, i.responsavel_id, i.observacoes,
         CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.ip_address END,
         CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.mac_address END,
         CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.anydesk_id END,
         CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.teamviewer_id END
  FROM public.inventory_items i
  WHERE i.deleted_at IS NULL
    AND auth.uid() IS NOT NULL
    AND (
      public.is_ti(auth.uid())
      OR i.responsavel_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.printer_toner_links ptl WHERE ptl.inventory_item_id = i.id)
    );
$$;

REVOKE ALL ON FUNCTION public.inventory_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_safe() TO authenticated, service_role;
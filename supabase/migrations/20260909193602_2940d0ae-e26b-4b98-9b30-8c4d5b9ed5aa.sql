-- 1) Storage: anexos de chamados
DROP POLICY IF EXISTS "ticket files read" ON storage.objects;
CREATE POLICY "ticket files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.ticket_attachments ta
    JOIN public.tickets t ON t.id = ta.ticket_id
    WHERE ta.storage_path = storage.objects.name
      AND (t.criado_por = auth.uid() OR public.is_ti(auth.uid()))
  )
);

DROP POLICY IF EXISTS "ticket files delete" ON storage.objects;
CREATE POLICY "ticket files delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND (owner = auth.uid() OR public.is_ti(auth.uid()))
);

-- 2) Storage: anexos da base de conhecimento
DROP POLICY IF EXISTS "kb files read" ON storage.objects;
CREATE POLICY "kb files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kb-attachments' AND EXISTS (
    SELECT 1 FROM public.kb_attachments ka
    JOIN public.kb_articles a ON a.id = ka.article_id
    WHERE ka.storage_path = storage.objects.name
      AND a.deleted_at IS NULL
      AND (a.publicado = true OR public.is_ti(auth.uid()))
  )
);

DROP POLICY IF EXISTS "kb files delete" ON storage.objects;
CREATE POLICY "kb files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kb-attachments' AND public.is_ti(auth.uid()));

-- 3) Inventário: tabela base apenas para TI
DROP POLICY IF EXISTS "Ve impressoras com toner cadastrado" ON public.inventory_items;
DROP POLICY IF EXISTS "Ve inventario" ON public.inventory_items;
CREATE POLICY "TI ve inventario" ON public.inventory_items FOR SELECT TO authenticated
USING ((deleted_at IS NULL OR public.has_role(auth.uid(), 'admin')) AND public.is_ti(auth.uid()));

-- 4) Visão segura para usuários comuns (sem BitLocker nem credenciais de licença)
CREATE OR REPLACE VIEW public.inventory_items_safe
WITH (security_barrier = true) AS
SELECT
  i.id, i.patrimonio, i.tipo, i.category_id, i.fabricante, i.modelo, i.numero_serie,
  i.computer_name, i.operating_system, i.operating_system_id, i.localizacao,
  i.status, i.status_id, i.responsavel_id, i.observacoes, i.deleted_at,
  CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.ip_address END AS ip_address,
  CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.mac_address END AS mac_address,
  CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.anydesk_id END AS anydesk_id,
  CASE WHEN public.is_ti(auth.uid()) OR i.responsavel_id = auth.uid() THEN i.teamviewer_id END AS teamviewer_id
FROM public.inventory_items i
WHERE i.deleted_at IS NULL
  AND (
    public.is_ti(auth.uid())
    OR i.responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.printer_toner_links ptl WHERE ptl.inventory_item_id = i.id)
  );

REVOKE ALL ON public.inventory_items_safe FROM anon;
GRANT SELECT ON public.inventory_items_safe TO authenticated;
GRANT ALL ON public.inventory_items_safe TO service_role;
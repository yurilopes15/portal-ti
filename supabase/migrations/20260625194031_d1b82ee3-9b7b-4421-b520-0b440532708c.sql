CREATE POLICY "Ve impressoras com toner cadastrado"
ON public.inventory_items
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.printer_toners pt WHERE pt.inventory_item_id = inventory_items.id
  )
);
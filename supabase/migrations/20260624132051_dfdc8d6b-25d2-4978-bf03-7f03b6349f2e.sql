
-- Storage RLS for ticket-attachments and kb-attachments
CREATE POLICY "ticket_attach_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments');
CREATE POLICY "ticket_attach_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');
CREATE POLICY "ticket_attach_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "kb_attach_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kb-attachments');
CREATE POLICY "kb_attach_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kb-attachments' AND public.is_ti(auth.uid()));
CREATE POLICY "kb_attach_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kb-attachments' AND public.is_ti(auth.uid()));

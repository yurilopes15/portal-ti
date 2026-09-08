
-- Storage policies for ticket-attachments
CREATE POLICY "Ve anexos chamado proprio ou TI" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'ticket-attachments' AND (
      public.is_ti(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.criado_por = auth.uid()
          AND (storage.foldername(name))[1] = t.id::text
      )
    )
  );

CREATE POLICY "Envia anexo proprio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'ticket-attachments' AND (
      public.is_ti(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.criado_por = auth.uid()
          AND (storage.foldername(name))[1] = t.id::text
      )
    )
  );

CREATE POLICY "Deleta anexo proprio ou TI" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'ticket-attachments' AND (
      public.is_ti(auth.uid()) OR owner = auth.uid()
    )
  );

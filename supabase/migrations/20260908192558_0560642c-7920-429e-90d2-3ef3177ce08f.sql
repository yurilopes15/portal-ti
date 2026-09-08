ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads audit log" ON public.audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios veem proprio perfil" ON public.profiles FOR SELECT TO authenticated USING ((((deleted_at IS NULL) OR has_role(auth.uid(), 'admin'::app_role)) AND ((auth.uid() = id) OR is_ti(auth.uid()))));
CREATE POLICY "Usuarios atualizam proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Admin gerencia perfis" ON public.profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios veem proprio papel" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_ti(auth.uid())));
CREATE POLICY "Admin gerencia papeis" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read categories" ON public.inventory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti manage categories" ON public.inventory_categories FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.inventory_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_types" ON public.inventory_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_types" ON public.inventory_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.inventory_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_statuses" ON public.inventory_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_statuses" ON public.inventory_statuses FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.inventory_manufacturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_manufacturers" ON public.inventory_manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_manufacturers" ON public.inventory_manufacturers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.inventory_operating_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inventory_os" ON public.inventory_operating_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage inventory_os" ON public.inventory_operating_systems FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve inventario" ON public.inventory_items FOR SELECT TO authenticated USING ((((deleted_at IS NULL) OR has_role(auth.uid(), 'admin'::app_role)) AND (is_ti(auth.uid()) OR (responsavel_id = auth.uid()))));
CREATE POLICY "TI gerencia inventario" ON public.inventory_items FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));
CREATE POLICY "Ve impressoras com toner cadastrado" ON public.inventory_items FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1 FROM printer_toner_links ptl WHERE (ptl.inventory_item_id = inventory_items.id)))));

ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos veem categorias KB" ON public.kb_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "TI gerencia categorias KB" ON public.kb_categories FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.kb_content_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view content types" ON public.kb_content_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "TI can insert content types" ON public.kb_content_types FOR INSERT TO authenticated WITH CHECK (is_ti(auth.uid()));
CREATE POLICY "TI can update content types" ON public.kb_content_types FOR UPDATE TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));
CREATE POLICY "Admins can delete content types" ON public.kb_content_types FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve artigos publicados" ON public.kb_articles FOR SELECT TO authenticated USING ((((deleted_at IS NULL) OR has_role(auth.uid(), 'admin'::app_role)) AND ((publicado = true) OR is_ti(auth.uid()))));
CREATE POLICY "TI gerencia artigos" ON public.kb_articles FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.kb_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve anexos de artigos visiveis" ON public.kb_attachments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM kb_articles a WHERE ((a.id = kb_attachments.article_id) AND ((a.deleted_at IS NULL) OR has_role(auth.uid(), 'admin'::app_role)) AND ((a.publicado = true) OR is_ti(auth.uid()))))));
CREATE POLICY "TI gerencia anexos KB" ON public.kb_attachments FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK ((is_ti(auth.uid()) AND (enviado_por = auth.uid())));

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ticket_categories" ON public.ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ticket_categories" ON public.ticket_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ticket_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ticket_priorities" ON public.ticket_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ticket_priorities" ON public.ticket_priorities FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ticket_statuses" ON public.ticket_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ticket_statuses" ON public.ticket_statuses FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve seus tickets" ON public.tickets FOR SELECT TO authenticated USING ((((deleted_at IS NULL) OR has_role(auth.uid(), 'admin'::app_role)) AND ((criado_por = auth.uid()) OR is_ti(auth.uid()))));
CREATE POLICY "Usuario cria ticket" ON public.tickets FOR INSERT TO authenticated WITH CHECK ((criado_por = auth.uid()));
CREATE POLICY "TI atualiza tickets" ON public.tickets FOR UPDATE TO authenticated USING ((is_ti(auth.uid()) OR (criado_por = auth.uid()))) WITH CHECK ((is_ti(auth.uid()) OR (criado_por = auth.uid())));
CREATE POLICY "Admin deleta tickets" ON public.tickets FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve comentarios do ticket" ON public.ticket_comments FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1 FROM tickets t WHERE ((t.id = ticket_comments.ticket_id) AND ((t.criado_por = auth.uid()) OR is_ti(auth.uid()))))) AND ((NOT interno) OR is_ti(auth.uid()))));
CREATE POLICY "Cria comentario" ON public.ticket_comments FOR INSERT TO authenticated WITH CHECK (((autor_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM tickets t WHERE ((t.id = ticket_comments.ticket_id) AND ((t.criado_por = auth.uid()) OR is_ti(auth.uid()))))) AND ((NOT interno) OR is_ti(auth.uid()))));

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve anexos do ticket" ON public.ticket_attachments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM tickets t WHERE ((t.id = ticket_attachments.ticket_id) AND ((t.criado_por = auth.uid()) OR is_ti(auth.uid()))))));
CREATE POLICY "Envia anexo" ON public.ticket_attachments FOR INSERT TO authenticated WITH CHECK (((enviado_por = auth.uid()) AND (EXISTS ( SELECT 1 FROM tickets t WHERE ((t.id = ticket_attachments.ticket_id) AND ((t.criado_por = auth.uid()) OR is_ti(auth.uid())))))));
CREATE POLICY "Deleta proprio anexo" ON public.ticket_attachments FOR DELETE TO authenticated USING (((enviado_por = auth.uid()) OR is_ti(auth.uid())));

ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve historico" ON public.ticket_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM tickets t WHERE ((t.id = ticket_history.ticket_id) AND ((t.criado_por = auth.uid()) OR is_ti(auth.uid()))))));

ALTER TABLE public.sla_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_configs read auth" ON public.sla_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_configs admin write" ON public.sla_configs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.sla_status_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_status_rules read auth" ON public.sla_status_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_status_rules admin write" ON public.sla_status_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.toners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "toners_select_all" ON public.toners FOR SELECT TO authenticated USING (true);
CREATE POLICY "toners_ti_manage" ON public.toners FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.toner_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "toner_mov_select_all" ON public.toner_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "toner_mov_ti_manage" ON public.toner_movements FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.printer_toner_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptl_select_all" ON public.printer_toner_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "ptl_ti_manage" ON public.printer_toner_links FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.printer_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "printer_dept_select_all" ON public.printer_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "printer_dept_ti_manage" ON public.printer_departments FOR ALL TO authenticated USING (is_ti(auth.uid())) WITH CHECK (is_ti(auth.uid()));

ALTER TABLE public.reservation_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read resources" ON public.reservation_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage resources" ON public.reservation_resources FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read reservations" ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Owners or admins update reservations" ON public.reservations FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Owners or admins delete reservations" ON public.reservations FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER TABLE public.reservation_blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read blocked dates" ON public.reservation_blocked_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage blocked dates" ON public.reservation_blocked_dates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.reservation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read reservation settings" ON public.reservation_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage reservation settings" ON public.reservation_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.room_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view reservations" ON public.room_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own reservations" ON public.room_reservations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Owner or admin delete" ON public.room_reservations FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia proprio quadro" ON public.task_columns FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "TI gerencia quadro da equipe" ON public.task_columns FOR ALL TO authenticated USING (((owner_id IS NULL) AND (department_id IS NULL) AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))) WITH CHECK (((owner_id IS NULL) AND (department_id IS NULL) AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY "Departamento gerencia seu quadro" ON public.task_columns FOR ALL TO authenticated USING (((department_id IS NOT NULL) AND (department_id = current_department_id()))) WITH CHECK (((department_id IS NOT NULL) AND (department_id = current_department_id())));

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia proprias tarefas" ON public.tasks FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "TI gerencia tarefas da equipe" ON public.tasks FOR ALL TO authenticated USING (((owner_id IS NULL) AND (department_id IS NULL) AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))) WITH CHECK (((owner_id IS NULL) AND (department_id IS NULL) AND (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY "Departamento gerencia suas tarefas" ON public.tasks FOR ALL TO authenticated USING (((department_id IS NOT NULL) AND (department_id = current_department_id()))) WITH CHECK (((department_id IS NOT NULL) AND (department_id = current_department_id())));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ve proprias notificacoes" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Cria notificacao restrita" ON public.notifications FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR is_ti(auth.uid())));
CREATE POLICY "Atualiza propria notificacao" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Deleta propria notificacao" ON public.notifications FOR DELETE TO authenticated USING ((user_id = auth.uid()));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_pref_select_own" ON public.user_preferences FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "user_pref_insert_own" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "user_pref_update_own" ON public.user_preferences FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "user_pref_delete_own" ON public.user_preferences FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER inventory_categories_updated_at BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_types_updated BEFORE UPDATE ON public.inventory_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_statuses_updated BEFORE UPDATE ON public.inventory_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_manufacturers_updated BEFORE UPDATE ON public.inventory_manufacturers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_os_updated BEFORE UPDATE ON public.inventory_operating_systems FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER kb_updated_at BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_kb_content_types_updated BEFORE UPDATE ON public.kb_content_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ticket_categories_updated BEFORE UPDATE ON public.ticket_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ticket_priorities_updated BEFORE UPDATE ON public.ticket_priorities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ticket_statuses_updated BEFORE UPDATE ON public.ticket_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER sla_configs_updated_at BEFORE UPDATE ON public.sla_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER sla_status_rules_updated_at BEFORE UPDATE ON public.sla_status_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_toners_updated_at BEFORE UPDATE ON public.toners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_reservation_resources_updated BEFORE UPDATE ON public.reservation_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_room_reservations_updated_at BEFORE UPDATE ON public.room_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_columns_updated_at BEFORE UPDATE ON public.task_columns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_ticket_timestamps_trg BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION set_ticket_timestamps();
CREATE TRIGGER trg_apply_sla_status_transition BEFORE INSERT OR UPDATE OF status, status_id ON public.tickets FOR EACH ROW EXECUTE FUNCTION apply_sla_status_transition();
CREATE TRIGGER trg_ticket_toner_discharge BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION process_ticket_toner_discharge();
CREATE TRIGGER tickets_log_insert AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_ticket_changes();
CREATE TRIGGER tickets_log_update AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_ticket_changes();
CREATE TRIGGER tickets_notify_insert AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION notify_ticket_event();
CREATE TRIGGER tickets_notify_update AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION notify_ticket_event();
CREATE TRIGGER comments_notify AFTER INSERT ON public.ticket_comments FOR EACH ROW EXECUTE FUNCTION notify_comment();
CREATE TRIGGER trg_set_ticket_first_response AFTER INSERT ON public.ticket_comments FOR EACH ROW EXECUTE FUNCTION set_ticket_first_response();

CREATE TRIGGER trg_check_reservation_blocked BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION check_reservation_blocked();
CREATE TRIGGER trg_reservations_overlap BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION check_reservation_overlap();

CREATE TRIGGER trg_dispatch_push_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION dispatch_push_notification();

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

DROP POLICY IF EXISTS "ticket files read" ON storage.objects;
CREATE POLICY "ticket files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ticket-attachments');
DROP POLICY IF EXISTS "ticket files write" ON storage.objects;
CREATE POLICY "ticket files write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-attachments' AND owner = auth.uid());
DROP POLICY IF EXISTS "kb files read" ON storage.objects;
CREATE POLICY "kb files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kb-attachments');
DROP POLICY IF EXISTS "kb files write" ON storage.objects;
CREATE POLICY "kb files write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kb-attachments' AND public.is_ti(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_ti(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_department_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_entity(text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_entity(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_ticket_changes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_ticket_first_response() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_sla_status_transition() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_ticket_toner_discharge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_ti(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_department_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_entity(text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_entity(text, uuid) TO authenticated, service_role;

INSERT INTO public.ticket_statuses (nome,cor,ordem,ativo,is_inicial,is_resolvido,is_fechado) VALUES
 ('Em Aberto','#ef7706',1,true,true,false,false),
 ('Em Andamento','#d6e600',2,true,false,false,false),
 ('Aguardando Usuário','#3d83e6',3,true,false,false,false),
 ('Aguardando Fornecedor','#247fff',4,true,false,false,false),
 ('Aguardando Terceiro','#6ca9fe',5,true,false,false,false),
 ('Resolvido','#00ff2a',6,true,false,true,false),
 ('Fechado','#fe6c6c',7,true,false,false,true),
 ('Cancelado','#ff0000',8,true,false,false,true),
 ('Reserva de Equipamentos','#000000',18,true,false,false,false);

INSERT INTO public.ticket_priorities (nome,cor,ordem,ativo) VALUES
 ('Baixa','#45f2a1',1,true),
 ('Média','#257df8',2,true),
 ('Alta','#eae31a',3,true),
 ('Urgente','#ff0040',4,true);

INSERT INTO public.ticket_categories (nome,cor,ordem,ativo) VALUES
 ('TRIMBOX','#0033ff',1,true),
 ('SAP','#a68c0c',2,true),
 ('Rede','#6b6f01',3,true),
 ('Impressão Colorida','#899343',4,true),
 ('E-mail','#1b5ebb',4,true),
 ('Toner','#ff7300',5,true),
 ('Hardware','#4b5768',10,true),
 ('Software','#1269e2',20,true),
 ('Telefonia','#410dba',50,true),
 ('Coletores','#10a206',80,true),
 ('Impressoras','#6f1162',90,true),
 ('Outros','#22bcbf',91,true),
 ('Reserva de Equipamentos','#6366f1',93,true);

INSERT INTO public.kb_content_types (nome,slug,descricao,ativo) VALUES
 ('Artigo','artigo',NULL,true),
 ('Informativo','informativo','Tipo de Conteudo informativo',true),
 ('Manual','manual',NULL,true),
 ('Política','politica',NULL,true),
 ('Procedimento','procedimento',NULL,true);

INSERT INTO public.inventory_statuses (nome) VALUES
 ('Ativo'), ('Baixado'), ('Em Manutenção'), ('Reserva');

INSERT INTO public.inventory_categories (nome,descricao) VALUES
 ('Access Point',NULL),
 ('Celular Corporativo',NULL),
 ('Desktop',NULL),
 ('Firewall',NULL),
 ('Impressora',NULL),
 ('Licenças','Licenças de software, SaaS e assinaturas'),
 ('Monitor',NULL),
 ('Notebook',NULL),
 ('Outros',NULL),
 ('Semp Toshiba',NULL),
 ('Servidor',NULL),
 ('Switch',NULL),
 ('Tablet',NULL);

INSERT INTO public.reservation_settings (id, block_weekends) VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sla_configs (priority_id, resolution_hours, first_response_minutes)
SELECT id,
       CASE nome WHEN 'Urgente' THEN 4 WHEN 'Alta' THEN 8 WHEN 'Média' THEN 24 ELSE 48 END,
       CASE nome WHEN 'Urgente' THEN 15 WHEN 'Alta' THEN 30 WHEN 'Média' THEN 60 ELSE 120 END
FROM public.ticket_priorities
ON CONFLICT (priority_id) DO NOTHING;

INSERT INTO public.sla_status_rules (status_id, pause_sla, finish_sla)
SELECT id, nome LIKE 'Aguardando%', is_resolvido OR is_fechado
FROM public.ticket_statuses
ON CONFLICT (status_id) DO NOTHING;
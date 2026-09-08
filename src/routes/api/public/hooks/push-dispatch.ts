import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";

type Body = { notification_id?: string };

export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const apikey = request.headers.get("apikey");
        if (!expectedKey || apikey !== expectedKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const notificationId = body.notification_id;
        if (!notificationId || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
          return new Response("Invalid notification_id", { status: 400 });
        }

        const vapid = {
          subject: process.env["VAPID_SUBJECT"] ?? "mailto:ti@slotter.com.br",
          publicKey: process.env["VAPID_PUBLIC_KEY"],
          privateKey: process.env["VAPID_PRIVATE_KEY"],
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return new Response("VAPID keys not configured", { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notification, error } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, ticket_id, titulo, mensagem")
          .eq("id", notificationId)
          .maybeSingle();

        if (error || !notification) {
          return new Response("Notification not found", { status: 404 });
        }

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", notification.user_id);

        if (!subs || subs.length === 0) {
          return Response.json({ sent: 0 });
        }

        const url = notification.ticket_id ? `/chamados/${notification.ticket_id}` : "/";
        const message = {
          data: {
            title: notification.titulo,
            body: notification.mensagem,
            url,
            tag: `ticket-${notification.ticket_id ?? notification.id}`,
          },
          options: { ttl: 60 * 60 * 24, urgency: "high" as const },
        };

        let sent = 0;
        const stale: string[] = [];

        await Promise.all(
          subs.map(async (sub) => {
            const subscription = {
              endpoint: sub.endpoint,
              expirationTime: null,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            try {
              const payload = await buildPushPayload(message, subscription, vapid);
              const res = await fetch(sub.endpoint, {
                method: payload.method,
                headers: payload.headers as Record<string, string>,
                body: payload.body.slice().buffer as ArrayBuffer,
              });
              if (res.status === 404 || res.status === 410) {
                stale.push(sub.id);
              } else if (res.ok) {
                sent += 1;
              } else {
                console.error("push failed", res.status, await res.text());
              }
            } catch (err) {
              console.error("push error", err);
            }
          }),
        );

        if (stale.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
        }

        return Response.json({ sent, removed: stale.length });
      },
    },
  },
});

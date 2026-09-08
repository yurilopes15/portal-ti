import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const entityTypeSchema = z.enum(["ticket", "inventory_item", "kb_article", "profile"]);

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (!data || data.length === 0) {
    throw new Error("Apenas administradores podem executar essa ação.");
  }
}

const softDeleteSchema = z.object({
  entity_type: entityTypeSchema,
  entity_id: z.string().uuid(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const softDeleteEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => softDeleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.rpc("soft_delete_entity", {
      _entity_type: data.entity_type,
      _entity_id: data.entity_id,
      _metadata: data.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const restoreSchema = z.object({
  entity_type: entityTypeSchema,
  entity_id: z.string().uuid(),
});

export const restoreEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => restoreSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.rpc("restore_entity", {
      _entity_type: data.entity_type,
      _entity_id: data.entity_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

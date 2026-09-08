import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (!data || data.length === 0) {
    throw new Error("Apenas administradores.");
  }
}

async function logAction(
  context: { supabase: any },
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await context.supabase.rpc("log_admin_action", {
    _action: action,
    _entity_type: "profile",
    _entity_id: entityId,
    _metadata: metadata as any,
  });
}

async function resolveRole(supabaseAdmin: any, roleId: string) {
  const { data } = await supabaseAdmin
    .from("roles")
    .select("id, base_role")
    .eq("id", roleId)
    .maybeSingle();
  if (!data) throw new Error("Perfil não encontrado.");
  return data as { id: string; base_role: "usuario" | "tecnico" | "admin" };
}

const createSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(2).max(120),
  departamento: z.string().max(80).optional().nullable(),
  telefone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(72),
  role_id: z.string().uuid(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        departamento: data.departamento,
        telefone: data.telefone,
        role: data.role,
      },
    });
    if (error) throw new Error(error.message);

    if (created.user) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });
      await logAction(context, "create_user", created.user.id, { email: data.email, role: data.role });
    }

    return { id: created.user?.id, email: created.user?.email };
  });

const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["usuario", "tecnico", "admin", "kanban"]),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    await logAction(context, "update_role", data.user_id, { role: data.role });
    return { ok: true };
  });

const setActiveSchema = z.object({ user_id: z.string().uuid(), ativo: z.boolean() });
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setActiveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.user_id);
    // bloqueia / libera login no auth
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.ativo ? "none" : "876000h",
    });
    await logAction(context, data.ativo ? "activate_user" : "deactivate_user", data.user_id);
    return { ok: true };
  });

const setDeptSchema = z.object({
  user_id: z.string().uuid(),
  departamento: z.string().max(80).nullable(),
});
export const setUserDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setDeptSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ departamento: data.departamento }).eq("id", data.user_id);
    await logAction(context, "update_department", data.user_id, { departamento: data.departamento });
    return { ok: true };
  });

const resetSchema = z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) });
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    await logAction(context, "reset_password", data.user_id);
    return { ok: true };
  });

const updateProfileSchema = z.object({
  user_id: z.string().uuid(),
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  telefone: z.string().max(40).nullable().optional(),
  departamento: z.string().max(80).nullable().optional(),
});
export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.user_id)
      .maybeSingle();

    if (current && current.email !== data.email) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        email: data.email,
        email_confirm: true,
      });
      if (authErr) throw new Error(authErr.message);
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? null,
        departamento: data.departamento ?? null,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await logAction(context, "update_profile", data.user_id, {
      nome: data.nome,
      email: data.email,
    });
    return { ok: true };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // soft delete via RPC (já registra audit)
    const { error } = await context.supabase.rpc("soft_delete_entity", {
      _entity_type: "profile",
      _entity_id: data.user_id,
      _metadata: {},
    });
    if (error) throw new Error(error.message);
    // bane no auth (impede login)
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" });
    return { ok: true };
  });

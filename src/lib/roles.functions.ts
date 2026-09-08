import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (!data || data.length === 0) throw new Error("Apenas administradores.");
}

function slugify(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const baseRole = z.enum(["usuario", "tecnico", "admin"]);

const createSchema = z.object({
  nome: z.string().min(2).max(60),
  descricao: z.string().max(200).nullable().optional(),
  base_role: baseRole,
});

export const createRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let slug = slugify(data.nome) || "perfil";
    const { data: existing } = await supabaseAdmin.from("roles").select("slug");
    const taken = new Set((existing ?? []).map((r: any) => r.slug));
    if (taken.has(slug)) {
      let i = 2;
      while (taken.has(`${slug}_${i}`)) i++;
      slug = `${slug}_${i}`;
    }

    const { data: created, error } = await supabaseAdmin
      .from("roles")
      .insert({
        slug,
        nome: data.nome.trim(),
        descricao: data.descricao ?? null,
        base_role: data.base_role,
        is_system: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.rpc("log_admin_action", {
      _action: "create_role",
      _entity_type: "role",
      _entity_id: created.id,
      _metadata: { nome: data.nome, base_role: data.base_role } as any,
    });
    return { id: created.id };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2).max(60),
  descricao: z.string().max(200).nullable().optional(),
  base_role: baseRole,
});

export const updateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("is_system, base_role")
      .eq("id", data.id)
      .maybeSingle();
    if (!role) throw new Error("Perfil não encontrado.");

    const nextBase = role.is_system ? (role.base_role as any) : data.base_role;

    const { error } = await supabaseAdmin
      .from("roles")
      .update({ nome: data.nome.trim(), descricao: data.descricao ?? null, base_role: nextBase })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (!role.is_system && nextBase !== role.base_role) {
      // mantém o nível base sincronizado com as regras de segurança do banco
      const { data: members } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role_id", data.id);
      for (const m of members ?? []) {
        await supabaseAdmin.from("user_roles").update({ role: nextBase }).eq("user_id", m.user_id);
      }
    }

    await context.supabase.rpc("log_admin_action", {
      _action: "update_role",
      _entity_type: "role",
      _entity_id: data.id,
      _metadata: { nome: data.nome, base_role: nextBase } as any,
    });
    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (!role) throw new Error("Perfil não encontrado.");
    if (role.is_system) throw new Error("Perfis nativos não podem ser excluídos.");

    const { data: fallback } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("slug", "usuario")
      .maybeSingle();

    await supabaseAdmin
      .from("user_roles")
      .update({ role_id: fallback?.id ?? null, role: "usuario" })
      .eq("role_id", data.id);

    const { error } = await supabaseAdmin.from("roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.rpc("log_admin_action", {
      _action: "delete_role",
      _entity_type: "role",
      _entity_id: data.id,
      _metadata: {} as any,
    });
    return { ok: true };
  });

const permsSchema = z.object({
  role_id: z.string().uuid(),
  permissions: z
    .array(
      z.object({
        module: z.string().min(2).max(40),
        can_view: z.boolean(),
        can_create: z.boolean(),
        can_edit: z.boolean(),
        can_delete: z.boolean(),
      }),
    )
    .max(50),
});

export const saveRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => permsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("slug")
      .eq("id", data.role_id)
      .maybeSingle();
    if (!role) throw new Error("Perfil não encontrado.");
    if (role.slug === "admin") throw new Error("O perfil Administrador mantém acesso total.");

    const rows = data.permissions.map((p) => ({ ...p, role_id: data.role_id }));
    const { error } = await supabaseAdmin
      .from("role_permissions")
      .upsert(rows, { onConflict: "role_id,module" });
    if (error) throw new Error(error.message);

    await context.supabase.rpc("log_admin_action", {
      _action: "update_role_permissions",
      _entity_type: "role",
      _entity_id: data.role_id,
      _metadata: {} as any,
    });
    return { ok: true };
  });

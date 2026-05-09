"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuper, requireAdminForPool, requireAnyAdmin } from "@/lib/admin-context";
import { logActivity } from "@/lib/activity";

function generateCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Crear una nueva sala — super admin O pool admin (que se vuelve admin de la nueva sala). */
export async function createPool(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=Nombre%20requerido");

  const { supabase, user, isSuper } = await requireAnyAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data: pool, error } = await supabase
      .from("pools")
      .insert({ name, invite_code: code, owner_id: user.id })
      .select("id")
      .single();

    if (!error && pool) {
      // El creador queda como miembro y como admin de su nueva sala
      // (super admin no necesita is_admin porque ya es global; lo marcamos
      // igual por consistencia visual).
      await supabase.from("pool_members").insert({
        pool_id: pool.id,
        user_id: user.id,
        is_admin: isSuper ? false : true,
      });
      await logActivity(supabase, user.id, "pool_created", {
        pool_id: pool.id,
        pool_name: name,
        invite_code: code,
      });
      revalidatePath("/admin");
      redirect(`/admin?ok=Sala%20creada`);
    }

    if (error && !error.message.toLowerCase().includes("invite_code")) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
  }
  redirect("/admin?error=No%20se%20pudo%20generar%20c%C3%B3digo");
}

/** Agrega directamente un usuario existente a una sala (sin invitación). */
export async function addExistingMember(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!poolId || !userId) redirect("/admin?error=Datos%20incompletos");

  const { supabase, user } = await requireAdminForPool(poolId);

  const [{ data: poolRow }, { data: targetProfile }] = await Promise.all([
    supabase.from("pools").select("name").eq("id", poolId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);

  const { error } = await supabase
    .from("pool_members")
    .insert({ pool_id: poolId, user_id: userId, is_admin: false });

  if (error) {
    // Si ya existe (constraint pk), avisamos amigable.
    const msg = error.message.toLowerCase().includes("duplicate") || error.code === "23505"
      ? "Esa persona ya es miembro de la sala"
      : error.message;
    redirect(`/admin?error=${encodeURIComponent(msg)}`);
  }

  await logActivity(supabase, user.id, "invite_created", {
    pool_id: poolId,
    pool_name: poolRow?.name ?? "—",
    code: "(directo)",
    note: `Agregado directamente: ${targetProfile?.display_name ?? "—"}`,
    direct_add_target: userId,
  });

  revalidatePath("/admin");
  redirect(
    `/admin?ok=${encodeURIComponent(
      `${targetProfile?.display_name ?? "Usuario"} agregado a ${poolRow?.name ?? "la sala"}`,
    )}`,
  );
}

/** Generar código de invitación — super O admin de esta sala. */
export async function generateInvitation(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().toLowerCase() || null;
  if (!poolId) redirect("/admin?error=Sala%20requerida");

  const { supabase, user } = await requireAdminForPool(poolId);

  // Nombre de la sala para el log (capturado en el momento).
  const { data: poolRow } = await supabase
    .from("pools").select("name").eq("id", poolId).maybeSingle();
  const poolName = poolRow?.name ?? "—";

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(8);
    const { error: insErr } = await supabase.from("invitations").insert({
      pool_id: poolId,
      email: note,
      code,
      invited_by: user.id,
    });
    if (!insErr) {
      await logActivity(supabase, user.id, "invite_created", {
        pool_id: poolId,
        pool_name: poolName,
        code,
        note,
      });
      revalidatePath("/admin");
      redirect(`/admin?ok=C%C3%B3digo%20generado:%20${code}`);
    }
    if (!String(insErr.message).toLowerCase().includes("code")) {
      redirect(`/admin?error=${encodeURIComponent(insErr.message)}`);
    }
  }
  redirect("/admin?error=No%20se%20pudo%20generar%20c%C3%B3digo");
}

/** Revocar una invitación. La RLS hace el chequeo final. */
export async function revokeInvitation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin?error=ID%20requerido");

  // Lee el pool_id + code para el log (la RLS permite si uno es admin de esa sala).
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("pool_id, code, email")
    .eq("id", id)
    .maybeSingle();
  if (!inv) redirect("/admin?error=Invitaci%C3%B3n%20no%20encontrada");

  // Chequeo de rol explícito antes de borrar.
  const { user } = await requireAdminForPool(inv.pool_id);

  const { data: poolRow } = await supabase
    .from("pools").select("name").eq("id", inv.pool_id).maybeSingle();

  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, user.id, "invite_revoked", {
    pool_id: inv.pool_id,
    pool_name: poolRow?.name ?? "—",
    code: inv.code,
    note: inv.email,
  });

  revalidatePath("/admin");
  redirect("/admin?ok=Invitaci%C3%B3n%20revocada");
}

/** Promover/demover un miembro como admin de la sala — SOLO super admin. */
export async function togglePoolAdmin(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const makeAdmin = formData.get("make_admin") === "true";

  if (!poolId || !userId) {
    redirect("/admin?error=Datos%20incompletos");
  }

  const { supabase, user } = await requireSuper();

  const [{ data: poolRow }, { data: targetProfile }] = await Promise.all([
    supabase.from("pools").select("name").eq("id", poolId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);

  const { error } = await supabase
    .from("pool_members")
    .update({ is_admin: makeAdmin })
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, user.id, "admin_toggled", {
    pool_id: poolId,
    pool_name: poolRow?.name ?? "—",
    target_user_id: userId,
    target_name: targetProfile?.display_name ?? "—",
    made_admin: makeAdmin,
  });

  revalidatePath("/admin");
  redirect(
    `/admin?ok=${encodeURIComponent(
      makeAdmin ? "Admin de sala asignado" : "Admin de sala retirado",
    )}`,
  );
}

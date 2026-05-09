"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";

function generateCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/pools?error=Acceso%20restringido");
  return { supabase, user };
}

export async function createPool(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=Nombre%20requerido");

  const { supabase, user } = await requireAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data: pool, error } = await supabase
      .from("pools")
      .insert({ name, invite_code: code, owner_id: user.id })
      .select("id")
      .single();

    if (!error && pool) {
      await supabase.from("pool_members").insert({
        pool_id: pool.id,
        user_id: user.id,
      });
      revalidatePath("/admin");
      redirect("/admin?ok=Sala%20creada");
    }

    if (error && !error.message.toLowerCase().includes("invite_code")) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
  }
  redirect("/admin?error=No%20se%20pudo%20generar%20c%C3%B3digo");
}

export async function generateInvitation(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().toLowerCase() || null;
  if (!poolId) redirect("/admin?error=Sala%20requerida");

  const { supabase, user } = await requireAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(8);
    const { error: insErr } = await supabase.from("invitations").insert({
      pool_id: poolId,
      email: note,
      code,
      invited_by: user.id,
    });
    if (!insErr) {
      revalidatePath("/admin");
      redirect(`/admin?ok=C%C3%B3digo%20generado:%20${code}`);
    }
    if (!String(insErr.message).toLowerCase().includes("code")) {
      redirect(`/admin?error=${encodeURIComponent(insErr.message)}`);
    }
  }
  redirect("/admin?error=No%20se%20pudo%20generar%20c%C3%B3digo");
}

export async function revokeInvitation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin?error=ID%20requerido");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?ok=Invitaci%C3%B3n%20revocada");
}

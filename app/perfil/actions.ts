"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(formData: FormData) {
  const name = String(formData.get("display_name") ?? "").trim();
  if (name.length < 2 || name.length > 40) {
    redirect("/perfil?error=El%20nombre%20debe%20tener%20entre%202%20y%2040%20caracteres");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) redirect(`/perfil?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/perfil");
  redirect("/perfil?ok=Nombre%20actualizado");
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 6) redirect("/perfil?error=La%20contrase%C3%B1a%20debe%20tener%20m%C3%ADnimo%206%20caracteres");
  if (password !== confirm) redirect("/perfil?error=Las%20contrase%C3%B1as%20no%20coinciden");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/perfil?error=${encodeURIComponent(error.message)}`);

  redirect("/perfil?ok=Contrase%C3%B1a%20cambiada");
}

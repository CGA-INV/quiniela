"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 6) redirect("/reset-password?error=M%C3%ADnimo%206%20caracteres");
  if (password !== confirm) redirect("/reset-password?error=Las%20contrase%C3%B1as%20no%20coinciden");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=El%20enlace%20expir%C3%B3.%20Pide%20uno%20nuevo");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);

  redirect("/pools?ok=Contrase%C3%B1a%20actualizada");
}

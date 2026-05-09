"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUpWithCode(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();

  if (!displayName || !email || !password || !code) {
    redirect("/signup?error=Faltan%20datos");
  }
  if (password.length < 6) {
    redirect("/signup?error=La%20contrase%C3%B1a%20debe%20tener%20al%20menos%206%20caracteres");
  }

  const supabase = await createClient();

  // 1. Pre-validar el código (sin consumirlo) para no crear cuentas huérfanas.
  const { data: valid, error: peekErr } = await supabase.rpc("peek_invitation", { code });
  if (peekErr) redirect(`/signup?error=${encodeURIComponent(peekErr.message)}&code=${code}`);
  if (!valid) redirect(`/signup?error=${encodeURIComponent("Código inválido o expirado")}&code=${code}`);

  // 2. Crear la cuenta. Asume que "Confirm email" está OFF en Supabase Auth Settings.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&code=${code}`);
  }
  if (!data.session) {
    redirect(
      `/signup?error=${encodeURIComponent("La confirmación por email está activa en Supabase. Desactívala en Authentication → Sign In/Up → Email.")}`,
    );
  }

  // 3. Canjear el código (ya estamos autenticados).
  const { data: poolId, error: redeemErr } = await supabase.rpc("redeem_invitation", { code });
  if (redeemErr) {
    redirect(`/pools?error=${encodeURIComponent(redeemErr.message)}`);
  }
  redirect(`/pools/${poolId}`);
}

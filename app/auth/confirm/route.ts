import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirma enlaces de email vía token_hash (verifyOtp). A diferencia del
 * flujo PKCE (?code=), este NO está atado al navegador/dispositivo que pidió
 * el enlace, así que funciona aunque el correo se abra en otro lado (Gmail
 * app, otro móvil, etc.). Lo usa el restablecimiento de contraseña.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/pools";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=Enlace%20inv%C3%A1lido%20o%20expirado`);
}

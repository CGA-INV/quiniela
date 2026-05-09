import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con privilegios de service role.
 * Solo usar en server actions / route handlers — NUNCA exponer al cliente.
 *
 * Requiere la env var SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ — debe
 * quedar privada). La obtenés en Supabase Dashboard → Project Settings →
 * API → "Service role key".
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada");
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no configurada. Agregala a .env.local y a Vercel.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

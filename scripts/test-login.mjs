// Prueba un login real contra Supabase con la anon key (igual que el navegador).
// Uso: node scripts/test-login.mjs "email" "password"
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.argv[2];
const password = process.argv[3];

const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  console.error("❌ Login FALLÓ:", error.message);
  process.exit(1);
}
console.log("✅ Login OK para", data.user.email, "(id:", data.user.id + ")");

// Resetea (o consulta) la contraseña del super admin vía Supabase Admin API.
// Uso:
//   node scripts/reset-admin-password.mjs                 -> solo busca y muestra la cuenta
//   node scripts/reset-admin-password.mjs "NuevaClave123" -> actualiza la contraseña
//
// Lee credenciales de .env.local (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Cargar .env.local manualmente (este script corre fuera de Next).
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const EMAIL = "montagudev@gmail.com";
const newPassword = process.argv[2] || null;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Buscar el usuario por email (paginando).
let user = null;
for (let page = 1; page <= 50 && !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error("Error listando usuarios:", error.message); process.exit(1); }
  user = data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (data.users.length < 200) break;
}

if (!user) {
  console.error(`No se encontró ningún usuario con email ${EMAIL}`);
  process.exit(1);
}

console.log("Cuenta encontrada:");
console.log("  id:            ", user.id);
console.log("  email:         ", user.email);
console.log("  creado:        ", user.created_at);
console.log("  último login:  ", user.last_sign_in_at ?? "(nunca)");
console.log("  email_confirm: ", user.email_confirmed_at ? "sí" : "NO");

if (!newPassword) {
  console.log("\n(Modo consulta: no se cambió nada. Pasa una contraseña como argumento para actualizarla.)");
  process.exit(0);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword,
  email_confirm: true,
});
if (error) { console.error("Error actualizando contraseña:", error.message); process.exit(1); }
console.log(`\n✅ Contraseña actualizada para ${EMAIL}. Ya puedes iniciar sesión.`);

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";

/**
 * Rol admin del usuario actual.
 *  - "super": montagudev@gmail.com — control total
 *  - "pool":  miembro con is_admin=true en al menos una sala
 *  - "none":  ni una cosa ni la otra
 */
export type AdminRole = "super" | "pool" | "none";

export type AdminContext = {
  role: AdminRole;
  userId: string | null;
  managedPools: string[];
};

/** Solo lectura — para pages. Usa el cliente Supabase compartido. */
export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { role: "none", userId: null, managedPools: [] };
  if (isAdminEmail(user.email)) {
    return { role: "super", userId: user.id, managedPools: [] };
  }
  const { data } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", user.id)
    .eq("is_admin", true);
  const managedPools = (data ?? []).map((m: { pool_id: string }) => m.pool_id);
  return managedPools.length > 0
    ? { role: "pool", userId: user.id, managedPools }
    : { role: "none", userId: user.id, managedPools: [] };
}

/** Para server actions: exige super admin. Redirige si no. */
export async function requireSuper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) {
    redirect("/pools?error=Solo%20el%20super%20admin%20puede%20esta%20acci%C3%B3n");
  }
  return { supabase, user };
}

/** Para server actions: exige super admin O admin de la sala dada. */
export async function requireAdminForPool(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const isSuper = isAdminEmail(user.email);
  if (isSuper) return { supabase, user, isSuper: true };

  const { data } = await supabase
    .from("pool_members")
    .select("is_admin")
    .eq("user_id", user.id)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (data?.is_admin) return { supabase, user, isSuper: false };

  redirect("/pools?error=Acceso%20restringido");
}

/** Para server actions: exige super admin O admin de cualquier sala. */
export async function requireAnyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const isSuper = isAdminEmail(user.email);
  if (isSuper) {
    return { supabase, user, isSuper: true, managedPools: [] as string[] };
  }
  const { data } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", user.id)
    .eq("is_admin", true);
  const managedPools = (data ?? []).map((m: { pool_id: string }) => m.pool_id);
  if (managedPools.length === 0) {
    redirect("/pools?error=Acceso%20restringido");
  }
  return { supabase, user, isSuper: false, managedPools };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityAction =
  | "invite_created"
  | "invite_revoked"
  | "match_closed"
  | "match_reopened"
  | "match_deleted"
  | "match_created"
  | "admin_toggled"
  | "pool_created";

export type ActivityMeta = Record<string, unknown>;

/**
 * Inserta una entrada en activity_log. Si falla, lo muestra en consola
 * pero no rompe la acción principal — el log es informativo, no crítico.
 */
export async function logActivity(
  supabase: SupabaseClient,
  actorId: string,
  action: ActivityAction,
  meta: ActivityMeta = {},
): Promise<void> {
  const { error } = await supabase
    .from("activity_log")
    .insert({ actor_id: actorId, action, meta });
  if (error) {
    console.error("[activity_log] insert failed:", error.message);
  }
}

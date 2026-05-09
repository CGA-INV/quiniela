import type { SupabaseClient } from "@supabase/supabase-js";

export type WinnerInfo = {
  user_id: string;
  display_name: string;
  total: number;
  exactos: number;
};

/**
 * Calcula el ganador de la fase de grupos para una sala.
 * Retorna null si:
 *  - No hay partidos de fase de grupos cargados
 *  - Algún partido de fase de grupos NO está finalizado todavía
 *  - La sala no tiene miembros
 *
 * Tiebreak: total puntos → cantidad de exactos → nombre alfabético.
 */
export async function getPoolWinner(
  supabase: SupabaseClient,
  poolId: string,
): Promise<WinnerInfo | null> {
  // 1. ¿Está terminada la fase de grupos?
  const { data: groupMatches } = await supabase
    .from("matches")
    .select("finished")
    .eq("stage", "group");

  if (!groupMatches || groupMatches.length === 0) return null;
  if ((groupMatches as { finished: boolean }[]).some(m => !m.finished)) return null;

  // 2. Miembros + sus puntos en esta sala
  const [{ data: members }, { data: predictions }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("user_id, profiles(display_name)")
      .eq("pool_id", poolId),
    supabase
      .from("predictions")
      .select("user_id, points")
      .eq("pool_id", poolId),
  ]);

  type Stats = { user_id: string; display_name: string; total: number; exactos: number };
  const stats = new Map<string, Stats>();

  type RawMember = {
    user_id: string;
    profiles: { display_name: string } | { display_name: string }[] | null;
  };
  for (const m of (members ?? []) as unknown as RawMember[]) {
    const name = Array.isArray(m.profiles)
      ? (m.profiles[0]?.display_name ?? "—")
      : (m.profiles?.display_name ?? "—");
    stats.set(m.user_id, { user_id: m.user_id, display_name: name, total: 0, exactos: 0 });
  }

  for (const p of (predictions ?? []) as { user_id: string; points: number }[]) {
    const s = stats.get(p.user_id);
    if (!s) continue;
    s.total += p.points ?? 0;
    if (p.points === 3) s.exactos++;
  }

  if (stats.size === 0) return null;

  const sorted = Array.from(stats.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exactos !== a.exactos) return b.exactos - a.exactos;
    return a.display_name.localeCompare(b.display_name);
  });

  return sorted[0];
}

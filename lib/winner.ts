import type { SupabaseClient } from "@supabase/supabase-js";

export type WinnerInfo = {
  user_id: string;
  display_name: string;
  total: number;
  exactos: number;
};

/**
 * Versión sync que reusa data ya fetchada — la usa /pools/[id]/page.tsx
 * para evitar 4 queries redundantes. Asume que matches contiene SOLO los
 * partidos del scope correcto (sandbox o global) — el caller filtra antes.
 */
export function computePoolWinner(opts: {
  matches: { stage: string; finished: boolean }[];
  members: { user_id: string; display_name: string }[];
  statsByUser: Map<string, { total: number; exactos: number }>;
}): WinnerInfo | null {
  const groupMatches = opts.matches.filter(m => m.stage === "group");
  if (groupMatches.length === 0) return null;
  if (groupMatches.some(m => !m.finished)) return null;
  if (opts.members.length === 0) return null;

  const sorted = opts.members
    .map(m => {
      const s = opts.statsByUser.get(m.user_id) ?? { total: 0, exactos: 0 };
      return { user_id: m.user_id, display_name: m.display_name, total: s.total, exactos: s.exactos };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.exactos !== a.exactos) return b.exactos - a.exactos;
      return a.display_name.localeCompare(b.display_name);
    });

  return sorted[0];
}

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
  // 0. ¿La sala es sandbox? Define el scope de partidos.
  const { data: poolRow } = await supabase
    .from("pools")
    .select("is_sandbox")
    .eq("id", poolId)
    .maybeSingle();
  if (!poolRow) return null;
  const isSandbox = (poolRow as { is_sandbox: boolean }).is_sandbox;

  // 1. ¿Está terminada la fase de grupos? (filtro por scope)
  const matchQuery = supabase
    .from("matches")
    .select("finished")
    .eq("stage", "group");
  const matchQueryScoped = isSandbox
    ? matchQuery.eq("pool_id", poolId)
    : matchQuery.is("pool_id", null);
  const { data: groupMatches } = await matchQueryScoped;

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

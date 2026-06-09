// Propaga el bracket: a partir de los resultados actuales, llena los equipos
// de los partidos eliminatorios globales (pool_id null).
//
// - Modo normal (force=false): solo rellena llaves que aún dicen "por definir".
//   Nunca pisa una corrección manual ni un equipo ya puesto.
// - Modo forzado (force=true): recalcula y sobrescribe TODAS las llaves no
//   cerradas (escape hatch si admin corrige un resultado anterior).
//
// Nunca toca partidos ya cerrados (finished=true).

import type { createClient } from "@/lib/supabase/server";
import { computeBracketTeams, isPlaceholderTeam, type BracketMatch } from "@/lib/bracket";

type Row = BracketMatch & { id: string };
type Client = Awaited<ReturnType<typeof createClient>>;

export async function propagateBracket(
  supabase: Client,
  { force = false }: { force?: boolean } = {},
): Promise<number> {
  const { data } = await supabase
    .from("matches")
    .select(
      "id, match_no, stage, group_label, home_team, away_team, home_score, away_score, finished, pen_winner",
    )
    .is("pool_id", null);

  const matches = (data ?? []) as Row[];
  const desired = computeBracketTeams(matches);

  const updates: { id: string; patch: Record<string, string> }[] = [];
  for (const m of matches) {
    if (m.match_no == null || m.finished) continue;
    const want = desired.get(m.match_no);
    if (!want) continue;
    const patch: Record<string, string> = {};
    if (want.home && want.home !== m.home_team && (force || isPlaceholderTeam(m.home_team))) {
      patch.home_team = want.home;
    }
    if (want.away && want.away !== m.away_team && (force || isPlaceholderTeam(m.away_team))) {
      patch.away_team = want.away;
    }
    if (Object.keys(patch).length > 0) updates.push({ id: m.id, patch });
  }

  for (const u of updates) {
    await supabase.from("matches").update(u.patch).eq("id", u.id);
  }
  return updates.length;
}

export type StandingRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;        // goles a favor
  ga: number;        // goles en contra
  gd: number;        // diferencia
  pts: number;
};

type MinimalMatch = {
  stage: string;
  group_label: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
};

const blankRow = (team: string): StandingRow => ({
  team,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  pts: 0,
});

/**
 * Calcula la tabla de posiciones por grupo a partir de los partidos.
 * Solo cuentan los partidos finalizados, pero los equipos aparecen en su
 * grupo aunque aún no hayan jugado (para no quedar fuera).
 */
export function buildStandings(matches: MinimalMatch[]): Map<string, StandingRow[]> {
  const byGroup = new Map<string, Map<string, StandingRow>>();

  // Pase 1: registrar todos los equipos que aparecen en cada grupo.
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    const grp = byGroup.get(m.group_label) ?? new Map<string, StandingRow>();
    if (!grp.has(m.home_team)) grp.set(m.home_team, blankRow(m.home_team));
    if (!grp.has(m.away_team)) grp.set(m.away_team, blankRow(m.away_team));
    byGroup.set(m.group_label, grp);
  }

  // Pase 2: aplicar resultados de partidos finalizados.
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    if (!m.finished || m.home_score === null || m.away_score === null) continue;
    const grp = byGroup.get(m.group_label);
    if (!grp) continue;
    const home = grp.get(m.home_team);
    const away = grp.get(m.away_team);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.gf += m.home_score;
    home.ga += m.away_score;
    away.gf += m.away_score;
    away.ga += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++;
      home.pts += 3;
      away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++;
      away.pts += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.pts += 1;
      away.pts += 1;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  // Ordenar cada grupo: pts → diferencia → gf → nombre.
  const result = new Map<string, StandingRow[]>();
  for (const [grp, teams] of byGroup) {
    const sorted = Array.from(teams.values()).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });
    result.set(grp, sorted);
  }
  return result;
}

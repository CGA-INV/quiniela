// Estructura oficial del bracket del Mundial 2026 (104 partidos).
// Los partidos 73-104 son eliminatorias. Sus equipos se llenan SOLOS a partir
// de los resultados reales de la fase de grupos y de las propias eliminatorias.
//
// Ojo: para el sistema de puntos los equipos son meramente informativos — se
// puntúa marcador-contra-marcador por número de partido. Aun así llenamos los
// nombres para que admin y jugadores VEAN quién juega cada llave.
//
// Fuente: bracket oficial FIFA 2026 (Wikipedia "2026 FIFA World Cup knockout
// stage"). El reparto de los 8 mejores terceros usa una asignación válida
// (cada tercero a una llave permitida); es corregible a mano si difiere de la
// tabla oficial.

import { buildStandings } from "@/lib/standings";
import { THIRD_ALLOCATION, THIRD_MATCH_ORDER } from "@/lib/bracket-thirds-table";

export type BracketMatch = {
  match_no: number | null;
  stage: string;
  group_label: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  pen_winner?: string | null;
};

export function isPlaceholderTeam(t: string | null | undefined): boolean {
  return !t || t.trim() === "" || /por definir/i.test(t);
}

// --- Slots de la Ronda de 32 (partidos 73-88) -------------------------------
// type 'winner' | 'runner' apuntan a la posición 1ª/2ª de un grupo.
// type 'third' apunta al mejor tercero asignado a esa llave (grupos candidatos).
type Slot =
  | { type: "winner" | "runner"; group: string }
  | { type: "third"; match: number };

const R32: Record<number, { home: Slot; away: Slot }> = {
  73: { home: { type: "runner", group: "A" }, away: { type: "runner", group: "B" } },
  74: { home: { type: "winner", group: "E" }, away: { type: "third", match: 74 } },
  75: { home: { type: "winner", group: "F" }, away: { type: "runner", group: "C" } },
  76: { home: { type: "winner", group: "C" }, away: { type: "runner", group: "F" } },
  77: { home: { type: "winner", group: "I" }, away: { type: "third", match: 77 } },
  78: { home: { type: "runner", group: "E" }, away: { type: "runner", group: "I" } },
  79: { home: { type: "winner", group: "A" }, away: { type: "third", match: 79 } },
  80: { home: { type: "winner", group: "L" }, away: { type: "third", match: 80 } },
  81: { home: { type: "winner", group: "D" }, away: { type: "third", match: 81 } },
  82: { home: { type: "winner", group: "G" }, away: { type: "third", match: 82 } },
  83: { home: { type: "runner", group: "K" }, away: { type: "runner", group: "L" } },
  84: { home: { type: "winner", group: "H" }, away: { type: "runner", group: "J" } },
  85: { home: { type: "winner", group: "B" }, away: { type: "third", match: 85 } },
  86: { home: { type: "winner", group: "J" }, away: { type: "runner", group: "H" } },
  87: { home: { type: "winner", group: "K" }, away: { type: "third", match: 87 } },
  88: { home: { type: "runner", group: "D" }, away: { type: "runner", group: "G" } },
};

// Grupos candidatos de cada llave de tercero (orden oficial de los slots).
const THIRD_SLOTS: { match: number; groups: string[] }[] = [
  { match: 74, groups: ["A", "B", "C", "D", "F"] },
  { match: 77, groups: ["C", "D", "F", "G", "H"] },
  { match: 79, groups: ["C", "E", "F", "H", "I"] },
  { match: 80, groups: ["E", "H", "I", "J", "K"] },
  { match: 81, groups: ["B", "E", "F", "I", "J"] },
  { match: 82, groups: ["A", "E", "H", "I", "J"] },
  { match: 85, groups: ["E", "F", "G", "I", "J"] },
  { match: 87, groups: ["D", "E", "I", "J", "L"] },
];

// --- Enlaces de eliminatorias (89-104): de qué partido viene cada lado -------
type Link = { winnerOf: number } | { loserOf: number };
const KO: Record<number, { home: Link; away: Link }> = {
  89: { home: { winnerOf: 74 }, away: { winnerOf: 77 } },
  90: { home: { winnerOf: 73 }, away: { winnerOf: 75 } },
  91: { home: { winnerOf: 76 }, away: { winnerOf: 78 } },
  92: { home: { winnerOf: 79 }, away: { winnerOf: 80 } },
  93: { home: { winnerOf: 83 }, away: { winnerOf: 84 } },
  94: { home: { winnerOf: 81 }, away: { winnerOf: 82 } },
  95: { home: { winnerOf: 86 }, away: { winnerOf: 88 } },
  96: { home: { winnerOf: 85 }, away: { winnerOf: 87 } },
  97: { home: { winnerOf: 89 }, away: { winnerOf: 90 } },
  98: { home: { winnerOf: 93 }, away: { winnerOf: 94 } },
  99: { home: { winnerOf: 91 }, away: { winnerOf: 92 } },
  100: { home: { winnerOf: 95 }, away: { winnerOf: 96 } },
  101: { home: { winnerOf: 97 }, away: { winnerOf: 98 } },
  102: { home: { winnerOf: 99 }, away: { winnerOf: 100 } },
  103: { home: { loserOf: 101 }, away: { loserOf: 102 } },
  104: { home: { winnerOf: 101 }, away: { winnerOf: 102 } },
};

/** Ganador/perdedor de un partido eliminatorio con resultado decidido.
 *  Basta con que tenga marcador cargado (con "Actualizar" o "Cerrar"); no exige
 *  finished, para que la llave avance apenas pongas el resultado. */
function decideKO(m: BracketMatch | undefined): { winner: string | null; loser: string | null } {
  const none = { winner: null, loser: null };
  if (!m) return none;
  if (isPlaceholderTeam(m.home_team) || isPlaceholderTeam(m.away_team)) return none;
  if (m.home_score == null || m.away_score == null) return none;
  if (m.home_score > m.away_score) return { winner: m.home_team, loser: m.away_team };
  if (m.away_score > m.home_score) return { winner: m.away_team, loser: m.home_team };
  // Empate en 90'/prórroga → lo define el penalti (pen_winner).
  if (m.pen_winner && m.pen_winner === m.home_team) return { winner: m.home_team, loser: m.away_team };
  if (m.pen_winner && m.pen_winner === m.away_team) return { winner: m.away_team, loser: m.home_team };
  return none;
}

/**
 * Asigna los 8 mejores terceros a sus 8 llaves según la TABLA OFICIAL de FIFA
 * (lib/bracket-thirds-table.ts, las 495 combinaciones del Anexo C). Devuelve
 * match_no → letra de grupo del tercero asignado.
 *
 * Importante: para cada combinación hay muchos emparejamientos válidos posibles
 * (3 a 214); FIFA elige uno específico, así que NO se puede derivar con un
 * algoritmo — hay que consultar la tabla oficial.
 */
function assignThirds(qualifiedGroups: string[]): Map<number, string> {
  const matchToGroup = new Map<number, string>();
  const key = [...qualifiedGroups].sort().join("");
  const val = THIRD_ALLOCATION[key];
  if (val && val.length === THIRD_MATCH_ORDER.length) {
    THIRD_MATCH_ORDER.forEach((m, i) => matchToGroup.set(m, val[i]));
    return matchToGroup;
  }
  // Fallback (no debería ocurrir: la tabla cubre las 495 combinaciones):
  // matching bipartito válido por si la clave llegara incompleta.
  const groupToMatch = new Map<string, number>();
  const slotByMatch = new Map(THIRD_SLOTS.map((s) => [s.match, s]));
  const augment = (slotMatch: number, seen: Set<string>): boolean => {
    const slot = slotByMatch.get(slotMatch)!;
    for (const g of slot.groups) {
      if (!qualifiedGroups.includes(g) || seen.has(g)) continue;
      seen.add(g);
      const owner = groupToMatch.get(g);
      if (owner === undefined || augment(owner, seen)) {
        groupToMatch.set(g, slotMatch);
        matchToGroup.set(slotMatch, g);
        return true;
      }
    }
    return false;
  };
  for (const slot of THIRD_SLOTS) augment(slot.match, new Set());
  return matchToGroup;
}

/**
 * Calcula los equipos que DEBERÍAN aparecer en cada partido eliminatorio,
 * a partir del estado actual (resultados de grupos + eliminatorias cerradas).
 * Devuelve match_no → {home, away}; cada lado es el nombre del equipo o null
 * si todavía no se puede determinar.
 */
export function computeBracketTeams(
  matches: BracketMatch[],
): Map<number, { home: string | null; away: string | null }> {
  const byNo = new Map<number, BracketMatch>();
  for (const m of matches) if (m.match_no != null) byNo.set(m.match_no, m);

  const standings = buildStandings(matches);

  // Completitud de cada grupo: todos sus partidos tienen marcador cargado
  // (sirve igual para resultados reales del admin que para las predicciones
  // de un jugador, donde el "marcador" es su pronóstico).
  const total = new Map<string, number>();
  const scored = new Map<string, number>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    total.set(m.group_label, (total.get(m.group_label) ?? 0) + 1);
    if (m.home_score != null && m.away_score != null) {
      scored.set(m.group_label, (scored.get(m.group_label) ?? 0) + 1);
    }
  }
  const groups = Array.from(total.keys());
  const groupComplete = (g: string) => (total.get(g) ?? 0) > 0 && total.get(g) === (scored.get(g) ?? 0);
  const pos = (g: string, idx: number): string | null => {
    if (!groupComplete(g)) return null;
    const row = standings.get(g);
    return row && row[idx] ? row[idx].team : null;
  };

  // Terceros: solo cuando TODOS los grupos terminaron (para rankear los 12).
  const thirdByMatch = new Map<number, string | null>();
  const allComplete = groups.length === 12 && groups.every(groupComplete);
  if (allComplete) {
    const thirds = groups
      .map((g) => ({ g, row: standings.get(g)?.[2] }))
      .filter((x) => x.row)
      .map((x) => ({ g: x.g, ...x.row! }));
    // Mejores 8: pts → diferencia → goles a favor → letra de grupo.
    thirds.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.g.localeCompare(b.g);
    });
    const qualified = thirds.slice(0, 8).map((t) => t.g);
    const matchToGroup = assignThirds(qualified);
    for (const { match } of THIRD_SLOTS) {
      const g = matchToGroup.get(match);
      thirdByMatch.set(match, g ? (standings.get(g)?.[2]?.team ?? null) : null);
    }
  }

  const resolveSlot = (slot: Slot): string | null => {
    if (slot.type === "third") return thirdByMatch.get(slot.match) ?? null;
    return pos(slot.group, slot.type === "winner" ? 0 : 1);
  };

  const result = new Map<number, { home: string | null; away: string | null }>();

  // Ronda de 32.
  for (const [noStr, spec] of Object.entries(R32)) {
    const no = Number(noStr);
    result.set(no, { home: resolveSlot(spec.home), away: resolveSlot(spec.away) });
  }

  // Eliminatorias 89-104 (en orden, dependen de partidos previos ya cerrados).
  const resolveLink = (link: Link): string | null => {
    if ("winnerOf" in link) return decideKO(byNo.get(link.winnerOf)).winner;
    return decideKO(byNo.get(link.loserOf)).loser;
  };
  for (const [noStr, spec] of Object.entries(KO)) {
    const no = Number(noStr);
    result.set(no, { home: resolveLink(spec.home), away: resolveLink(spec.away) });
  }

  return result;
}

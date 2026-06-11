// Cierre de predicciones POR FASE:
//   - Fase de grupos: cierre fijo el martes 10 de junio de 2026, 11:59 PM
//     hora de Venezuela (UTC-4) = 2026-06-11 03:59 UTC.
//   - Cada fase eliminatoria: cierra cuando ARRANCA esa fase, es decir el
//     kickoff del primer partido de la fase. Hasta entonces se puede llenar.
// IMPORTANTE: el cierre de grupos también vive en la RLS
// (supabase/migration_prediction_deadline_per_phase.sql). Manténlos en sync.
export const PREDICTIONS_DEADLINE_ISO = "2026-06-11T03:59:00Z";
const DEADLINE_MS = new Date(PREDICTIONS_DEADLINE_ISO).getTime();

export const GROUP_STAGE = "group";

// Zona horaria de Venezuela (UTC-4, sin horario de verano).
export const TZ_VENEZUELA = "America/Caracas";

export type StageMatch = { stage: string; kickoff_at: string };

/**
 * A partir de TODOS los partidos, calcula el instante de cierre de cada fase
 * eliminatoria = kickoff del primer partido de esa fase. La fase de grupos NO
 * entra al mapa (su cierre es fijo, ver `stageLockMs`). Las fases sin partidos
 * cargados tampoco aparecen y caen al cierre global.
 */
export function buildStageLocks(matches: StageMatch[]): Map<string, number> {
  const locks = new Map<string, number>();
  for (const m of matches) {
    if (m.stage === GROUP_STAGE) continue;
    const t = new Date(m.kickoff_at).getTime();
    if (!Number.isFinite(t)) continue;
    const cur = locks.get(m.stage);
    if (cur === undefined || t < cur) locks.set(m.stage, t);
  }
  return locks;
}

/** Cierre de grupos efectivo de una sala: su `group_deadline` si lo tiene,
 *  o el cierre global por defecto. */
export function poolGroupDeadlineMs(groupDeadlineIso?: string | null): number {
  if (!groupDeadlineIso) return DEADLINE_MS;
  const t = new Date(groupDeadlineIso).getTime();
  return Number.isFinite(t) ? t : DEADLINE_MS;
}

/** Cierre de grupos efectivo para UN usuario: el de la sala, extendido por un
 *  override por usuario (excepción) si lo tiene. Solo extiende (nunca acorta). */
export function effectiveGroupDeadlineMs(
  poolGroupDeadlineIso?: string | null,
  userOverrideIso?: string | null,
): number {
  const base = poolGroupDeadlineMs(poolGroupDeadlineIso);
  if (!userOverrideIso) return base;
  const ov = new Date(userOverrideIso).getTime();
  return Number.isFinite(ov) ? Math.max(base, ov) : base;
}

/** Instante (ms) en que cierran las predicciones de una fase. `groupDeadlineMs`
 *  permite un cierre de grupos por sala (default = cierre global). */
export function stageLockMs(stage: string, locks: Map<string, number>, groupDeadlineMs = DEADLINE_MS): number {
  if (stage === GROUP_STAGE) return groupDeadlineMs;
  return locks.get(stage) ?? DEADLINE_MS;
}

/** ¿Sigue abierta esta fase para predecir/editar/borrar? */
export function isStageOpen(
  stage: string,
  locks: Map<string, number>,
  now = Date.now(),
  groupDeadlineMs = DEADLINE_MS,
): boolean {
  return now < stageLockMs(stage, locks, groupDeadlineMs);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    timeZone: TZ_VENEZUELA,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    timeZone: TZ_VENEZUELA,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeUntil(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms < 0) return "";
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) {
    const remHr = hr % 24;
    return remHr > 0 ? `en ${day}d ${remHr}h` : `en ${day}d`;
  }
  if (hr > 0) {
    const remMin = min % 60;
    return remMin > 0 && hr < 6 ? `en ${hr}h ${remMin}m` : `en ${hr}h`;
  }
  if (min > 0) return `en ${min}m`;
  return "ya casi";
}

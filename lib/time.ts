// Cierre ÚNICO de predicciones para toda la quiniela:
// martes 10 de junio de 2026, 4:00 PM hora de Venezuela (UTC-4) = 20:00 UTC.
// IMPORTANTE: este mismo instante está hardcodeado en la RLS
// (supabase/migration_prediction_deadline.sql). Manténlos en sync.
export const PREDICTIONS_DEADLINE_ISO = "2026-06-10T20:00:00Z";
const DEADLINE_MS = new Date(PREDICTIONS_DEADLINE_ISO).getTime();

// Zona horaria de Venezuela (UTC-4, sin horario de verano).
export const TZ_VENEZUELA = "America/Caracas";

/** Instante en que cierran las predicciones (siempre el cierre global). */
export function lockAtMs(_kickoffIso?: string): number {
  return DEADLINE_MS;
}

/** Las predicciones están abiertas hasta el cierre global, sin importar el partido. */
export function isPredictionOpen(_kickoffIso?: string, now = Date.now()): boolean {
  return now < DEADLINE_MS;
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

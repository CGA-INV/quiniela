// Cuánto tiempo antes del kickoff se cierran las predicciones.
// IMPORTANTE: este valor también está hardcodeado en
// supabase/migration_prediction_lock.sql. Mantenelos en sync.
export const PREDICTION_LOCK_MINUTES = 10;

export function lockAtMs(kickoffIso: string): number {
  return new Date(kickoffIso).getTime() - PREDICTION_LOCK_MINUTES * 60 * 1000;
}

export function isPredictionOpen(kickoffIso: string, now = Date.now()): boolean {
  return now < lockAtMs(kickoffIso);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
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

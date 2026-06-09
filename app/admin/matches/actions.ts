"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, requireAnyAdmin } from "@/lib/admin-context";
import { logActivity } from "@/lib/activity";
import { propagateBracket } from "@/lib/bracket-apply";

const STAGES = [
  "group", "round_of_32", "round_of_16",
  "quarter", "semi", "third_place", "final",
] as const;

function nullable(s: string) {
  const v = s.trim();
  return v === "" ? null : v;
}

/**
 * Interpreta un datetime-local (sin zona, ej. "2026-06-11T18:00") como hora
 * de Venezuela (UTC-4) y lo convierte al instante UTC correcto. Si el valor
 * ya trae zona (Z o ±HH:MM), se respeta tal cual.
 */
function toVenezuelaIso(local: string): string {
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(local);
  if (hasTz) return new Date(local).toISOString();
  const withSecs = /T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local;
  return new Date(`${withSecs}-04:00`).toISOString();
}

export async function createMatch(formData: FormData) {
  const stage = String(formData.get("stage") ?? "");
  const groupLabel = nullable(String(formData.get("group_label") ?? ""))?.toUpperCase() ?? null;
  const homeTeam = String(formData.get("home_team") ?? "").trim();
  const awayTeam = String(formData.get("away_team") ?? "").trim();
  const kickoff = String(formData.get("kickoff_at") ?? "").trim();
  const venue = nullable(String(formData.get("venue") ?? ""));
  const city = nullable(String(formData.get("city") ?? ""));
  const matchNoRaw = String(formData.get("match_no") ?? "").trim();
  const matchNo = matchNoRaw === "" ? null : Number(matchNoRaw);
  const poolIdRaw = nullable(String(formData.get("pool_id") ?? ""));
  const poolId = poolIdRaw === "global" || poolIdRaw === "" ? null : poolIdRaw;

  if (!STAGES.includes(stage as (typeof STAGES)[number])) {
    redirect("/admin/matches?error=Fase%20inv%C3%A1lida");
  }
  if (!homeTeam || !awayTeam || !kickoff) {
    redirect("/admin/matches?error=Faltan%20datos");
  }
  if (homeTeam === awayTeam) {
    redirect("/admin/matches?error=Equipos%20deben%20ser%20distintos");
  }
  if (matchNo !== null && (!Number.isInteger(matchNo) || matchNo < 1 || matchNo > 999)) {
    redirect("/admin/matches?error=N%C3%BAmero%20de%20partido%20inv%C3%A1lido");
  }

  const { supabase } = await requireSuper();
  const { error } = await supabase.from("matches").insert({
    stage,
    group_label: groupLabel,
    home_team: homeTeam,
    away_team: awayTeam,
    kickoff_at: toVenezuelaIso(kickoff),
    venue,
    city,
    match_no: matchNo,
    pool_id: poolId,
  });
  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Partido%20agregado");
}

/** Asigna los equipos de un partido (para llenar las llaves eliminatorias). */
export async function updateMatchTeams(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const home = String(formData.get("home_team") ?? "").trim();
  const away = String(formData.get("away_team") ?? "").trim();
  if (!id || !home || !away) redirect("/admin/matches?error=Datos%20incompletos");
  if (home === away) redirect("/admin/matches?error=Los%20equipos%20deben%20ser%20distintos");

  const { supabase } = await requireSuper();
  const { error } = await supabase
    .from("matches")
    .update({ home_team: home, away_team: away })
    .eq("id", id);
  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Equipos%20actualizados");
}

/** Actualiza el score en vivo sin cerrar el partido (mantiene finished=false). */
export async function updateMatchScore(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const homeScore = Number(formData.get("home_score") ?? -1);
  const awayScore = Number(formData.get("away_score") ?? -1);

  if (!id || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)
      || homeScore < 0 || awayScore < 0 || homeScore > 30 || awayScore > 30) {
    redirect("/admin/matches?error=Marcador%20inv%C3%A1lido");
  }

  const { supabase, user, isSuper } = await requireAnyAdmin();

  const { data: cur } = await supabase
    .from("matches")
    .select("finished, home_team, away_team")
    .eq("id", id)
    .single();

  // Pool admin no puede tocar partidos cerrados; super admin sí.
  if (cur?.finished && !isSuper) {
    redirect(
      "/admin/matches?error=Partido%20cerrado.%20Reabri%C3%A9ndolo%20podr%C3%A1s%20editarlo%20de%20nuevo.",
    );
  }

  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      // No tocamos finished en update — solo cierra setMatchResult.
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, user.id, "match_updated", {
    match_id: id,
    home_team: cur?.home_team,
    away_team: cur?.away_team,
    home_score: homeScore,
    away_score: awayScore,
  });

  revalidatePath("/admin/matches");
  redirect(`/admin/matches?ok=Marcador%20actualizado:%20${homeScore}-${awayScore}`);
}

export async function setMatchResult(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const homeScore = Number(formData.get("home_score") ?? -1);
  const awayScore = Number(formData.get("away_score") ?? -1);
  // Quién avanzó por penales (solo eliminatorias empatadas). "" = sin definir.
  const penWinner = nullable(String(formData.get("pen_winner") ?? ""));

  if (!id || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)
      || homeScore < 0 || awayScore < 0) {
    redirect("/admin/matches?error=Marcador%20inv%C3%A1lido");
  }

  // Pool admin O super admin puede cerrar partidos.
  const { supabase, user, isSuper } = await requireAnyAdmin();

  const { data: cur } = await supabase
    .from("matches")
    .select("finished, home_team, away_team, stage")
    .eq("id", id)
    .single();

  // Pool admin no puede tocar partidos ya cerrados; super admin sí.
  if (cur?.finished && !isSuper) {
    redirect(
      "/admin/matches?error=Solo%20el%20super%20admin%20puede%20modificar%20partidos%20cerrados",
    );
  }

  // En eliminatorias empatadas necesitamos saber quién pasó para avanzar la llave.
  const isKnockout = cur?.stage && cur.stage !== "group";
  const penToStore =
    isKnockout && homeScore === awayScore
      ? penWinner && (penWinner === cur?.home_team || penWinner === cur?.away_team)
        ? penWinner
        : null
      : null;

  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      finished: true,
      pen_winner: penToStore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, user.id, "match_closed", {
    match_id: id,
    home_team: cur?.home_team,
    away_team: cur?.away_team,
    home_score: homeScore,
    away_score: awayScore,
    was_already_closed: cur?.finished ?? false,
  });

  // Llena las llaves eliminatorias que ya quedaron determinadas (no pisa nada
  // ya puesto a mano). Tolerante a fallos: nunca bloquea el cierre del partido.
  let advanced = 0;
  try {
    advanced = await propagateBracket(supabase);
  } catch {
    // Si algo falla, el resultado igual quedó guardado; admin puede usar
    // "Actualizar llaves" manualmente.
  }

  revalidatePath("/admin/matches");
  const msg = advanced > 0
    ? `Resultado guardado · ${advanced} ${advanced === 1 ? "llave actualizada" : "llaves actualizadas"}`
    : "Resultado guardado";
  redirect(`/admin/matches?ok=${encodeURIComponent(msg)}`);
}

/** Recalcula y SOBRESCRIBE todas las llaves eliminatorias no cerradas a partir
 *  de los resultados actuales (escape hatch tras corregir un resultado). */
export async function recomputeBracket() {
  const { supabase } = await requireSuper();
  let n = 0;
  try {
    n = await propagateBracket(supabase, { force: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : "error";
    redirect(`/admin/matches?error=${encodeURIComponent("No se pudo recalcular: " + m)}`);
  }
  revalidatePath("/admin/matches");
  redirect(`/admin/matches?ok=${encodeURIComponent(
    n > 0 ? `Llaves recalculadas · ${n} actualizadas` : "Llaves al día (nada que cambiar)",
  )}`);
}

export async function reopenMatch(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/matches?error=ID%20requerido");

  const { supabase, user } = await requireSuper();

  const { data: cur } = await supabase
    .from("matches")
    .select("home_team, away_team, home_score, away_score")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("matches")
    .update({ finished: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, user.id, "match_reopened", {
    match_id: id,
    home_team: cur?.home_team,
    away_team: cur?.away_team,
    previous_score: cur ? `${cur.home_score}–${cur.away_score}` : null,
  });

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Partido%20reabierto.%20Las%20predicciones%20mantienen%20sus%20puntos%20hasta%20que%20cierres%20de%20nuevo.");
}

type ImportRow = {
  stage: string;
  group_label: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  venue: string | null;
  city: string | null;
  match_no: number | null;
  pool_id: string | null;
};

function coerceImport(raw: unknown): { row: ImportRow; reason?: string } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "no es objeto" };
  const r = raw as Record<string, unknown>;
  const stage = String(r.stage ?? "").trim();
  if (!STAGES.includes(stage as (typeof STAGES)[number])) {
    return { error: `stage inválido: '${stage}'` };
  }
  const homeTeam = String(r.home_team ?? "").trim();
  const awayTeam = String(r.away_team ?? "").trim();
  if (!homeTeam || !awayTeam) return { error: "home_team y away_team requeridos" };
  if (homeTeam === awayTeam) return { error: "equipos iguales" };
  const kickoffRaw = String(r.kickoff_at ?? "").trim();
  if (!kickoffRaw) return { error: "kickoff_at requerido" };
  const kickoffDate = new Date(kickoffRaw);
  if (Number.isNaN(kickoffDate.getTime())) return { error: `kickoff_at inválido: '${kickoffRaw}'` };

  const groupLabel = nullable(String(r.group_label ?? ""))?.toUpperCase() ?? null;
  const venue = nullable(String(r.venue ?? ""));
  const city = nullable(String(r.city ?? ""));
  const matchNoVal = r.match_no;
  let matchNo: number | null = null;
  if (matchNoVal !== undefined && matchNoVal !== null && matchNoVal !== "") {
    const n = Number(matchNoVal);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      return { error: `match_no inválido: ${matchNoVal}` };
    }
    matchNo = n;
  }

  const poolIdVal = r.pool_id;
  const poolId = poolIdVal && typeof poolIdVal === "string" && poolIdVal !== "global"
    ? poolIdVal
    : null;

  return {
    row: {
      stage,
      group_label: groupLabel,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff_at: toVenezuelaIso(kickoffRaw),
      venue,
      city,
      match_no: matchNo,
      pool_id: poolId,
    },
  };
}

function stripCodeFence(s: string): string {
  let v = s.trim();
  // Quita ```json / ```javascript / ``` al inicio
  v = v.replace(/^```(?:json|javascript|js|ts|typescript)?\s*\r?\n?/i, "");
  // Quita ``` al final
  v = v.replace(/\r?\n?```\s*$/i, "");
  return v.trim();
}

export async function importMatches(formData: FormData) {
  const raw = stripCodeFence(String(formData.get("data") ?? ""));
  if (!raw) redirect("/admin/matches?error=Pega%20el%20JSON%20primero");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "JSON inválido";
    redirect(`/admin/matches?error=${encodeURIComponent("JSON inválido: " + msg)}`);
  }

  if (!Array.isArray(parsed)) {
    redirect("/admin/matches?error=El%20JSON%20debe%20ser%20un%20array%20de%20partidos");
  }

  const { supabase } = await requireSuper();

  const validRows: ImportRow[] = [];
  const errors: string[] = [];
  parsed.forEach((item, idx) => {
    const result = coerceImport(item);
    if ("error" in result) {
      errors.push(`#${idx + 1}: ${result.error}`);
    } else {
      validRows.push(result.row);
    }
  });

  if (validRows.length === 0) {
    redirect(
      `/admin/matches?error=${encodeURIComponent("Ningún partido válido. " + (errors[0] ?? ""))}`,
    );
  }

  // Separamos: los que tienen match_no van por upsert (para poder corregirlos después).
  // Los que no tienen match_no van por insert simple.
  const withNo = validRows.filter(r => r.match_no !== null);
  const withoutNo = validRows.filter(r => r.match_no === null);

  let inserted = 0;
  if (withNo.length > 0) {
    const { error, count } = await supabase
      .from("matches")
      .upsert(withNo, { onConflict: "match_no", count: "exact" });
    if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);
    inserted += count ?? withNo.length;
  }
  if (withoutNo.length > 0) {
    const { error, count } = await supabase
      .from("matches")
      .insert(withoutNo, { count: "exact" });
    if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);
    inserted += count ?? withoutNo.length;
  }

  revalidatePath("/admin/matches");
  const skippedMsg = errors.length > 0 ? ` · ${errors.length} omitidos` : "";
  redirect(`/admin/matches?ok=${encodeURIComponent(`${inserted} partidos importados${skippedMsg}`)}`);
}

export async function deleteMatch(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/matches?error=ID%20requerido");

  const { supabase, user } = await requireSuper();

  const { data: cur } = await supabase
    .from("matches")
    .select("home_team, away_team")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, user.id, "match_deleted", {
    match_id: id,
    home_team: cur?.home_team,
    away_team: cur?.away_team,
  });

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Partido%20eliminado");
}

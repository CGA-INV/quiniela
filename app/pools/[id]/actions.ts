"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPredictionOpen, PREDICTION_LOCK_MINUTES } from "@/lib/time";

export async function saveAllPredictions(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "");
  if (!poolId) redirect("/pools?error=Sala%20inv%C3%A1lida");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lee todos los pares home_<matchId> / away_<matchId> del form.
  const homes = new Map<string, string>();
  const aways = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("home_")) homes.set(key.slice(5), value);
    else if (key.startsWith("away_")) aways.set(key.slice(5), value);
  }

  const matchIds = Array.from(homes.keys());
  if (matchIds.length === 0) {
    redirect(`/pools/${poolId}?error=No%20hay%20datos%20para%20guardar`);
  }

  // Pre-filtramos los partidos cuyo plazo ya cerró (race entre carga y submit).
  const { data: matchTimes } = await supabase
    .from("matches")
    .select("id, kickoff_at")
    .in("id", matchIds);

  const openMatchIds = new Set<string>();
  for (const m of (matchTimes ?? []) as { id: string; kickoff_at: string }[]) {
    if (isPredictionOpen(m.kickoff_at)) openMatchIds.add(m.id);
  }

  const nowIso = new Date().toISOString();
  type PredRow = {
    user_id: string;
    pool_id: string;
    match_id: string;
    pred_home: number;
    pred_away: number;
    updated_at: string;
  };
  const rows: PredRow[] = [];
  let invalid = 0;
  let lockedOut = 0;

  for (const [matchId, hRaw] of homes) {
    const aRaw = aways.get(matchId) ?? "";
    if (hRaw.trim() === "" && aRaw.trim() === "") continue;

    if (!openMatchIds.has(matchId)) {
      lockedOut++;
      continue;
    }

    const h = Number(hRaw);
    const a = Number(aRaw);
    if (!Number.isInteger(h) || !Number.isInteger(a)
        || h < 0 || a < 0 || h > 20 || a > 20) {
      invalid++;
      continue;
    }
    rows.push({
      user_id: user.id,
      pool_id: poolId,
      match_id: matchId,
      pred_home: h,
      pred_away: a,
      updated_at: nowIso,
    });
  }

  if (rows.length === 0) {
    if (lockedOut > 0) {
      redirect(`/pools/${poolId}?error=${encodeURIComponent(
        `Ya cerró el plazo (${PREDICTION_LOCK_MINUTES} min antes del kickoff). No se guardó nada.`,
      )}`);
    }
    redirect(`/pools/${poolId}?error=No%20hay%20predicciones%20v%C3%A1lidas%20para%20guardar`);
  }

  const { error } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "user_id,pool_id,match_id" });

  if (error) {
    redirect(`/pools/${poolId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/pools/${poolId}`);
  const parts = [`${rows.length} predicciones guardadas`];
  if (lockedOut > 0) parts.push(`${lockedOut} ya habían cerrado`);
  if (invalid > 0) parts.push(`${invalid} con error`);
  redirect(`/pools/${poolId}?ok=${encodeURIComponent(parts.join(" · "))}`);
}

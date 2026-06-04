"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPredictionOpen } from "@/lib/time";

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
    redirect(`/pools/${poolId}?tab=partidos&error=No%20hay%20datos%20para%20guardar`);
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
      redirect(`/pools/${poolId}?tab=partidos&error=${encodeURIComponent(
        `Ya cerró el plazo (1 hora antes del kickoff). No se guardó nada.`,
      )}`);
    }
    redirect(`/pools/${poolId}?tab=partidos&error=No%20hay%20predicciones%20v%C3%A1lidas%20para%20guardar`);
  }

  const { error } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "user_id,pool_id,match_id" });

  if (error) {
    redirect(`/pools/${poolId}?tab=partidos&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/pools/${poolId}`);
  const parts = [`${rows.length} predicciones guardadas`];
  if (lockedOut > 0) parts.push(`${lockedOut} ya habían cerrado`);
  if (invalid > 0) parts.push(`${invalid} con error`);
  redirect(`/pools/${poolId}?tab=partidos&ok=${encodeURIComponent(parts.join(" · "))}`);
}

/** Voto en la encuesta de precio de la quiniela (3, 4 o 5 USD). Un voto por
 *  miembro; volver a votar reemplaza el anterior. */
export async function votePrice(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "");
  const price = Number(formData.get("price"));
  if (!poolId) redirect("/pools?error=Sala%20inv%C3%A1lida");
  if (![3, 4, 5].includes(price)) {
    redirect(`/pools/${poolId}?tab=reglas&error=Voto%20inv%C3%A1lido`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo miembros de la sala pueden votar.
  const { data: member } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect(`/pools/${poolId}?tab=reglas&error=No%20eres%20miembro%20de%20esta%20sala`);

  const { error } = await supabase
    .from("pool_price_votes")
    .upsert({ pool_id: poolId, user_id: user.id, price }, { onConflict: "pool_id,user_id" });

  if (error) {
    redirect(`/pools/${poolId}?tab=reglas&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/pools/${poolId}`);
  redirect(`/pools/${poolId}?tab=reglas&ok=${encodeURIComponent(`Votaste $${price} USD`)}`);
}

/** Voto: ¿se paga antes o después de saber el ganador? Un voto por miembro. */
export async function votePaymentTiming(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "");
  const timing = String(formData.get("timing") ?? "");
  if (!poolId) redirect("/pools?error=Sala%20inv%C3%A1lida");
  if (!["antes", "despues"].includes(timing)) {
    redirect(`/pools/${poolId}?tab=reglas&error=Voto%20inv%C3%A1lido`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect(`/pools/${poolId}?tab=reglas&error=No%20eres%20miembro%20de%20esta%20sala`);

  const { error } = await supabase
    .from("pool_payment_votes")
    .upsert({ pool_id: poolId, user_id: user.id, timing }, { onConflict: "pool_id,user_id" });

  if (error) {
    redirect(`/pools/${poolId}?tab=reglas&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/pools/${poolId}`);
  redirect(`/pools/${poolId}?tab=reglas&ok=${encodeURIComponent("Voto registrado")}`);
}

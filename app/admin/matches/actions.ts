"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/pools?error=Acceso%20restringido");
  return supabase;
}

const STAGES = [
  "group", "round_of_32", "round_of_16",
  "quarter", "semi", "third_place", "final",
] as const;

function nullable(s: string) {
  const v = s.trim();
  return v === "" ? null : v;
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

  const supabase = await requireAdmin();
  const { error } = await supabase.from("matches").insert({
    stage,
    group_label: groupLabel,
    home_team: homeTeam,
    away_team: awayTeam,
    kickoff_at: new Date(kickoff).toISOString(),
    venue,
    city,
    match_no: matchNo,
  });
  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Partido%20agregado");
}

export async function setMatchResult(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const homeScore = Number(formData.get("home_score") ?? -1);
  const awayScore = Number(formData.get("away_score") ?? -1);

  if (!id || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)
      || homeScore < 0 || awayScore < 0) {
    redirect("/admin/matches?error=Marcador%20inv%C3%A1lido");
  }

  const supabase = await requireAdmin();

  // Bloqueo: si ya está cerrado, rechazar (debe reabrir primero).
  const { data: cur } = await supabase
    .from("matches")
    .select("finished")
    .eq("id", id)
    .single();
  if (cur?.finished) {
    redirect("/admin/matches?error=El%20partido%20est%C3%A1%20cerrado.%20Reab%C3%ADrelo%20primero%20si%20necesitas%20cambiar%20el%20resultado.");
  }

  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      finished: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Resultado%20guardado");
}

export async function reopenMatch(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/matches?error=ID%20requerido");

  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("matches")
    .update({ finished: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

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

  return {
    row: {
      stage,
      group_label: groupLabel,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff_at: kickoffDate.toISOString(),
      venue,
      city,
      match_no: matchNo,
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

  const supabase = await requireAdmin();

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

  const supabase = await requireAdmin();
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) redirect(`/admin/matches?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/matches");
  redirect("/admin/matches?ok=Partido%20eliminado");
}

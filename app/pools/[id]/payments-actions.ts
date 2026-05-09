"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPoolWinner } from "@/lib/winner";

const MAX_BYTES = 5 * 1024 * 1024;

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80);
}

export async function uploadPaymentProof(formData: FormData) {
  const poolId = String(formData.get("pool_id") ?? "");
  const file = formData.get("proof") as File | null;
  if (!poolId) redirect("/pools?error=Sala%20inv%C3%A1lida");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!file || typeof file === "string" || file.size === 0) {
    redirect(`/pools/${poolId}?error=Adjunta%20un%20archivo`);
  }
  if (file.size > MAX_BYTES) {
    redirect(`/pools/${poolId}?error=El%20archivo%20supera%205MB`);
  }
  if (!file.type.startsWith("image/")) {
    redirect(`/pools/${poolId}?error=Solo%20im%C3%A1genes%20(JPG%2FPNG%2FWebP)`);
  }

  // Determina ganador de la sala
  const winner = await getPoolWinner(supabase, poolId);
  if (!winner) {
    redirect(`/pools/${poolId}?error=La%20fase%20de%20grupos%20a%C3%BAn%20no%20termina`);
  }
  if (winner.user_id === user.id) {
    redirect(`/pools/${poolId}?error=Eres%20el%20ganador%20%E2%80%94%20no%20pagas`);
  }

  // Sube el archivo
  const ext = (file.type.split("/")[1] ?? "bin").split(";")[0];
  const filename = `${Date.now()}-${safeName(file.name || `proof.${ext}`)}`;
  const path = `${poolId}/${user.id}/${filename}`;
  const buffer = await file.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from("payment-proofs")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
  if (upErr) {
    redirect(`/pools/${poolId}?error=${encodeURIComponent("Upload: " + upErr.message)}`);
  }

  const { data: urlData } = supabase.storage
    .from("payment-proofs")
    .getPublicUrl(path);

  // Inserta o actualiza el row de payment (resetea validated_at en re-upload)
  const { error: insErr } = await supabase
    .from("payments")
    .upsert(
      {
        pool_id: poolId,
        payer_id: user.id,
        payee_id: winner.user_id,
        proof_url: urlData.publicUrl,
        proof_path: path,
        uploaded_at: new Date().toISOString(),
        validated_at: null,
      },
      { onConflict: "pool_id,payer_id" },
    );
  if (insErr) {
    redirect(`/pools/${poolId}?error=${encodeURIComponent("DB: " + insErr.message)}`);
  }

  revalidatePath(`/pools/${poolId}`);
  redirect(`/pools/${poolId}?ok=Comprobante%20subido.%20Esperando%20validaci%C3%B3n%20del%20ganador.`);
}

export async function validatePayment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/pools?error=ID%20requerido");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: payment } = await supabase
    .from("payments")
    .select("pool_id, payee_id")
    .eq("id", id)
    .maybeSingle();
  if (!payment) redirect("/pools?error=Pago%20no%20encontrado");
  if (payment.payee_id !== user.id) {
    redirect(`/pools/${payment.pool_id}?error=Solo%20el%20ganador%20puede%20validar`);
  }

  const { error } = await supabase
    .from("payments")
    .update({ validated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    redirect(`/pools/${payment.pool_id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/pools/${payment.pool_id}`);
  redirect(`/pools/${payment.pool_id}?ok=Pago%20validado`);
}

export async function unvalidatePayment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/pools?error=ID%20requerido");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: payment } = await supabase
    .from("payments")
    .select("pool_id, payee_id")
    .eq("id", id)
    .maybeSingle();
  if (!payment) redirect("/pools?error=Pago%20no%20encontrado");
  if (payment.payee_id !== user.id) {
    redirect(`/pools/${payment.pool_id}?error=Solo%20el%20ganador%20puede%20cambiar%20validaci%C3%B3n`);
  }

  await supabase.from("payments").update({ validated_at: null }).eq("id", id);
  revalidatePath(`/pools/${payment.pool_id}`);
  redirect(`/pools/${payment.pool_id}?ok=Validaci%C3%B3n%20revertida`);
}

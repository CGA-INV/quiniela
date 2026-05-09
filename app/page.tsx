import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/pools");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <h1 className="text-5xl font-bold tracking-tight">Quiniela Mundial 2026</h1>
      <p className="mt-4 max-w-md text-slate-300">
        Predice los marcadores, compite con tus amigos y gana puntos.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 hover:bg-emerald-400 transition"
        >
          Crear cuenta
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-700 px-5 py-2.5 font-medium text-slate-100 hover:bg-slate-800 transition"
        >
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}

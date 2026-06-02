import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/pools");

  return (
    <main className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-[#0a1f1c] px-5 pb-16 text-slate-100">
      {/* Atmósfera de fondo */}
      <div className="atmosphere pointer-events-none absolute inset-0 z-0 opacity-25" />
      <div className="stadium-gradient pointer-events-none absolute inset-0 z-0" />

      {/* Marca */}
      <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between px-5 py-4">
        <span className="font-display text-2xl uppercase italic tracking-tight text-[#c6ff3d]">
          Mundial 2026
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-sm text-slate-400">
          🌐
        </span>
      </header>

      {/* Contenido */}
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-10 space-y-3">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#c6ff3d]/80">
            Próximamente
          </p>
          <h1 className="electric-glow text-5xl uppercase leading-[0.95] text-[#c6ff3d]">
            Tu quiniela del Mundial 2026
          </h1>
          <p className="max-w-xs text-lg text-slate-300">
            Predice los marcadores, compite con tus amigos y gana puntos.
          </p>
        </div>

        {/* Tarjeta glass con CTAs */}
        <div className="glass-panel space-y-3 rounded-2xl p-5">
          <Link
            href="/signup"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#c6ff3d] py-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition-all duration-200 hover:scale-[1.02] active:scale-95"
          >
            Crear cuenta <span aria-hidden>→</span>
          </Link>
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-md border border-slate-100/15 bg-slate-800/60 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-100 transition-colors hover:bg-slate-700/60"
          >
            Iniciar sesión
          </Link>
          <p className="pt-1 text-center text-[12px] leading-tight text-slate-400/70">
            Necesitas un código de invitación de tu administrador para registrarte.
          </p>
        </div>
      </div>
    </main>
  );
}

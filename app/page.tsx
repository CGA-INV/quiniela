import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParticleField } from "@/components/ParticleField";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/pools");

  return (
    <main className="relative flex h-screen flex-col justify-end overflow-hidden bg-[#0a1f1c] text-slate-100">
      {/* Capa de fondo: foto de la afición + gradiente */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/imagen/estadio.png"
          alt="Atmósfera Mundial 2026"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="stadium-gradient absolute inset-0" />
      </div>

      {/* Marca */}
      <header className="fixed left-0 top-0 z-20 flex w-full items-center justify-between px-5 py-4">
        <div className="font-display text-3xl uppercase italic tracking-tighter text-[#c6ff3d]">
          Mundial 2026
        </div>
      </header>

      {/* Contenido */}
      <div className="relative z-10 mx-auto mb-16 w-full max-w-md px-5">
        <div className="mb-10 space-y-2">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#c6ff3d]/80">
            Próximamente
          </p>
          <h1 className="electric-glow text-6xl uppercase leading-[0.92] text-[#c6ff3d]">
            Tu quiniela del Mundial 2026
          </h1>
          <p className="max-w-[280px] text-lg text-slate-300">
            Vive la emoción del torneo más grande del mundo y compite con tus amigos.
          </p>
        </div>

        {/* Tarjeta glass */}
        <div className="glass-panel mb-6 space-y-4 rounded-2xl p-6">
          <Link
            href="/signup"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#c6ff3d] py-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition-all duration-200 hover:scale-[1.02] active:scale-95"
          >
            Crear cuenta
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-100 transition-colors hover:bg-slate-700"
          >
            <span className="material-symbols-outlined text-[18px] text-[#c6ff3d]">login</span>
            Iniciar sesión
          </Link>
          <p className="pt-1 text-center text-[12px] leading-tight text-slate-400/70">
            Necesitas un código de invitación de tu administrador para registrarte.
          </p>
        </div>
      </div>

      {/* Partículas animadas */}
      <ParticleField />
    </main>
  );
}

import Link from "next/link";
import Image from "next/image";
import { signUpWithCode } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const { error, code } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-5 text-slate-100">
      <Image src="/imagen/aficion.png" alt="" fill priority sizes="100vw" className="object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f1c]/70 via-[#0a1f1c]/80 to-[#0a1f1c]/95" />
      <div className="atmosphere pointer-events-none absolute inset-0 z-0 opacity-20" />

      <div className="relative z-10 flex w-full max-w-md flex-col gap-8">
        <header className="text-center">
          <h1 className="mb-2 text-4xl uppercase italic tracking-tight text-slate-100">
            Crear cuenta
          </h1>
          <p className="text-base text-slate-400">
            Predice los marcadores y compite con tus amigos.
          </p>
        </header>

        <form
          action={signUpWithCode}
          className="glass-panel flex flex-col gap-4 rounded-2xl p-6 sm:p-8"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/15 p-3">
              <span
                className="material-symbols-outlined mt-0.5 text-red-400"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <p className="text-sm text-red-400">{decodeURIComponent(error)}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="display_name"
              className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400"
            >
              Nombre completo
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              minLength={2}
              maxLength={40}
              placeholder="Juan Pérez"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d] transition-colors"
            />
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400/70">
              mínimo 6 caracteres
            </p>
          </div>

          {/* Código de invitación resaltado */}
          <div className="mt-1 flex flex-col gap-1.5">
            <label
              htmlFor="code"
              className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#c6ff3d]"
            >
              Código de invitación
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              maxLength={20}
              defaultValue={code ?? ""}
              placeholder="EJ: WC26-PRO"
              className="glow-lime rounded-lg border border-[#c6ff3d] bg-slate-900 px-4 py-3 font-mono uppercase tracking-widest text-[#c6ff3d] placeholder:text-[#c6ff3d]/30 focus:outline-none focus:ring-2 focus:ring-[#c6ff3d]/50 transition-all"
            />
          </div>

          <button
            type="submit"
            className="glow-lime mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c6ff3d] py-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition-all hover:brightness-110 active:scale-95"
          >
            Crear cuenta
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>

          <p className="text-center text-base text-slate-400">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="text-[#c6ff3d] underline decoration-[#c6ff3d]/30 underline-offset-4 hover:brightness-110"
            >
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

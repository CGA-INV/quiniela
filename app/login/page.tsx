import Link from "next/link";
import { signInWithPassword } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a1f1c] p-5 text-slate-100">
      <div className="atmosphere pointer-events-none absolute inset-0 z-0 opacity-20" />

      <div className="relative z-10 flex w-full max-w-md flex-col gap-8">
        <header className="text-center">
          <h1 className="mb-2 text-4xl uppercase italic tracking-tight text-slate-100">
            Iniciar sesión
          </h1>
          <p className="text-base text-slate-400">
            Ingresa con tu correo y contraseña.
          </p>
        </header>

        <form
          action={signInWithPassword}
          className="glass-panel flex flex-col gap-4 rounded-2xl p-6 sm:p-8"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/15 p-3">
              <span aria-hidden className="text-red-400">⚠</span>
              <p className="text-sm text-red-400">{decodeURIComponent(error)}</p>
            </div>
          )}

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
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d] transition-colors"
            />
          </div>

          <button
            type="submit"
            className="glow-lime mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c6ff3d] py-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition-all hover:brightness-110 active:scale-95"
          >
            Entrar <span aria-hidden>→</span>
          </button>

          <p className="text-center text-base text-slate-400">
            ¿No tienes cuenta?{" "}
            <Link
              href="/signup"
              className="text-[#c6ff3d] underline decoration-[#c6ff3d]/30 underline-offset-4 hover:brightness-110"
            >
              Regístrate con tu código
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

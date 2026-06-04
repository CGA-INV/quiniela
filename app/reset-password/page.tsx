import { ScreenBackground } from "@/components/ScreenBackground";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-5 text-slate-100">
      <ScreenBackground src="/imagen/balon.webp" />

      <div className="relative z-10 flex w-full max-w-md flex-col gap-8">
        <header className="text-center">
          <h1 className="mb-2 text-4xl uppercase italic tracking-tight text-slate-100">
            Nueva contraseña
          </h1>
          <p className="text-base text-slate-400">Elige tu nueva contraseña.</p>
        </header>

        <form
          action={updatePassword}
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
              htmlFor="password"
              className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400"
            >
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition-colors focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d]"
            />
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400/70">
              mínimo 6 caracteres
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm"
              className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400"
            >
              Repetir contraseña
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition-colors focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d]"
            />
          </div>

          <button
            type="submit"
            className="glow-lime mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c6ff3d] py-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition-all hover:brightness-110 active:scale-95"
          >
            Guardar contraseña
          </button>
        </form>
      </div>
    </main>
  );
}

import Link from "next/link";
import { ScreenBackground } from "@/components/ScreenBackground";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-5 text-slate-100">
      <ScreenBackground src="/imagen/balon.webp" />

      <div className="relative z-10 flex w-full max-w-md flex-col gap-8">
        <header className="text-center">
          <h1 className="mb-2 text-4xl uppercase italic tracking-tight text-slate-100">
            Recuperar acceso
          </h1>
          <p className="text-base text-slate-400">
            Te enviamos un enlace a tu correo para crear una nueva contraseña.
          </p>
        </header>

        {sent ? (
          <div className="glass-panel rounded-2xl p-6 text-center sm:p-8">
            <div className="text-4xl">✉️</div>
            <p className="mt-3 text-slate-200">
              Si ese correo está registrado, te enviamos un enlace. Revisa tu bandeja
              de entrada (y la carpeta de spam).
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-[#c6ff3d] underline decoration-[#c6ff3d]/30 underline-offset-4 hover:brightness-110"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form
            action={requestPasswordReset}
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
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition-colors focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d]"
              />
            </div>

            <button
              type="submit"
              className="glow-lime mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c6ff3d] py-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition-all hover:brightness-110 active:scale-95"
            >
              Enviar enlace
            </button>

            <p className="text-center text-base text-slate-400">
              <Link
                href="/login"
                className="text-[#c6ff3d] underline decoration-[#c6ff3d]/30 underline-offset-4 hover:brightness-110"
              >
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

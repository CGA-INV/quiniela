import Link from "next/link";
import { signUpWithCode } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const { error, code } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="mt-1 text-sm text-slate-400">
          Necesitas un código de invitación que te dio el administrador.
        </p>

        <form action={signUpWithCode} className="mt-6 space-y-3">
          <input
            name="display_name"
            type="text"
            required
            minLength={2}
            maxLength={40}
            placeholder="Tu nombre"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Contraseña (mínimo 6)"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <input
            name="code"
            type="text"
            required
            maxLength={20}
            defaultValue={code ?? ""}
            placeholder="Código de invitación"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 uppercase tracking-wider text-slate-100 placeholder:text-slate-500 placeholder:normal-case placeholder:tracking-normal focus:border-emerald-500 focus:outline-none"
          />
          {error && (
            <p className="text-sm text-red-400">{decodeURIComponent(error)}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition"
          >
            Crear cuenta
          </button>
          <p className="text-center text-sm text-slate-400">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-emerald-400 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

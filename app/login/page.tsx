import Link from "next/link";
import { signInWithPassword } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ingresa con tu correo y contraseña.
        </p>

        <form action={signInWithPassword} className="mt-6 space-y-3">
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
            autoComplete="current-password"
            placeholder="Contraseña"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          {error && (
            <p className="text-sm text-red-400">{decodeURIComponent(error)}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition"
          >
            Entrar
          </button>
          <p className="text-center text-sm text-slate-400">
            ¿No tienes cuenta?{" "}
            <Link href="/signup" className="text-emerald-400 hover:underline">
              Regístrate con tu código
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

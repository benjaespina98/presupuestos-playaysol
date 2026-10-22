"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Wordmark } from "@/components/Wordmark";
import { botonDe } from "@/components/ui/botones";
import { rutaInternaSegura } from "@/lib/auth/rutaInterna";

/** Supabase responde en inglés: acá se traducen los casos comunes; el resto se muestra tal cual. */
function mensajeDeError(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return "El email o la contraseña no son correctos. Revisalos e intentá de nuevo.";
  if (/email not confirmed/i.test(mensaje)) return "Ese email todavía no fue confirmado.";
  if (/rate limit|too many/i.test(mensaje)) return "Demasiados intentos seguidos. Esperá un momento y volvé a probar.";
  if (/fetch|network/i.test(mensaje)) return "No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.";
  return mensaje;
}

const CLASE_INPUT =
  "min-h-11 w-full rounded-lg border border-gray-300 bg-[#FFFFFF] px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-celeste/40";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(mensajeDeError(error.message));
      return;
    }

    router.push(rutaInternaSegura(searchParams.get("redirectTo")));
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-[#FFFFFF] p-6 shadow-md sm:p-8">
        <div aria-hidden="true" className="-mx-6 -mt-6 mb-6 h-1.5 bg-acento sm:-mx-8 sm:-mt-8" />
        <div className="mb-6 flex flex-col items-center text-center">
          <Wordmark className="mb-2 h-10" />
          <p className="text-sm text-gray-500">Portal de presupuestos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={CLASE_INPUT}
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={CLASE_INPUT}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={botonDe("primario", "w-full text-base")}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

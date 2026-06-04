"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca los datos del servidor (marcadores en vivo, tabla de posiciones)
 * cada `intervalMs` mientras haya partidos EN VIVO. Solo refresca si la
 * pestaña está visible. No remonta los componentes cliente, así que las
 * predicciones que estés escribiendo no se pierden.
 */
export function LiveRefresher({
  active,
  intervalMs = 30000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { obtenerPresupuesto } from "@/lib/presupuestos";
import { usePuenteCalculadora } from "@/components/calculadora/puente";
import { CALCULATOR_STYLES } from "./styles";
import { buildCalculatorHtml } from "./markup";
import { CALCULATOR_SCRIPT } from "./script";

/**
 * Losetas no usa components/calculadora/Calculadora.tsx como las otras 4: su
 * script y sus estilos viajan en el bundle (no se sirven desde /public) y su
 * markup no comparte el layout de dos paneles. Lo que SÍ comparte es el puente
 * window.* (usePuenteCalculadora), que es el contrato que hay que mantener
 * alineado entre las 5.
 */
export default function LosetasCalculator() {
  const searchParams = useSearchParams();
  const presupuestoId = searchParams.get("id");
  const duplicarId = searchParams.get("duplicar");

  usePuenteCalculadora("losetas", presupuestoId);

  useEffect(() => {
    const scripts = ["/nombre-archivo.js", "/catalogo-modal.js"].map((src) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      return el;
    });

    const principal = document.createElement("script");
    principal.text = CALCULATOR_SCRIPT;
    scripts.push(principal);
    scripts.forEach((el) => document.body.appendChild(el));

    const idACargar = presupuestoId || duplicarId;
    if (idACargar) {
      obtenerPresupuesto(idACargar)
        .then((presupuesto) => window.cargarPresupuestoExterno?.(presupuesto.datos))
        .catch((err) => {
          console.error("No se pudo abrir el presupuesto", err);
          alert(
            "No se pudo abrir ese presupuesto. Puede que lo hayan borrado, o que se haya cortado la conexión."
          );
        });
    }

    return () => scripts.forEach((el) => el.remove());
  }, [presupuestoId, duplicarId]);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CALCULATOR_STYLES }} />
      <div
        className="pys-calc"
        data-calc="losetas"
        dangerouslySetInnerHTML={{ __html: buildCalculatorHtml() }}
      />
    </div>
  );
}

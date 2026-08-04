"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { obtenerPresupuesto, type TipoCalculadora } from "@/lib/presupuestos";
import { usePuenteCalculadora } from "./puente";
import "./calc.css";

/**
 * Envoltorio React de las 4 calculadoras "clásicas" (piscinas, revestimientos,
 * cobertores, cercos). Antes esto era el MISMO archivo de 133 líneas copiado 4
 * veces, que solo se diferenciaba en el nombre del componente, el src del script
 * y el href del CSS.
 *
 * Losetas no usa este componente: su script y sus estilos van embebidos en el
 * bundle en vez de servirse desde /public, y su markup no comparte el layout de
 * dos paneles. Sí comparte el puente (usePuenteCalculadora), que es lo que
 * importa mantener alineado.
 *
 * Qué hace, en orden:
 *   1. Instala el puente window.* ligado a este tipo de calculadora.
 *   2. Monta el HTML del formulario (los scripts legacy buscan sus #ids ahí).
 *   3. Inyecta los scripts en orden y, si la URL trae ?id= o ?duplicar=,
 *      carga ese presupuesto una vez que el script terminó de arrancar.
 */
export function Calculadora({
  tipo,
  html,
}: {
  tipo: TipoCalculadora;
  html: string;
}) {
  const searchParams = useSearchParams();
  const presupuestoId = searchParams.get("id");
  const duplicarId = searchParams.get("duplicar");

  usePuenteCalculadora(tipo, presupuestoId);

  useEffect(() => {
    // async=false en los tres para garantizar que se ejecuten en el orden en que
    // se agregan (nombre-archivo.js antes que <tipo>-calc.js, que lo usa al
    // descargar) — los <script> creados con createElement son async por defecto,
    // así que sin esto el orden de ejecución no está garantizado.
    const fuentes = ["/nombre-archivo.js", "/catalogo-modal.js", `/${tipo}-calc.js`];
    const scripts = fuentes.map((src) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      return el;
    });

    const principal = scripts[scripts.length - 1];
    principal.onload = async () => {
      const idACargar = presupuestoId || duplicarId;
      if (!idACargar) return;
      try {
        const presupuesto = await obtenerPresupuesto(idACargar);
        window.cargarPresupuestoExterno?.(presupuesto.datos);
      } catch (err) {
        console.error("No se pudo abrir el presupuesto", err);
        alert(
          "No se pudo abrir ese presupuesto. Puede que lo hayan borrado, o que se haya cortado la conexión."
        );
      }
    };

    scripts.forEach((el) => document.body.appendChild(el));
    return () => scripts.forEach((el) => el.remove());
  }, [tipo, presupuestoId, duplicarId]);

  // data-calc identifica la calculadora para las pocas reglas de calc.css que
  // varían por tipo. Es además el gancho por el que, si alguna se migra a React,
  // el componente nuevo puede reusar la misma hoja de estilos sin tocar el resto.
  return <div data-calc={tipo} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default Calculadora;

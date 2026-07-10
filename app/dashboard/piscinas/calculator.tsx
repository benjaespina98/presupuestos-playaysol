"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { buildCalculatorHtml } from "./markup";
import {
  guardarPresupuesto,
  listarPresupuestos,
  obtenerPresupuesto,
  actualizarPresupuesto,
  subirFotoPresupuesto,
  actualizarCatalogoItem,
} from "./presupuestos";

declare global {
  interface Window {
    guardarPresupuesto?: (datos: unknown, clienteNombre: string) => Promise<{ error: unknown }>;
    actualizarPresupuesto?: (id: string, datos: unknown, clienteNombre: string) => Promise<{ error: unknown }>;
    listarPresupuestos?: () => Promise<unknown>;
    subirFotoPresupuesto?: (blob: Blob) => Promise<{ url: string; error: null } | { error: unknown }>;
    actualizarCatalogoItem?: (
      clave: string,
      precio: number | null,
      descripcion?: string
    ) => Promise<{ error: unknown }>;
    cargarPresupuestoExterno?: (datos: unknown) => void;
    presupuestoEnEdicionId?: string | null;
  }
}

export default function PiscinasCalculator() {
  const [docxReady, setDocxReady] = useState(false);
  const [cssReady, setCssReady] = useState(false);
  const searchParams = useSearchParams();
  const presupuestoId = searchParams.get("id");
  const duplicarId = searchParams.get("duplicar");

  useEffect(() => {
    window.guardarPresupuesto = guardarPresupuesto;
    window.actualizarPresupuesto = actualizarPresupuesto;
    window.listarPresupuestos = listarPresupuestos;
    window.subirFotoPresupuesto = subirFotoPresupuesto;
    window.actualizarCatalogoItem = actualizarCatalogoItem;
    // Al duplicar, presupuestoEnEdicionId queda sin setear: "Guardar en la nube" debe
    // crear una fila nueva, no pisar el presupuesto original que se está copiando.
    window.presupuestoEnEdicionId = presupuestoId;
    return () => {
      delete window.guardarPresupuesto;
      delete window.actualizarPresupuesto;
      delete window.listarPresupuestos;
      delete window.subirFotoPresupuesto;
      delete window.actualizarCatalogoItem;
      delete window.presupuestoEnEdicionId;
    };
  }, [presupuestoId]);

  useEffect(() => {
    if (!docxReady) return;

    // async=false en los tres para garantizar que se ejecuten en el orden en que se
    // agregan (nombre-archivo.js antes que piscinas-calc.js, que lo usa al descargar) —
    // los <script> creados con createElement son async por defecto, así que sin esto
    // el orden de ejecución no está garantizado.
    const nombreArchivoScript = document.createElement("script");
    nombreArchivoScript.src = "/nombre-archivo.js";
    nombreArchivoScript.async = false;
    document.body.appendChild(nombreArchivoScript);

    const modalScript = document.createElement("script");
    modalScript.src = "/catalogo-modal.js";
    modalScript.async = false;
    document.body.appendChild(modalScript);

    const script = document.createElement("script");
    script.src = "/piscinas-calc.js";
    script.async = false;
    script.onload = async () => {
      const idACargar = presupuestoId || duplicarId;
      if (!idACargar) return;
      const presupuesto = await obtenerPresupuesto(idACargar);
      window.cargarPresupuestoExterno?.(presupuesto.datos);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(nombreArchivoScript);
      document.body.removeChild(modalScript);
      document.body.removeChild(script);
    };
  }, [docxReady, presupuestoId, duplicarId]);

  return (
    <div>
      <link
        rel="stylesheet"
        href="/piscinas-calc.css"
        onLoad={() => setCssReady(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js"
        strategy="afterInteractive"
        onReady={() => setDocxReady(true)}
      />
      {/* Oculto hasta que el CSS legacy termine de cargar: sin esto, el HTML
          del formulario aparece un instante sin estilos (FOUC) en cada
          navegación entre calculadoras, porque el <link> se vuelve a pedir
          de cero cada vez que este componente se monta. */}
      <div
        style={{ visibility: cssReady ? "visible" : "hidden" }}
        dangerouslySetInnerHTML={{ __html: buildCalculatorHtml() }}
      />
    </div>
  );
}

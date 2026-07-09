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

    const modalScript = document.createElement("script");
    modalScript.src = "/catalogo-modal.js";
    document.body.appendChild(modalScript);

    const script = document.createElement("script");
    script.src = "/piscinas-calc.js";
    script.onload = async () => {
      const idACargar = presupuestoId || duplicarId;
      if (!idACargar) return;
      const presupuesto = await obtenerPresupuesto(idACargar);
      window.cargarPresupuestoExterno?.(presupuesto.datos);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(modalScript);
      document.body.removeChild(script);
    };
  }, [docxReady, presupuestoId, duplicarId]);

  return (
    <div>
      <link rel="stylesheet" href="/piscinas-calc.css" />
      <Script
        src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js"
        strategy="afterInteractive"
        onLoad={() => setDocxReady(true)}
      />
      <div dangerouslySetInnerHTML={{ __html: buildCalculatorHtml() }} />
    </div>
  );
}

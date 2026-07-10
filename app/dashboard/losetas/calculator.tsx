"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { CALCULATOR_STYLES } from "./styles";
import { buildCalculatorHtml } from "./markup";
import { CALCULATOR_SCRIPT } from "./script";
import {
  guardarPresupuesto,
  listarPresupuestos,
  obtenerPresupuesto,
  actualizarPresupuesto,
  actualizarCatalogoItem,
} from "./presupuestos";

declare global {
  interface Window {
    guardarPresupuesto?: (datos: unknown, clienteNombre: string) => Promise<{ error: unknown }>;
    actualizarPresupuesto?: (id: string, datos: unknown, clienteNombre: string) => Promise<{ error: unknown }>;
    listarPresupuestos?: () => Promise<unknown>;
    actualizarCatalogoItem?: (
      clave: string,
      precio: number | null,
      descripcion?: string
    ) => Promise<{ error: unknown }>;
    cargarPresupuestoExterno?: (datos: unknown) => void;
    presupuestoEnEdicionId?: string | null;
  }
}

export default function LosetasCalculator() {
  const [html2canvasReady, setHtml2canvasReady] = useState(false);
  const searchParams = useSearchParams();
  const presupuestoId = searchParams.get("id");
  const duplicarId = searchParams.get("duplicar");

  useEffect(() => {
    window.guardarPresupuesto = guardarPresupuesto;
    window.actualizarPresupuesto = actualizarPresupuesto;
    window.listarPresupuestos = listarPresupuestos;
    window.actualizarCatalogoItem = actualizarCatalogoItem;
    window.presupuestoEnEdicionId = presupuestoId;
    return () => {
      delete window.guardarPresupuesto;
      delete window.actualizarPresupuesto;
      delete window.listarPresupuestos;
      delete window.actualizarCatalogoItem;
      delete window.presupuestoEnEdicionId;
    };
  }, [presupuestoId]);

  useEffect(() => {
    if (!html2canvasReady) return;

    const modalScript = document.createElement("script");
    modalScript.src = "/catalogo-modal.js";
    document.body.appendChild(modalScript);

    const script = document.createElement("script");
    script.text = CALCULATOR_SCRIPT;
    document.body.appendChild(script);

    const idACargar = presupuestoId || duplicarId;
    if (idACargar) {
      obtenerPresupuesto(idACargar).then((presupuesto) => {
        window.cargarPresupuestoExterno?.(presupuesto.datos);
      });
    }

    return () => {
      document.body.removeChild(modalScript);
      document.body.removeChild(script);
    };
  }, [html2canvasReady, presupuestoId, duplicarId]);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CALCULATOR_STYLES }} />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        strategy="afterInteractive"
        onReady={() => setHtml2canvasReady(true)}
      />
      <div
        className="pys-calc"
        dangerouslySetInnerHTML={{ __html: buildCalculatorHtml() }}
      />
    </div>
  );
}

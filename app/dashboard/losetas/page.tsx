"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CALCULATOR_STYLES } from "./styles";
import { buildCalculatorHtml } from "./markup";
import { CALCULATOR_SCRIPT } from "./script";
import { guardarPresupuesto, listarPresupuestos } from "./presupuestos";

declare global {
  interface Window {
    guardarPresupuesto?: (datos: unknown, clienteNombre: string) => Promise<{ error: unknown }>;
    listarPresupuestos?: () => Promise<unknown>;
  }
}

export default function LosetasPage() {
  const [html2canvasReady, setHtml2canvasReady] = useState(false);

  useEffect(() => {
    window.guardarPresupuesto = guardarPresupuesto;
    window.listarPresupuestos = listarPresupuestos;
    return () => {
      delete window.guardarPresupuesto;
      delete window.listarPresupuestos;
    };
  }, []);

  useEffect(() => {
    if (!html2canvasReady) return;

    const script = document.createElement("script");
    script.text = CALCULATOR_SCRIPT;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [html2canvasReady]);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CALCULATOR_STYLES }} />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        strategy="afterInteractive"
        onLoad={() => setHtml2canvasReady(true)}
      />
      <div
        className="pys-calc"
        dangerouslySetInnerHTML={{ __html: buildCalculatorHtml() }}
      />
    </div>
  );
}

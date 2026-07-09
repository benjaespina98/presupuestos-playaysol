"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { buildCalculatorHtml } from "./markup";
import { guardarPresupuesto, listarPresupuestos } from "./presupuestos";

declare global {
  interface Window {
    guardarPresupuesto?: (datos: unknown, clienteNombre: string) => Promise<{ error: unknown }>;
    listarPresupuestos?: () => Promise<unknown>;
  }
}

export default function CercosPage() {
  const [docxReady, setDocxReady] = useState(false);

  useEffect(() => {
    window.guardarPresupuesto = guardarPresupuesto;
    window.listarPresupuestos = listarPresupuestos;
    return () => {
      delete window.guardarPresupuesto;
      delete window.listarPresupuestos;
    };
  }, []);

  useEffect(() => {
    if (!docxReady) return;

    const script = document.createElement("script");
    script.src = "/cercos-calc.js";
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [docxReady]);

  return (
    <div>
      <link rel="stylesheet" href="/cercos-calc.css" />
      <Script
        src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js"
        strategy="afterInteractive"
        onLoad={() => setDocxReady(true)}
      />
      <div dangerouslySetInnerHTML={{ __html: buildCalculatorHtml() }} />
    </div>
  );
}

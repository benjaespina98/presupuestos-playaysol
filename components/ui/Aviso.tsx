import type { ReactNode } from "react";

export type TonoAviso = "error" | "aviso" | "ok" | "info";

const ESTILOS: Record<TonoAviso, { caja: string; icono: string; camino: string }> = {
  error: {
    caja: "border-[#FDA29B] bg-[#FEF3F2] text-[#912018]",
    icono: "text-[#B42318]",
    camino: "M12 8v5m0 3.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  aviso: {
    caja: "border-[#FEC84B] bg-[#FFFAEB] text-[#7A2E0E]",
    icono: "text-[#B54708]",
    camino: "M12 9v4m0 3.5h.01M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z",
  },
  ok: {
    caja: "border-[#75E0A7] bg-[#ECFDF3] text-[#05603A]",
    icono: "text-[#067647]",
    camino: "M8 12.5l2.5 2.5L16 9.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  info: {
    caja: "border-[#D9DFE3] bg-[#F4F8F9] text-[#1F2A30]",
    icono: "text-[#244B5A]",
    camino: "M12 16v-4.5m0-3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
};

/**
 * LOS avisos del portal: un error, una advertencia, una confirmación o un dato, siempre con la misma forma. Los
 * errores y las advertencias que frenan algo se anuncian como alerta; el resto, como estado (el lector de pantalla
 * los lee sin interrumpir).
 */
export function Aviso({
  tono,
  titulo,
  children,
  className = "",
  urgente = tono === "error",
}: {
  tono: TonoAviso;
  titulo?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Interrumpe al lector de pantalla (por defecto, sólo los errores). */
  urgente?: boolean;
}) {
  const e = ESTILOS[tono];
  return (
    <div role={urgente ? "alert" : "status"} className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm leading-snug ${e.caja} ${className}`}>
      <svg className={`mt-px h-[18px] w-[18px] shrink-0 ${e.icono}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={e.camino} />
      </svg>
      <div className="min-w-0 flex-1 break-words">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children}
      </div>
    </div>
  );
}

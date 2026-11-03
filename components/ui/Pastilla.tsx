import type { ReactNode } from "react";

export type TonoPastilla = "neutro" | "info" | "ok" | "aviso" | "error";

const TONOS: Record<TonoPastilla, string> = {
  neutro: "bg-[#EEF1F3] text-[#3E4A52]",
  info: "bg-[#E3F0F4] text-[#0E5F73]",
  ok: "bg-[#ECFDF3] text-[#05603A]",
  aviso: "bg-[#FFFAEB] text-[#7A2E0E]",
  error: "bg-[#FEF3F2] text-[#B42318]",
};

/** Un estado corto dentro de una fila: "Enviado", "A confirmar", "Desactivado", "Anulado". Un solo tamaño y una sola forma en todo el portal. */
export function Pastilla({ tono = "neutro", children, className = "" }: { tono?: TonoPastilla; children: ReactNode; className?: string }) {
  return <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium ${TONOS[tono]} ${className}`}>{children}</span>;
}

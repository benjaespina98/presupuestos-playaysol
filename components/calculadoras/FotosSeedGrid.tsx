import type { FotoSeed } from "@/lib/documentos/fotosSeed";

/** Grilla de fotos de referencia (catálogo, no fotos subidas por el
 *  usuario) — compartida entre los documentos de Piscinas, Revestimientos,
 *  Cercos y Cobertores. Ver lib/documentos/fotosSeed.ts. */
export function FotosSeedGrid({ fotos, columnas = 3 }: { fotos: FotoSeed[]; columnas?: 2 | 3 }) {
  if (!fotos.length) return null;
  return (
    <div className={`mt-2 grid gap-2 break-inside-avoid print:break-inside-avoid ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {fotos.map((foto) => (
        // eslint-disable-next-line @next/next/no-img-element -- foto de referencia estática (public/seeds), no puede depender de next/image
        <img key={foto.url} src={foto.url} alt="" className="aspect-square w-full rounded object-cover" />
      ))}
    </div>
  );
}

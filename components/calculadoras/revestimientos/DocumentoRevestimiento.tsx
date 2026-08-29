import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import type { ResolverFotosSeed } from "@/lib/documentos/modelo";
import { calcularRevestimiento } from "@/lib/domain/precios/revestimientos";
import { formatARS, formatNumero } from "@/lib/format/ars";
import { fotosSeedDeOpcional } from "@/lib/documentos/fotosSeed";
import { FotosSeedGrid } from "@/components/calculadoras/FotosSeedGrid";

const sinEdicion: ResolverFotosSeed = (_grupo, base) => base;

/**
 * El documento en pantalla de Revestimientos. Mismo contenido/orden que
 * `buildDocumentBody()` en `public/revestimientos-calc.js`.
 *
 * La regla que distingue a esta calculadora (ver lib/domain/precios/
 * revestimientos.ts): cada material tildado es una `alternativa` con SU
 * PROPIO total — con 2+ materiales, el documento imprime una línea "TOTAL
 * revestimiento con <nombre corto>" por cada uno, nunca una suma. Con 0 o 1,
 * una sola línea "TOTAL REVESTIMIENTO".
 *
 * Los m² (piso/paredes/total) se recalculan acá llamando de nuevo a
 * `calcularRevestimiento` con las medidas congeladas del snapshot — es
 * aritmética pura sobre datos que ya están congelados, no una nueva
 * cotización: no toca precios ni catálogo, así que no rompe la regla de "un
 * presupuesto viejo no depende del catálogo actual".
 */

const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#244B5A", img: "/header-navy.png" }, // Azul Institucional oficial (RGB 36,75,90)
};

function splitDimensionLines(text: string): string[] {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Saca el paréntesis final tipo "(por m² instalado)" para la línea de
 *  total — mismo criterio que `revestShortName()` del legacy. */
function nombreCorto(desc: string): string {
  const s = String(desc || "").trim();
  const corto = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return corto || s;
}

function profundidadTexto(min: number, max: number, variable: boolean): string {
  if (variable) return `de ${formatNumero(min)} m a ${formatNumero(max)} m de profundidad`;
  return `profundidad ${formatNumero(min)} m`;
}

export interface FotoDocumento {
  id: string;
  url: string;
  caption: string;
}

type Medidas = {
  largo?: number;
  ancho?: number;
  profMin?: number;
  profMax?: number;
  escalera?: number;
  desperdicio?: number;
  adicionalesM2?: { label: string; m2: number }[];
};

export function DocumentoRevestimiento({
  snapshot,
  textos,
  fotos,
  resolverFotosSeed = sinEdicion,
}: {
  snapshot: PresupuestoV1;
  textos: TextosCompartidos;
  fotos: FotoDocumento[];
  resolverFotosSeed?: ResolverFotosSeed;
}) {
  const medidas = snapshot.medidas as Medidas;
  const adicionalesM2 = medidas.adicionalesM2 ?? [];
  const r = calcularRevestimiento({
    largo: medidas.largo ?? 0,
    ancho: medidas.ancho ?? 0,
    profMin: medidas.profMin ?? 0,
    profMax: medidas.profMax ?? 0,
    escalera: medidas.escalera ?? 0,
    desperdicio: medidas.desperdicio ?? 0,
    adicionalesM2: adicionalesM2.map((a) => a.m2),
    materiales: [],
    adicionales: [],
  });

  const variante = HEADER_VARIANTS[snapshot.variacionEncabezado] ?? HEADER_VARIANTS.teal;
  const materialesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "alternativa" && l.incluida);
  // Sólo los que tienen precio (y por lo tanto un total real) definen si hay
  // una o varias líneas de TOTAL — un incluido "a cotizar" se ve en
  // "Revestimiento cotizado" como "No incluye" pero no genera línea de total
  // ni cuenta para el umbral de 2, igual que `computeTotalesPorRevestimiento()`.
  const materialesConTotal = materialesIncluidos.filter((m) => m.total !== null);
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const lineasDimension = splitDimensionLines(snapshot.detalle);
  const f = textos.footer;
  const mapsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Playa y Sol S.A.S.") +
    "&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA";

  const partesM2 = [`Piso: ${formatNumero(r.m2Piso)} m²`, `Paredes: ${formatNumero(r.m2Paredes)} m²`];
  if ((medidas.escalera ?? 0) > 0) partesM2.push(`Escalera: ${formatNumero(medidas.escalera ?? 0)} m²`);
  if ((medidas.desperdicio ?? 0) > 0) partesM2.push(`Desperdicio: ${formatNumero(medidas.desperdicio ?? 0)} m²`);
  adicionalesM2.forEach((a) => {
    if (a.m2 > 0) partesM2.push(`${a.label || "Adicional"}: ${formatNumero(a.m2)} m²`);
  });

  return (
    <div
      id="documento-revestimiento"
      className="mx-auto max-w-2xl bg-white text-[#1C2B33] print:max-w-none"
      style={{ fontFamily: 'Calibri, "Carlito", Arial, sans-serif' }} // manual de marca: Calibri para todo el texto de comunicación/lectura
    >
      {/* El asset YA es el banner de marca completo, a todo lo ancho (ver
          DocumentoPiscina.tsx) — no un ícono cuadrado a recentrar. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- documento imprimible, no la app */}
      <img src={variante.img} alt="Playa & Sol" className="block h-auto w-full" />

      <div className="space-y-6 p-6 print:p-0 print:pt-4">
        <h1 className="border-b-2 border-[#00829C] pb-1 text-center text-lg font-bold uppercase tracking-wide text-[#244B5A]">
          Presupuesto de revestimiento para piscina
        </h1>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-[#EEF2F6] p-4 text-sm sm:grid-cols-2">
          <Meta label="Fecha:" value={snapshot.fecha} />
          <Meta label="Señor/Sra:" value={snapshot.cliente.nombre} />
          <Meta label="Domicilio:" value={snapshot.cliente.domicilio} />
          <Meta label="Localidad:" value={snapshot.cliente.localidad} />
          <Meta label="Tel:" value={snapshot.cliente.telefono} />
          <Meta label="Email:" value={snapshot.cliente.email} />
          <div className="sm:col-span-2">
            <span className="font-bold">Medidas:</span> {formatNumero(medidas.largo ?? 0)} m largo ×{" "}
            {formatNumero(medidas.ancho ?? 0)} m ancho, {profundidadTexto(r.profundidadMin, r.profundidadMax, r.profundidadVariable)}
          </div>
          <div className="sm:col-span-2">
            {partesM2.join(" + ")} = <span className="font-bold">total {formatNumero(r.m2Total)} m² a revestir</span>
          </div>
        </dl>

        {lineasDimension.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#244B5A]">
              Notas de la pileta
            </h2>
            <ul className="list-disc space-y-1 border-l-4 border-[#244B5A] pl-6 text-sm">
              {lineasDimension.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
          </section>
        )}

        {materialesIncluidos.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#244B5A]">
              Revestimiento cotizado
            </h2>
            <div className="space-y-2 text-sm">
              {materialesIncluidos.map((m, i) => (
                <div key={i} className="break-inside-avoid border-b border-dotted border-gray-300 py-1 print:break-inside-avoid">
                  <div className="flex justify-between">
                    <span>{m.descripcion}</span>
                    <span>{m.total === null ? "No incluye" : formatARS(m.total)}</span>
                  </div>
                  {m.precioUnitario !== null && m.total !== null && (
                    <p className="text-xs text-gray-500">
                      {formatARS(m.precioUnitario)} por m² × {formatNumero(r.m2Total)} m²
                    </p>
                  )}
                  <FotosSeedGrid fotos={resolverFotosSeed(m.clave ?? "sin-clave", fotosSeedDeOpcional(m.clave))} />
                </div>
              ))}
            </div>
          </section>
        )}

        {adicionales.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#244B5A]">
              Adicionales
            </h2>
            <div className="space-y-1 text-sm">
              {adicionales.map((a, i) => (
                <div key={i} className="flex justify-between border-b border-dotted border-gray-300 py-1">
                  <span>{a.descripcion}</span>
                  <span>{formatARS(a.total ?? 0)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div data-testid="totales" className="space-y-1 border-t-2 border-[#244B5A] pt-3">
          {materialesConTotal.length >= 2 ? (
            materialesConTotal.map((m, i) => (
              <div key={i} className="flex justify-between text-base font-bold text-[#244B5A]">
                <span>TOTAL revestimiento con {nombreCorto(m.descripcion)}</span>
                <span>{formatARS(snapshot.totales[i])}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between text-base font-bold text-[#244B5A]">
              <span>TOTAL REVESTIMIENTO</span>
              <span>{formatARS(snapshot.totales[0] ?? 0)}</span>
            </div>
          )}
        </div>

        <p className="text-sm font-bold">
          El presente presupuesto tiene una validez de {snapshot.validezDias} días.
        </p>

        <p className="whitespace-pre-line text-xs leading-relaxed text-gray-700">{textos.legal}</p>

        {fotos.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#244B5A]">Fotos ilustrativas</h2>
            <div className="grid grid-cols-2 gap-3">
              {fotos.map((foto) => (
                <figure key={foto.id} className="break-inside-avoid print:break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por el usuario */}
                  <img src={foto.url} alt="" loading="lazy" decoding="async" className="w-full rounded-md object-cover" />
                  {foto.caption && <figcaption className="mt-1 text-xs text-gray-500">{foto.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        <footer className="break-inside-avoid space-y-1 border-t border-[#E1E7EC] pt-4 text-xs text-[#244B5A] print:break-inside-avoid">
          <p className="font-bold tracking-wide">{f.empresa}</p>
          {f.direccion && (
            <p>
              Dirección:{" "}
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="underline">
                {f.direccion}
              </a>
            </p>
          )}
          {f.telFijo && <p>Tel: {f.telFijo}</p>}
          {(f.contactoNombre || f.contactoCel) && (
            <p>
              Contacto: {f.contactoNombre}
              {f.contactoCel ? ` - Cel. ${f.contactoCel}` : ""}
            </p>
          )}
          {f.whatsapp && <p>WhatsApp: {f.whatsapp}</p>}
          {f.email && <p>E-mail: {f.email}</p>}
          {f.web && <p>Web: {f.web}</p>}
          {f.facebook && <p>Facebook: {f.facebook}</p>}
          {f.instagram && <p>Instagram: {f.instagram}</p>}
        </footer>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-bold">{label}</span> {value}
    </div>
  );
}

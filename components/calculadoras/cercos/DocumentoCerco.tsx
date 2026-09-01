import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import type { ResolverFotosSeed } from "@/lib/documentos/modelo";
import { formatARS } from "@/lib/format/ars";
import { FOTOS_REFERENCIA_CERCOS, GRUPO_SEED_GENERAL } from "@/lib/documentos/fotosSeed";
import { FotosSeedGrid } from "@/components/calculadoras/FotosSeedGrid";

const sinEdicion: ResolverFotosSeed = (_grupo, base) => base;

/**
 * El documento en pantalla — lo que se ve en el panel de "Vista previa" y lo
 * que sale si el usuario imprime esa pantalla a mano (Ctrl+P del navegador).
 * El botón "PDF" de la calculadora NO pasa por acá: genera el PDF real con
 * `@react-pdf/renderer` a partir de `armarBloquesCerco()` (ver
 * lib/documentos/pdfGenerator.tsx / components/documentos/pdf/
 * PresupuestoPdfDocument.tsx) — un renderer aparte, sin DOM ni CSS de por
 * medio. Este componente y ese PDF muestran el mismo contenido porque los
 * dos leen el mismo `PresupuestoV1`, no porque uno derive del otro.
 *
 * Mismo contenido y mismo orden que `buildDocumentBody()` en
 * `public/cercos-calc.js` (no se reinventa el documento — Lote 1 de la Fase 5
 * lo pide explícitamente), traducido a JSX en vez de strings de HTML armados
 * a mano. `lib/documentos/cercos/docx.ts` es la otra salida del mismo dato;
 * ninguna de las dos recalcula nada — ambas leen `snapshot.totales` y
 * `snapshot.lineas`, ya congelados.
 */

const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#244B5A", img: "/header-navy.png" }, // Azul Institucional oficial (RGB 36,75,90)
};

/** Mismo criterio que `splitDimensionLines` del legacy: renglones cortos por
 *  salto de línea y por punto seguido de mayúscula, no un párrafo corrido. */
function splitDimensionLines(text: string): string[] {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function etiquetasTotal(modo: PresupuestoV1["modoPrecio"]): string[] {
  if (modo === "sin") return ["TOTAL"];
  if (modo === "con") return ["TOTAL (incluye instalación)"];
  return ["TOTAL SIN INSTALACIÓN", "TOTAL CON INSTALACIÓN"];
}

export interface FotoDocumento {
  id: string;
  url: string;
  caption: string;
}

export function DocumentoCerco({
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
  const medidas = snapshot.medidas as { metrosLineales?: number };
  const ml = Number(medidas.metrosLineales ?? 0);
  const variante = HEADER_VARIANTS[snapshot.variacionEncabezado] ?? HEADER_VARIANTS.teal;
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  // Igual que el legacy: sólo los opcionales TILDADOS aparecen en el
  // documento. Uno sin tildar no sale como "No incluye" — no sale.
  const opcionalesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "informativa" && l.incluida);
  const etiquetas = etiquetasTotal(snapshot.modoPrecio);
  const lineasDimension = splitDimensionLines(snapshot.detalle);
  const f = textos.footer;
  const mapsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Playa y Sol S.A.S.") +
    "&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA";

  return (
    <div
      id="documento-cerco"
      className="mx-auto max-w-2xl bg-white text-[#1C2B33] print:max-w-none"
      style={{ fontFamily: 'Calibri, "Carlito", Arial, sans-serif' }} // manual de marca: Calibri para todo el texto de comunicación/lectura
    >
      {/* El asset YA es el banner de marca completo, a todo lo ancho (ver
          DocumentoPiscina.tsx) — no un ícono cuadrado a recentrar. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- documento imprimible, no la app */}
      <img src={variante.img} alt="Playa & Sol" className="block h-auto w-full" />

      <div className="space-y-6 p-6 print:p-0 print:pt-4">
        <h1 className="border-b-2 border-[#00829C] pb-1 text-center text-lg font-bold uppercase tracking-wide text-[#244B5A]">
          Presupuesto de cerco perimetral
        </h1>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-[#EEF2F6] p-4 text-sm sm:grid-cols-2">
          <Meta label="Fecha:" value={snapshot.fecha} />
          <Meta label="Señor/Sra:" value={snapshot.cliente.nombre} />
          <Meta label="Domicilio:" value={snapshot.cliente.domicilio} />
          <Meta label="Localidad:" value={snapshot.cliente.localidad} />
          <Meta label="Tel:" value={snapshot.cliente.telefono} />
          <Meta label="Email:" value={snapshot.cliente.email} />
          <Meta label="Metros lineales a cercar:" value={`${ml.toLocaleString("es-AR")} ml`} />
        </dl>

        <section className="break-inside-avoid print:break-inside-avoid">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#244B5A]">Fotos de referencia</h2>
          <FotosSeedGrid fotos={resolverFotosSeed(GRUPO_SEED_GENERAL, FOTOS_REFERENCIA_CERCOS)} columnas={2} />
        </section>

        {lineasDimension.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#244B5A]">
              Detalle del recorrido
            </h2>
            <ul className="list-disc space-y-1 border-l-4 border-[#244B5A] pl-6 text-sm">
              {lineasDimension.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
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
          {snapshot.totales.map((t, i) => (
            <div key={etiquetas[i]} className="flex justify-between text-base font-bold text-[#244B5A]">
              <span>{etiquetas[i]}</span>
              <span>{formatARS(t)}</span>
            </div>
          ))}
        </div>

        {opcionalesIncluidos.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#244B5A]">
              Opcionales
            </h2>
            <div className="space-y-2 text-sm">
              {opcionalesIncluidos.map((op, i) => (
                <div key={i} className="break-inside-avoid rounded-md border border-[#E1E7EC] bg-[#FAFBFC] p-3 print:break-inside-avoid">
                  <div className="flex justify-between font-semibold">
                    <span>{op.descripcion}</span>
                    <span className={op.precioUnitario === null ? "text-gray-400" : "text-[#244B5A]"}>
                      {op.precioUnitario === null ? "No incluye" : formatARS(op.precioUnitario)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-sm font-bold">
          El presente presupuesto tiene una validez de {snapshot.validezDias} días.
        </p>

        <p className="whitespace-pre-line text-xs leading-relaxed text-gray-700">{textos.legal}</p>

        {fotos.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#244B5A]">
              Fotos ilustrativas
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {fotos.map((foto) => (
                <figure key={foto.id} className="break-inside-avoid print:break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por el usuario, no un asset estático */}
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

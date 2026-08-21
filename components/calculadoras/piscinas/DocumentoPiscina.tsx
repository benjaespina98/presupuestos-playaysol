import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { precioDeOpcional } from "@/lib/domain/precios/piscinas";
import { formatARS } from "@/lib/format/ars";
import { FOTOS_GENERALES, fotosSeedDeOpcional, type FotoSeed } from "@/lib/documentos/piscinas/fotosSeed";

/**
 * El documento en pantalla de Piscinas. Mismo contenido/orden que
 * `buildDocumentBody()` en `public/piscinas-calc.js`. Dos reglas propias de
 * piscinas que NO son las de cercos/cobertores (ver lib/domain/precios/
 * piscinas.ts):
 *
 *   - SUBTOTAL siempre se muestra. TOTAL sólo aparece si hay al menos un
 *     adicional cargado.
 *   - Los opcionales se muestran TODOS (no sólo los tildados): tildado y con
 *     precio → el importe, cualquier otro caso → "No incluye".
 *
 * El heading "Dimensión piscina" también se muestra siempre, tenga o no
 * contenido debajo — así es el legacy (`buildDocumentBody` no lo condiciona,
 * a diferencia de cercos/cobertores) y se preserva tal cual: es una
 * particularidad rara pero funcional, no un bug a corregir en una migración.
 */

const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#214D5A", img: "/header-navy.png" },
};

function splitDimensionLines(text: string): string[] {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface FotoDocumento {
  id: string;
  url: string;
  caption: string;
}

export function DocumentoPiscina({
  snapshot,
  textos,
  fotos,
}: {
  snapshot: PresupuestoV1;
  textos: TextosCompartidos;
  fotos: FotoDocumento[];
}) {
  const variante = HEADER_VARIANTS[snapshot.variacionEncabezado] ?? HEADER_VARIANTS.teal;
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionales = snapshot.lineas.filter((l) => l.naturaleza === "informativa");
  const hayAdicionales = adicionales.length > 0;
  const subtotal = snapshot.totales[0] ?? 0;
  const total = snapshot.totales[1];
  const lineasDimension = splitDimensionLines(snapshot.detalle);
  const f = textos.footer;
  const mapsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Playa y Sol S.A.S.") +
    "&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA";

  return (
    <div id="documento-piscina" className="mx-auto max-w-2xl bg-white text-[#1C2B33] print:max-w-none">
      <div className="flex h-24 items-center justify-center print:h-20" style={{ background: variante.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- documento imprimible, no la app */}
        <img src={variante.img} alt="Playa &amp; Sol" className="h-16 w-16 object-contain" />
      </div>

      <div className="space-y-6 p-6 print:p-0 print:pt-4">
        <h1 className="border-b-2 border-[#00829C] pb-1 text-center text-lg font-bold uppercase tracking-wide text-[#1B3A5C]">
          Presupuesto de construcción piscina
        </h1>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-[#EEF2F6] p-4 text-sm sm:grid-cols-2">
          <Meta label="Fecha:" value={snapshot.fecha} />
          <Meta label="Señor/Sra:" value={snapshot.cliente.nombre} />
          <Meta label="Domicilio:" value={snapshot.cliente.domicilio} />
          <Meta label="Localidad:" value={snapshot.cliente.localidad} />
          <Meta label="Tel:" value={snapshot.cliente.telefono} />
          <Meta label="Email:" value={snapshot.cliente.email} />
        </dl>

        <section>
          <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#1B3A5C]">
            Dimensión piscina
          </h2>
          {lineasDimension.length > 0 && (
            <ul className="list-disc space-y-1 border-l-4 border-[#1B3A5C] pl-6 text-sm">
              {lineasDimension.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
          )}
        </section>

        <div data-testid="totales" className="space-y-1 border-t-2 border-[#1B3A5C] pt-3">
          <div className="flex justify-between text-base font-bold text-[#1B3A5C]">
            <span>SUBTOTAL</span>
            <span>{formatARS(subtotal)}</span>
          </div>
          {hayAdicionales &&
            adicionales.map((a, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-700">
                <span>{a.descripcion}</span>
                <span>{formatARS(a.total ?? 0)}</span>
              </div>
            ))}
          {hayAdicionales && total !== undefined && (
            <div className="flex justify-between text-base font-bold text-[#1B3A5C]">
              <span>TOTAL</span>
              <span>{formatARS(total)}</span>
            </div>
          )}
        </div>

        {opcionales.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-[#00829C] pb-1 text-xs font-bold uppercase tracking-wide text-[#1B3A5C]">
              Opcionales
            </h2>
            <div className="space-y-2 text-sm">
              {opcionales.map((op, i) => {
                const precio = precioDeOpcional({ incluida: op.incluida, precioUnitario: op.precioUnitario });
                const fotos = fotosSeedDeOpcional(op.clave);
                return (
                  <div key={i} className="rounded-md border border-[#E1E7EC] bg-[#FAFBFC] p-3">
                    <div className="flex justify-between font-semibold">
                      <span>{op.descripcion}</span>
                      <span className={precio === null ? "text-gray-400" : "text-[#1B3A5C]"}>
                        {precio === null ? "No incluye" : formatARS(precio)}
                      </span>
                    </div>
                    {fotos.length > 0 && <FotosSeedGrid fotos={fotos} />}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="text-sm font-bold">
          El presente presupuesto tiene una validez de {snapshot.validezDias} días.
        </p>

        <p className="whitespace-pre-line text-xs leading-relaxed text-gray-700">{textos.legal}</p>

        {fotos.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1B3A5C]">Fotos ilustrativas</h2>
            <div className="grid grid-cols-2 gap-3">
              {fotos.map((foto) => (
                <figure key={foto.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por el usuario */}
                  <img src={foto.url} alt="" className="w-full rounded-md object-cover" />
                  {foto.caption && <figcaption className="mt-1 text-xs text-gray-500">{foto.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        <footer className="space-y-1 border-t border-[#E1E7EC] pt-4 text-xs text-[#1B3A5C]">
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

        {/* Modelos de referencia: van al final, después del pie de la empresa
            — mismo lugar que en un presupuesto real ya entregado (no es un
            error de orden, es la posición que el negocio ya usaba). */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1B3A5C]">Modelos de referencia</h2>
          <FotosSeedGrid fotos={FOTOS_GENERALES} columnas={3} />
        </section>
      </div>
    </div>
  );
}

function FotosSeedGrid({ fotos, columnas = 3 }: { fotos: FotoSeed[]; columnas?: number }) {
  return (
    <div className={`mt-2 grid gap-2 ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {fotos.map((foto) => (
        // eslint-disable-next-line @next/next/no-img-element -- foto de referencia estática (public/seeds), no puede depender de next/image
        <img key={foto.url} src={foto.url} alt="" className="aspect-square w-full rounded object-cover" />
      ))}
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

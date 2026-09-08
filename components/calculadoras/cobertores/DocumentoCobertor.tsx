import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { formatARS, formatNumero } from "@/lib/format/ars";
import type { ResolverFotosSeed } from "@/lib/documentos/modelo";
import { FOTOS_REFERENCIA_COBERTORES, GRUPO_SEED_GENERAL } from "@/lib/documentos/fotosSeed";
import { FotosSeedGrid } from "@/components/calculadoras/FotosSeedGrid";
import { TextoLegal, PieDocumento } from "@/components/calculadoras/TextosDocumento";

/**
 * El documento en pantalla de Cobertores. Mismo contenido/orden que
 * `buildDocumentBody()` en `public/cobertores-calc.js` (no se reinventa el
 * documento). Estructura idéntica a components/calculadoras/cercos/
 * DocumentoCerco.tsx salvo el título y la línea de "Medidas" — el texto
 * legal y el pie sí se extrajeron a un componente compartido
 * (TextosDocumento.tsx), el resto sigue sin extraer.
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

const sinEdicion: ResolverFotosSeed = (_grupo, base) => base;

export function DocumentoCobertor({
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
  const medidas = snapshot.medidas as { largo?: number; ancho?: number; adicionalM2?: number };
  const largo = Number(medidas.largo ?? 0);
  const ancho = Number(medidas.ancho ?? 0);
  const adicionalM2 = Number(medidas.adicionalM2 ?? 0);
  const espejoM2 = largo * ancho;
  const m2 = espejoM2 + adicionalM2;

  const medidasTexto = [`${formatNumero(largo)} m largo × ${formatNumero(ancho)} m ancho = ${formatNumero(espejoM2)} m²`];
  if (adicionalM2) medidasTexto.push(`Adicional: ${formatNumero(adicionalM2)} m²`);

  const variante = HEADER_VARIANTS[snapshot.variacionEncabezado] ?? HEADER_VARIANTS.teal;
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionalesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "informativa" && l.incluida);
  const etiquetas = etiquetasTotal(snapshot.modoPrecio);
  const lineasDimension = splitDimensionLines(snapshot.detalle);

  return (
    <div
      id="documento-cobertor"
      className="mx-auto max-w-2xl bg-white text-[#1C2B33] print:max-w-none"
      style={{ fontFamily: 'Calibri, "Carlito", Arial, sans-serif' }} // manual de marca: Calibri para todo el texto de comunicación/lectura
    >
      {/* El asset YA es el banner de marca completo, a todo lo ancho (ver
          DocumentoPiscina.tsx) — no un ícono cuadrado a recentrar. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- documento imprimible, no la app */}
      <img src={variante.img} alt="Playa & Sol" className="block h-auto w-full" />

      <div className="space-y-6 p-6 print:p-0 print:pt-4">
        <h1 className="border-b-2 border-[#00829C] pb-1 text-center text-lg font-bold uppercase tracking-wide text-[#244B5A]">
          Presupuesto de cobertor para piscina
        </h1>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-[#EEF2F6] p-4 text-sm sm:grid-cols-2">
          <Meta label="Fecha:" value={snapshot.fecha} />
          <Meta label="Señor/Sra:" value={snapshot.cliente.nombre} />
          <Meta label="Domicilio:" value={snapshot.cliente.domicilio} />
          <Meta label="Localidad:" value={snapshot.cliente.localidad} />
          <Meta label="Tel:" value={snapshot.cliente.telefono} />
          <Meta label="Email:" value={snapshot.cliente.email} />
          <div className="sm:col-span-2">
            <span className="font-bold">Medidas:</span> {medidasTexto.join(" + ")} = {formatNumero(m2)} m² a cubrir
          </div>
        </dl>

        <section className="break-inside-avoid print:break-inside-avoid">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#244B5A]">Fotos de referencia</h2>
          <FotosSeedGrid fotos={resolverFotosSeed(GRUPO_SEED_GENERAL, FOTOS_REFERENCIA_COBERTORES)} columnas={2} />
        </section>

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

        <TextoLegal texto={textos.legal} />

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

        <PieDocumento textos={textos} />
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

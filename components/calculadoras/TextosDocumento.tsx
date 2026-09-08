import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Playa y Sol S.A.S.") +
  "&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA";

/**
 * Texto legal (`TextoLegal`) y pie de página (`PieDocumento`) del documento
 * en pantalla — idénticos en las 4 calculadoras tradicionales (piscinas/
 * cercos/cobertores/revestimientos), antes copiados y pegados en cada
 * Documento*.tsx por separado. Van como dos componentes, no uno solo,
 * porque cada documento los intercala con otro contenido en el medio
 * (la galería de "Fotos ilustrativas" queda entre los dos) — el orden es
 * el mismo que ya traía `buildDocumentBody()` del legacy, no se reordena.
 *
 * Antes salía todo en `text-xs` (12px), del mismo tamaño que una nota al pie
 * y con el mismo peso visual que cualquier otro texto secundario — quedaba
 * casi invisible contra el resto del documento (bug reportado: "el pie
 * debería ser más prolijo y protagonista, casi no se ve"). Ahora el legal
 * sube a `text-sm` y el pie pasa a ser una tarjeta propia (fondo + borde),
 * con el nombre de la empresa como título y el resto de los datos en una
 * grilla de dos columnas — mismo tratamiento que ya usa la ficha del
 * cliente más arriba en cada documento, no una novedad de estilo.
 *
 * `PresupuestoPdfDocument.tsx` es la versión de esto para el PDF real
 * (react-pdf, sin DOM/CSS) — mismo criterio de tamaño ahí (`styles.legal`/
 * `styles.pie`), pero no puede compartir este componente porque usa
 * primitivas distintas (`View`/`Text`, no `div`/`p`).
 */
export function TextoLegal({ texto }: { texto: string }) {
  return <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{texto}</p>;
}

export function PieDocumento({ textos }: { textos: TextosCompartidos }) {
  const f = textos.footer;
  return (
    <footer className="break-inside-avoid rounded-lg border border-[#E1E7EC] bg-[#EEF2F6] p-4 print:break-inside-avoid print:bg-white">
      <p className="text-base font-bold tracking-wide text-[#244B5A]">{f.empresa}</p>
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-[#244B5A] sm:grid-cols-2">
        {f.direccion && (
          <p>
            Dirección:{" "}
            <a href={MAPS_URL} target="_blank" rel="noreferrer" className="underline">
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
      </div>
    </footer>
  );
}

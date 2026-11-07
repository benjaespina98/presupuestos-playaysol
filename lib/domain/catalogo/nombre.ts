import { normalizarTexto } from "@/lib/texto";

/**
 * El nombre de una fila sin repetir el título del bloque donde está: dentro de "Revestimientos", el producto
 * "Revestimientos - Cerámico Simil Piedra Bali" se lee "Cerámico Simil Piedra Bali". Sólo se saca un comienzo que
 * coincide con el título (sin importar mayúsculas, tildes ni singular/plural) y que sigue con un separador ("-", ":" o "·"); sin separador no se toca ("Cerco perimetral" queda igual).
 * Es sólo para mostrar: el nombre guardado no cambia, y si no queda nada se devuelve el original.
 */
export function sinTituloRepetido(nombre: string, ...titulos: (string | null | undefined)[]): string {
  const base = (s: string) => normalizarTexto(s).replace(/s\b/g, "");
  const texto = nombre.trimStart();
  for (const titulo of titulos) {
    const t = titulo?.trim();
    if (!t) continue;
    for (let largo = t.length + 1; largo >= Math.max(1, t.length - 1); largo--) {
      if (largo >= texto.length || base(texto.slice(0, largo)) !== base(t)) continue;
      const resto = texto.slice(largo);
      if (!/^\s*[-–—:·]\s*\S/.test(resto)) continue;
      const limpio = resto.replace(/^\s*[-–—:·,]?\s*/, "");
      return limpio.charAt(0).toUpperCase() + limpio.slice(1);
    }
  }
  return nombre;
}

/** Nombres cortos de los ítems que vienen con un texto larguísimo de fábrica. Sólo se aplican mientras el texto guardado siga empezando igual: si alguien lo reescribe, manda lo que escribió. */
const NOMBRES_CURADOS: readonly { empieza: string; nombre: string }[] = [
  { empieza: "Cerco perimetral desmontable", nombre: "Cerco perimetral desmontable" },
  { empieza: "Luces de acero inoxidable", nombre: "Luces de acero inoxidable" },
  { empieza: "Reemplazo de losetas", nombre: "Reemplazo de losetas por decks" },
  { empieza: "Solárium seco hormigón + losetas", nombre: "Solárium seco con losetas" },
  { empieza: "Solárium seco hormigón + decks", nombre: "Solárium seco con decks" },
  { empieza: "Kit de Limpieza", nombre: "Kit de limpieza" },
  { empieza: "Climatización bomba de calor inverter, hasta 25.000", nombre: "Climatización hasta 25.000 lts" },
  { empieza: "Climatización bomba de calor inverter, hasta 30.000", nombre: "Climatización hasta 30.000 lts" },
  { empieza: "Revestimiento interior cerámico importado de Brasil", nombre: "Revestimiento interior cerámico Bali" },
  { empieza: "Revestimiento interior en piedra Bali", nombre: "Revestimiento interior piedra Bali" },
  { empieza: "Revestimiento exterior de piscina en Mármol Travertino Rústico", nombre: "Travertino rústico exterior" },
  { empieza: "Revestimiento interior de piscina completa en Mármol Travertino Pulido", nombre: "Travertino pulido interior" },
];

const MAYUSCULA = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Parte lo que está guardado como nombre en un NOMBRE corto y un DETALLE: "Lona premium (mayor gramaje / color a
 * elección)" se ve "Lona premium" y, abajo, "Mayor gramaje / color a elección". Corta en la primera raya larga,
 * paréntesis, coma o dos puntos, y si el nombre sigue largo, antes de un "para ...". Sólo para mostrar: lo guardado
 * no cambia. Sin nada que cortar, el detalle es null.
 */
export function nombreYDetalle(item: { clave: string; descripcion: string | null }): { nombre: string; detalle: string | null } {
  const completo = (item.descripcion ?? "").trim();
  if (!completo) return { nombre: item.clave, detalle: null };

  const curado = NOMBRES_CURADOS.find((c) => completo.startsWith(c.empieza));
  if (curado) return { nombre: curado.nombre, detalle: MAYUSCULA(completo) };

  let nombre = completo;
  let detalle: string | null = null;
  const corte = /\s[—–]\s|\s\(|,\s|:\s/.exec(completo);
  if (corte && corte.index >= 8) {
    nombre = completo.slice(0, corte.index);
    const resto = completo.slice(corte.index + corte[0].length).trim();
    // El ")" de cierre sobra sólo si el corte fue en un paréntesis que se abrió justo ahí.
    detalle = (corte[0].includes("(") && !resto.includes("(") ? resto.replace(/\)$/, "") : resto) || null;
  }
  if (nombre.length > 64) {
    const i = nombre.indexOf(" para ");
    if (i >= 8) {
      detalle = [nombre.slice(i + 1), detalle].filter(Boolean).join(", ");
      nombre = nombre.slice(0, i);
    }
  }
  return { nombre, detalle: detalle ? MAYUSCULA(detalle) : null };
}

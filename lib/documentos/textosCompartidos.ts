import type { CatalogoRow } from "@/lib/catalogo";

/**
 * El texto legal y los datos de pie de página son, para el equipo, un dato
 * más del catálogo compartido: viven en `catalogo_items` bajo las claves
 * reservadas `__legal`/`__footer_<campo>` (ver `esTextoCompartido` en
 * lib/domain/catalogo/categorias.ts) y se pueden reemplazar desde cualquier
 * calculadora con "Guardar como predeterminado para todos"
 * (`guardarTextosCompartidos` en lib/catalogo.ts).
 *
 * Este módulo es el lado de LECTURA de ese mismo contrato para los
 * documentos generados en React: si alguien ya reemplazó el texto legal o
 * el WhatsApp del pie, el documento nuevo tiene que decir lo mismo que
 * dirían las calculadoras legacy — no puede quedarse con un default
 * hardcodeado y desactualizado.
 */
export interface FooterFijo {
  empresa: string;
  direccion: string;
  telFijo: string;
  contactoNombre: string;
  contactoCel: string;
  whatsapp: string;
  email: string;
  web: string;
  facebook: string;
  facebookUrl: string;
  instagram: string;
  instagramUrl: string;
}

export interface TextosCompartidos {
  legal: string;
  footer: FooterFijo;
}

/** `catalogo` es lo que devuelve `obtenerCatalogo(tipo)` SIN filtrar — tiene
 *  que incluir las filas `__legal`/`__footer_*` para que esto encuentre algo. */
export function leerTextosCompartidos(
  catalogo: CatalogoRow[],
  defaults: TextosCompartidos
): TextosCompartidos {
  const porClave = new Map(catalogo.map((r) => [r.clave, r.descripcion]));

  const legal = porClave.get("__legal") ?? defaults.legal;

  const footer = { ...defaults.footer };
  for (const campo of Object.keys(footer) as (keyof FooterFijo)[]) {
    const valor = porClave.get(`__footer_${campo}`);
    if (valor != null) footer[campo] = valor;
  }

  return { legal, footer };
}

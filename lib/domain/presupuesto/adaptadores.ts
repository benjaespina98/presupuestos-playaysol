import {
  DatosCliente,
  PresupuestoV1,
  TipoCalculadora,
  versionDe,
} from "./v1";

/**
 * Lectura de presupuestos guardados con el formato viejo.
 *
 * REGLA: los presupuestos existentes NO se migran. Nunca se reescribe en masa
 * una fila que representa trabajo real ya entregado a un cliente. Estos
 * adaptadores traducen al abrir; recién cuando alguien guarda, la fila pasa a v1.
 *
 * La forma de v0 no está documentada en ningún lado más que en el propio código
 * legacy: sale de `quoteToPlainState()` de cada -calc.js. Verificado archivo por
 * archivo, no inferido.
 *
 * Lo que v0 NO tiene y no se puede inventar:
 *   - los precios que se usaron (ni de opcionales ni base)
 *   - la descripción que tenía cada ítem en ese momento
 *   - los totales tal como se imprimieron
 *
 * Por eso el resultado sale con `lineas: []` y `preciosBase: {}`: el llamador
 * tiene que rehidratarlos desde el catálogo vigente, y avisar en pantalla que
 * los importes se recalcularon.
 */

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Campos que todas las calculadoras guardan igual. */
function clienteDesdeV0(d: Record<string, unknown>): DatosCliente {
  return DatosCliente.parse({
    nombre: texto(d.cliente),
    domicilio: texto(d.domicilio),
    localidad: texto(d.localidad),
    telefono: texto(d.tel),
    email: texto(d.email),
  });
}

/**
 * Las medidas propias de cada tipo, con los nombres que usa el motor de precios
 * nuevo. Es el único lugar donde se traduce de la nomenclatura vieja a la nueva.
 */
function medidasDesdeV0(
  tipo: TipoCalculadora,
  d: Record<string, unknown>
): Record<string, unknown> {
  switch (tipo) {
    case "cercos":
      return { metrosLineales: numero(d.ml) };

    case "cobertores":
      return {
        largo: numero(d.largo),
        ancho: numero(d.ancho),
        adicionalM2: numero(d.adicionalM2),
      };

    case "piscinas":
      // El subtotal lo escribe una persona: es la única "medida" que hay.
      return { subtotal: numero(d.subtotal) };

    case "revestimientos":
      return {
        largo: numero(d.largo),
        ancho: numero(d.ancho),
        // `profundidad` es el promedio ya calculado, que las versiones viejas de
        // la pantalla guardaban como fuente de verdad. Si no hay profMin/profMax
        // se usa ese promedio como profundidad pareja.
        profMin: numero(d.profMin) || numero(d.profundidad),
        profMax: numero(d.profMax),
        escalera: numero(d.escalera),
        desperdicio: numero(d.desperdicio),
        adicionalesM2: Array.isArray(d.m2Items)
          ? (d.m2Items as { m2?: unknown }[]).map((it) => numero(it?.m2))
          : [],
      };

    case "losetas":
      return {
        largo: numero(d.largo),
        ancho: numero(d.ancho),
        bordeIncluido: numero(d.inc),
        solar: numero(d.solar),
        opuesto: numero(d.opuesto),
        lateral1: numero(d.lateral1),
        lateral2: numero(d.lateral2),
      };
  }
}

export interface PresupuestoLeido {
  presupuesto: PresupuestoV1;
  /**
   * false cuando el presupuesto venía en formato viejo: sus importes NO son los
   * que se cotizaron, hay que rehidratarlos del catálogo actual y avisarlo.
   */
  preciosCongelados: boolean;
  /**
   * Claves de los ítems que estaban marcados como incluidos. En v0 es lo único
   * que se guardaba de los opcionales, sin precio ni descripción.
   */
  clavesIncluidas: string[];
}

/**
 * Lee una fila de `presupuestos.datos`, venga en el formato que venga.
 * Es el único punto de entrada: nadie más debería mirar `datos.v`.
 */
export function leerPresupuesto(
  tipo: TipoCalculadora,
  datos: unknown
): PresupuestoLeido {
  if (versionDe(datos) === 1) {
    return {
      presupuesto: PresupuestoV1.parse(datos),
      preciosCongelados: true,
      clavesIncluidas: (datos as PresupuestoV1).lineas
        .filter((l) => l.incluida && l.clave)
        .map((l) => l.clave as string),
    };
  }

  const d = (datos ?? {}) as Record<string, unknown>;

  const presupuesto = PresupuestoV1.parse({
    v: 1,
    tipo,
    fecha: texto(d.fecha),
    validezDias: texto(d.validez),
    cliente: clienteDesdeV0(d),
    medidas: medidasDesdeV0(tipo, d),
    // v0 no guardó precios. Los completa el llamador desde el catálogo.
    lineas: [],
    preciosBase: {},
    totales: [],
    detalle: texto(d.dimension),
    variacionEncabezado: texto(d.headerVariant) || "teal",
    modoPrecio: (["sin", "con", "ambos"] as const).includes(
      d.modoPrecio as "sin" | "con" | "ambos"
    )
      ? (d.modoPrecio as "sin" | "con" | "ambos")
      : "ambos",
    fotos: Array.isArray(d.fotos)
      ? (d.fotos as Record<string, unknown>[]).map((f) => ({
          id: texto(f.id),
          caption: texto(f.caption),
          width: typeof f.width === "number" ? f.width : null,
          height: typeof f.height === "number" ? f.height : null,
          storageUrl: typeof f.storageUrl === "string" ? f.storageUrl : null,
        }))
      : [],
  });

  return {
    presupuesto,
    preciosCongelados: false,
    clavesIncluidas: Array.isArray(d.opcionalesIncluidos)
      ? (d.opcionalesIncluidos as unknown[]).map(String)
      : [],
  };
}

/**
 * Duplicar es crear uno NUEVO: se conservan cliente, medidas y detalle, y se
 * descartan los precios congelados para que tome los del catálogo vigente.
 *
 * Aplica también a los v1: duplicar un presupuesto de hace seis meses tiene que
 * cotizar a precio de hoy, no al de entonces.
 */
export function paraDuplicar(p: PresupuestoV1): PresupuestoV1 {
  return PresupuestoV1.parse({
    ...p,
    lineas: [],
    preciosBase: {},
    totales: [],
  });
}

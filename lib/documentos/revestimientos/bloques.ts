import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import type { BloqueDocumento, FotoDocumentoModelo, ResolverFotosSeed } from "@/lib/documentos/modelo";
import { paresCliente, splitDimensionLines, varianteEncabezado } from "@/lib/documentos/modelo";
import { calcularRevestimiento } from "@/lib/domain/precios/revestimientos";
import { formatARS, formatNumero } from "@/lib/format/ars";
import { fotosSeedDeOpcional } from "@/lib/documentos/fotosSeed";

/** Sin resolver (el caso normal: PDF sin edición de fotos precargadas para
 *  esta exportación), las fotos de catálogo van tal cual. */
const sinEdicion: ResolverFotosSeed = (_grupo, base) => base;

/**
 * Bloques del documento de Revestimientos para el PDF. Port 1:1 de
 * `DocumentoRevestimiento.tsx`. La regla propia de este tipo (ver
 * `docs/reglas-de-negocio.md`, punto 5): con 2+ materiales tildados y con
 * precio, una línea "TOTAL revestimiento con <nombre>" por cada uno — nunca
 * una suma. Con 0 o 1, una sola línea "TOTAL REVESTIMIENTO". Acá también
 * "Revestimiento cotizado" va ANTES de "Adicionales"/totales — orden
 * distinto al de cercos/cobertores, preservado tal cual el original.
 */
function nombreCorto(desc: string): string {
  const s = String(desc || "").trim();
  const corto = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return corto || s;
}

function profundidadTexto(min: number, max: number, variable: boolean): string {
  if (variable) return `de ${formatNumero(min)} m a ${formatNumero(max)} m de profundidad`;
  return `profundidad ${formatNumero(min)} m`;
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

export function armarBloquesRevestimiento(
  snapshot: PresupuestoV1,
  textos: TextosCompartidos,
  fotosUsuario: FotoDocumentoModelo[],
  resolverFotosSeed: ResolverFotosSeed = sinEdicion
): BloqueDocumento[] {
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

  const variante = varianteEncabezado(snapshot.variacionEncabezado);
  const materialesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "alternativa" && l.incluida);
  const materialesConTotal = materialesIncluidos.filter((m) => m.total !== null);
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const lineasDimension = splitDimensionLines(snapshot.detalle);

  const partesM2 = [`Piso: ${formatNumero(r.m2Piso)} m²`, `Paredes: ${formatNumero(r.m2Paredes)} m²`];
  if ((medidas.escalera ?? 0) > 0) partesM2.push(`Escalera: ${formatNumero(medidas.escalera ?? 0)} m²`);
  if ((medidas.desperdicio ?? 0) > 0) partesM2.push(`Desperdicio: ${formatNumero(medidas.desperdicio ?? 0)} m²`);
  adicionalesM2.forEach((a) => {
    if (a.m2 > 0) partesM2.push(`${a.label || "Adicional"}: ${formatNumero(a.m2)} m²`);
  });

  const bloques: BloqueDocumento[] = [
    { tipo: "encabezado", color: variante.color, logoUrl: variante.img },
    { tipo: "titulo", texto: "Presupuesto de revestimiento para piscina" },
    {
      tipo: "meta",
      pares: [
        ...paresCliente(snapshot),
        {
          label: "Medidas:",
          value: `${formatNumero(medidas.largo ?? 0)} m largo × ${formatNumero(medidas.ancho ?? 0)} m ancho, ${profundidadTexto(r.profundidadMin, r.profundidadMax, r.profundidadVariable)}`,
        },
        { label: "Superficie:", value: `${partesM2.join(" + ")} = total ${formatNumero(r.m2Total)} m² a revestir` },
      ],
    },
  ];

  if (lineasDimension.length > 0) {
    bloques.push({ tipo: "listaDetalle", titulo: "Notas de la pileta", lineas: lineasDimension });
  }

  if (materialesIncluidos.length > 0) {
    bloques.push({ tipo: "tituloSeccion", texto: "Revestimiento cotizado" });
    for (const m of materialesIncluidos) {
      bloques.push({
        tipo: "tarjetaOpcional",
        descripcion: m.descripcion,
        monto: m.total === null ? null : formatARS(m.total),
        subcaption:
          m.precioUnitario !== null && m.total !== null
            ? `${formatARS(m.precioUnitario)} por m² × ${formatNumero(r.m2Total)} m²`
            : undefined,
        fotos: resolverFotosSeed(m.clave ?? "sin-clave", fotosSeedDeOpcional(m.clave)),
      });
    }
  }

  if (adicionales.length > 0) {
    bloques.push({
      tipo: "seccionPrecios",
      variante: "detalle",
      titulo: "Adicionales",
      renglones: adicionales.map((a) => ({ descripcion: a.descripcion, monto: formatARS(a.total ?? 0) })),
    });
  }

  bloques.push({
    tipo: "seccionPrecios",
    variante: "totales",
    renglones:
      materialesConTotal.length >= 2
        ? materialesConTotal.map((m, i) => ({
            descripcion: `TOTAL revestimiento con ${nombreCorto(m.descripcion)}`,
            monto: formatARS(snapshot.totales[i]),
            grande: true,
            destacado: true,
          }))
        : [{ descripcion: "TOTAL REVESTIMIENTO", monto: formatARS(snapshot.totales[0] ?? 0), grande: true, destacado: true }],
  });

  bloques.push({ tipo: "validez", dias: snapshot.validezDias });
  bloques.push({ tipo: "textoLegal", texto: textos.legal });

  if (fotosUsuario.length > 0) {
    bloques.push({ tipo: "galeriaFotos", titulo: "Fotos ilustrativas", fotos: fotosUsuario });
  }

  bloques.push({ tipo: "pie", footer: textos.footer });

  return bloques;
}

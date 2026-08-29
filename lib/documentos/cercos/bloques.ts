import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import type { BloqueDocumento, FotoDocumentoModelo, ResolverFotosSeed } from "@/lib/documentos/modelo";
import { paresCliente, splitDimensionLines, varianteEncabezado } from "@/lib/documentos/modelo";
import { formatARS } from "@/lib/format/ars";
import { FOTOS_REFERENCIA_CERCOS, GRUPO_SEED_GENERAL } from "@/lib/documentos/fotosSeed";

/** Sin resolver (el caso normal: PDF sin edición de fotos precargadas para
 *  esta exportación), las fotos de catálogo van tal cual. */
const sinEdicion: ResolverFotosSeed = (_grupo, base) => base;

/**
 * Bloques del documento de Cercos para el PDF. Port 1:1 de
 * `components/calculadoras/cercos/DocumentoCerco.tsx`: a diferencia de
 * piscinas, sólo los opcionales TILDADOS aparecen (uno sin tildar no sale
 * como "No incluye", no sale), `modoPrecio` decide 1 o 2 líneas de TOTAL, y
 * las fotos de referencia van cerca del encabezado, no al final.
 */
function etiquetasTotal(modo: PresupuestoV1["modoPrecio"]): string[] {
  if (modo === "sin") return ["TOTAL"];
  if (modo === "con") return ["TOTAL (incluye instalación)"];
  return ["TOTAL SIN INSTALACIÓN", "TOTAL CON INSTALACIÓN"];
}

export function armarBloquesCerco(
  snapshot: PresupuestoV1,
  textos: TextosCompartidos,
  fotosUsuario: FotoDocumentoModelo[],
  resolverFotosSeed: ResolverFotosSeed = sinEdicion
): BloqueDocumento[] {
  const medidas = snapshot.medidas as { metrosLineales?: number };
  const ml = Number(medidas.metrosLineales ?? 0);
  const variante = varianteEncabezado(snapshot.variacionEncabezado);
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionalesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "informativa" && l.incluida);
  const etiquetas = etiquetasTotal(snapshot.modoPrecio);
  const lineasDimension = splitDimensionLines(snapshot.detalle);

  const bloques: BloqueDocumento[] = [
    { tipo: "encabezado", color: variante.color, logoUrl: variante.img },
    { tipo: "titulo", texto: "Presupuesto de cerco perimetral" },
    { tipo: "meta", pares: [...paresCliente(snapshot), { label: "Metros lineales a cercar:", value: `${ml.toLocaleString("es-AR")} ml` }] },
    { tipo: "galeriaSeeds", titulo: "Fotos de referencia", fotos: resolverFotosSeed(GRUPO_SEED_GENERAL, FOTOS_REFERENCIA_CERCOS) },
  ];

  if (lineasDimension.length > 0) {
    bloques.push({ tipo: "listaDetalle", titulo: "Detalle del recorrido", lineas: lineasDimension });
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
    renglones: snapshot.totales.map((t, i) => ({ descripcion: etiquetas[i], monto: formatARS(t), grande: true, destacado: true })),
  });

  if (opcionalesIncluidos.length > 0) {
    bloques.push({ tipo: "tituloSeccion", texto: "Opcionales" });
    for (const op of opcionalesIncluidos) {
      bloques.push({
        tipo: "tarjetaOpcional",
        descripcion: op.descripcion,
        monto: op.precioUnitario === null ? null : formatARS(op.precioUnitario),
        fotos: [],
      });
    }
  }

  bloques.push({ tipo: "validez", dias: snapshot.validezDias });
  bloques.push({ tipo: "textoLegal", texto: textos.legal });

  if (fotosUsuario.length > 0) {
    bloques.push({ tipo: "galeriaFotos", titulo: "Fotos ilustrativas", fotos: fotosUsuario });
  }

  bloques.push({ tipo: "pie", footer: textos.footer });

  return bloques;
}

import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import type { BloqueDocumento, FotoDocumentoModelo, ResolverFotosSeed } from "@/lib/documentos/modelo";
import { paresCliente, splitDimensionLines, varianteEncabezado } from "@/lib/documentos/modelo";
import { formatARS, formatNumero } from "@/lib/format/ars";
import { FOTOS_REFERENCIA_COBERTORES, GRUPO_SEED_GENERAL } from "@/lib/documentos/fotosSeed";

/** Sin resolver (el caso normal: PDF sin edición de fotos precargadas para
 *  esta exportación), las fotos de catálogo van tal cual. */
const sinEdicion: ResolverFotosSeed = (_grupo, base) => base;

/**
 * Bloques del documento de Cobertores para el PDF. Estructura idéntica a
 * `lib/documentos/cercos/bloques.ts` salvo el título y la línea de
 * "Medidas" — mismo criterio que ya documentaba
 * `DocumentoCobertor.tsx` (no se fuerza una abstracción compartida con
 * cercos, son dos ports independientes de sus respectivos `Documento*.tsx`).
 */
function etiquetasTotal(modo: PresupuestoV1["modoPrecio"]): string[] {
  if (modo === "sin") return ["TOTAL"];
  if (modo === "con") return ["TOTAL (incluye instalación)"];
  return ["TOTAL SIN INSTALACIÓN", "TOTAL CON INSTALACIÓN"];
}

export function armarBloquesCobertor(
  snapshot: PresupuestoV1,
  textos: TextosCompartidos,
  fotosUsuario: FotoDocumentoModelo[],
  resolverFotosSeed: ResolverFotosSeed = sinEdicion
): BloqueDocumento[] {
  const medidas = snapshot.medidas as { largo?: number; ancho?: number; adicionalM2?: number };
  const largo = Number(medidas.largo ?? 0);
  const ancho = Number(medidas.ancho ?? 0);
  const adicionalM2 = Number(medidas.adicionalM2 ?? 0);
  const espejoM2 = largo * ancho;
  const m2 = espejoM2 + adicionalM2;

  const medidasTexto = [`${formatNumero(largo)} m largo × ${formatNumero(ancho)} m ancho = ${formatNumero(espejoM2)} m²`];
  if (adicionalM2) medidasTexto.push(`Adicional: ${formatNumero(adicionalM2)} m²`);

  const variante = varianteEncabezado(snapshot.variacionEncabezado);
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionalesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "informativa" && l.incluida);
  const etiquetas = etiquetasTotal(snapshot.modoPrecio);
  const lineasDimension = splitDimensionLines(snapshot.detalle);

  const bloques: BloqueDocumento[] = [
    { tipo: "encabezado", color: variante.color, logoUrl: variante.img },
    { tipo: "titulo", texto: "Presupuesto de cobertor para piscina" },
    {
      tipo: "meta",
      pares: [...paresCliente(snapshot), { label: "Medidas:", value: `${medidasTexto.join(" + ")} = ${formatNumero(m2)} m² a cubrir` }],
    },
    { tipo: "galeriaSeeds", titulo: "Fotos de referencia", fotos: resolverFotosSeed(GRUPO_SEED_GENERAL, FOTOS_REFERENCIA_COBERTORES) },
  ];

  if (lineasDimension.length > 0) {
    bloques.push({ tipo: "listaDetalle", titulo: "Notas de la pileta", lineas: lineasDimension });
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

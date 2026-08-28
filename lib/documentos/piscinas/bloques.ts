import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import type { BloqueDocumento, FotoDocumentoModelo } from "@/lib/documentos/modelo";
import { paresCliente, splitDimensionLines, varianteEncabezado } from "@/lib/documentos/modelo";
import { precioDeOpcional } from "@/lib/domain/precios/piscinas";
import { formatARS } from "@/lib/format/ars";
import { FOTOS_GENERALES_PISCINAS, fotosSeedDeOpcional } from "@/lib/documentos/fotosSeed";

/**
 * Bloques del documento de Piscinas para el PDF. Port 1:1 de las reglas que
 * hoy viven en `components/calculadoras/piscinas/DocumentoPiscina.tsx` (ver
 * el comentario ahí — SUBTOTAL siempre, TOTAL sólo con adicionales,
 * opcionales TODOS con "No incluye", "Dimensión piscina" siempre visible,
 * "Modelos de referencia" al final después del pie). No se reinventa el
 * documento, sólo se lo describe como datos en vez de JSX de pantalla.
 */
export function armarBloquesPiscina(
  snapshot: PresupuestoV1,
  textos: TextosCompartidos,
  fotosUsuario: FotoDocumentoModelo[]
): BloqueDocumento[] {
  const variante = varianteEncabezado(snapshot.variacionEncabezado);
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionales = snapshot.lineas.filter((l) => l.naturaleza === "informativa");
  const hayAdicionales = adicionales.length > 0;
  const subtotal = snapshot.totales[0] ?? 0;
  const total = snapshot.totales[1];

  const bloques: BloqueDocumento[] = [
    { tipo: "encabezado", color: variante.color, logoUrl: variante.img },
    { tipo: "titulo", texto: "Presupuesto de construcción piscina" },
    { tipo: "meta", pares: paresCliente(snapshot) },
    // Se muestra siempre, tenga o no líneas debajo — así es el legacy (ver
    // DocumentoPiscina.tsx) y se preserva tal cual.
    { tipo: "listaDetalle", titulo: "Dimensión piscina", lineas: splitDimensionLines(snapshot.detalle), siempreVisible: true },
    {
      tipo: "seccionPrecios",
      variante: "totales",
      renglones: [
        { descripcion: "SUBTOTAL", monto: formatARS(subtotal), grande: true, destacado: true },
        ...(hayAdicionales ? adicionales.map((a) => ({ descripcion: a.descripcion, monto: formatARS(a.total ?? 0) })) : []),
        ...(hayAdicionales && total !== undefined
          ? [{ descripcion: "TOTAL", monto: formatARS(total), grande: true, destacado: true, reglaSuperior: true }]
          : []),
      ],
    },
  ];

  if (opcionales.length > 0) {
    bloques.push({ tipo: "tituloSeccion", texto: "Opcionales" });
    for (const op of opcionales) {
      const precio = precioDeOpcional({ incluida: op.incluida, precioUnitario: op.precioUnitario });
      bloques.push({
        tipo: "tarjetaOpcional",
        descripcion: op.descripcion,
        monto: precio === null ? null : formatARS(precio),
        fotos: fotosSeedDeOpcional(op.clave),
      });
    }
  }

  bloques.push({ tipo: "validez", dias: snapshot.validezDias });
  bloques.push({ tipo: "textoLegal", texto: textos.legal });

  if (fotosUsuario.length > 0) {
    bloques.push({ tipo: "galeriaFotos", titulo: "Fotos ilustrativas", fotos: fotosUsuario });
  }

  bloques.push({ tipo: "pie", footer: textos.footer });

  // "Modelos de referencia": van al final, después del pie de la empresa —
  // mismo lugar que en un presupuesto real ya entregado (ver DocumentoPiscina.tsx).
  bloques.push({ tipo: "galeriaSeeds", titulo: "Modelos de referencia", fotos: FOTOS_GENERALES_PISCINAS });

  return bloques;
}

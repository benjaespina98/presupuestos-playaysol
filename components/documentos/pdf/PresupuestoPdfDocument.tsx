import type { ReactNode } from "react";
import { Document, Page, View, Text, Image, Link, StyleSheet } from "@react-pdf/renderer";
import type { BloqueDocumento, FotoDocumentoModelo } from "@/lib/documentos/modelo";
import { justificarFilas } from "@/lib/domain/documentos/imageLayout";

/**
 * El "PDF Generator" de la arquitectura Budget Data → Document Renderer →
 * PDF Generator: el único componente que sabe convertir un `BloqueDocumento`
 * (dato puro, ver lib/documentos/modelo.ts) en algo dibujable. No conoce
 * `PresupuestoV1` ni ninguna regla de negocio — sólo layout.
 *
 * Paginación: react-pdf reparte el contenido entre páginas automáticamente
 * (sin depender del motor de impresión del navegador). Cada tarjeta de
 * opcional y cada FILA de fotos usan `wrap={false}`: si no entran enteras en
 * lo que queda de la página, pasan completas a la siguiente — nunca se
 * corta un título de su precio ni una foto a la mitad.
 */

// Azul Institucional del manual de marca (RGB 36,75,90 / Pantone 7477 C) —
// único navy en todo el documento (antes había dos valores parecidos pero
// distintos para texto y para el fondo del encabezado).
const NAVY = "#244B5A";
const TEAL = "#00829C";
const TEXTO = "#1C2B33";
const NAVY_SUAVE = "#EEF2F6";
const BORDE_SUAVE = "#E1E7EC";

// A4 con los mismos márgenes que el .docx (20mm arriba/abajo, 25mm a los
// costados) — mm → pt (1mm = 2.8346pt) — para que Word y PDF se sientan de
// la misma familia.
const MARGEN_VERTICAL = 56.7;
const MARGEN_HORIZONTAL = 70.9;
const ANCHO_PAGINA = 595.28; // A4 en pt
const ANCHO_CONTENIDO = ANCHO_PAGINA - MARGEN_HORIZONTAL * 2;

// header-navy.png/header-teal.png son un banner ancho (2745×778, ya recortado
// para ocupar todo el ancho de una hoja) — no el isotipo cuadrado suelto. El
// encabezado simplemente estira ese banner al 100% del ancho de página y deja
// que la altura salga de mantener su proporción real, a sangre (por eso
// "saca" el padding del Page con márgenes negativos, ver `styles.encabezado`).
const HEADER_ASPECT = 2745 / 778;

const styles = StyleSheet.create({
  // Los márgenes viven en el `Page`, no en un `View` de adentro: react-pdf
  // clona el padding del `Page` en CADA hoja física que arma al paginar, así
  // que es la única forma de que TODAS las hojas (no sólo la primera y la
  // última) respiren un poco arriba/abajo. Antes esto vivía en `cuerpo`
  // (un `View` que se parte entre páginas) y ahí el padding-top/bottom de
  // react-pdf sólo se aplica en el borde real del contenido: la primera hoja
  // se quedaba con el paddingTop y la última con el paddingBottom, pero
  // cualquier hoja del medio no tenía ninguno de los dos — el texto llegaba
  // pegado al borde físico y la siguiente hoja arrancaba pegada también, sin
  // el aire que sí hay en el .docx (ver el bug reportado: "se junta
  // demasiado" entre hojas).
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: TEXTO,
    paddingTop: MARGEN_VERTICAL,
    paddingBottom: MARGEN_VERTICAL,
    paddingHorizontal: MARGEN_HORIZONTAL,
  },
  // El banner de encabezado sigue a sangre (todo el ancho, pegado al borde
  // físico) SÓLO en la primera hoja — para lograrlo con el padding ahora en
  // `Page`, se lo "saca" con márgenes negativos exactamente del tamaño de
  // ese padding. `marginBottom` reemplaza al viejo paddingTop de `cuerpo`:
  // el aire entre el banner y el título.
  encabezado: {
    width: ANCHO_PAGINA,
    height: ANCHO_PAGINA / HEADER_ASPECT,
    marginTop: -MARGEN_VERTICAL,
    marginHorizontal: -MARGEN_HORIZONTAL,
    marginBottom: 20,
  },
  logo: { width: "100%", height: "100%", objectFit: "cover" },
  titulo: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    paddingBottom: 4,
    marginBottom: 14,
  },
  meta: {
    backgroundColor: NAVY_SUAVE,
    borderWidth: 1,
    borderColor: BORDE_SUAVE,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaPar: { width: "50%", marginBottom: 3, fontSize: 9.5 },
  metaLabel: { fontFamily: "Helvetica-Bold", color: NAVY },
  // "Insignia" de sección: antes era sólo una línea teal debajo del texto,
  // ahora un fondo tintado + acento a la izquierda — más fácil de detectar
  // hojeando el documento en diagonal, mismo criterio en las 4 calculadoras
  // porque las 4 comparten este único componente.
  seccionTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    backgroundColor: NAVY_SUAVE,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  listaDetalle: { borderLeftWidth: 3, borderLeftColor: NAVY, paddingLeft: 10, marginBottom: 16 },
  detalleItem: { fontSize: 9.5, marginBottom: 3 },
  detalleVineta: { color: TEAL, fontFamily: "Helvetica-Bold" },
  seccion: { marginBottom: 16 },
  renglonDetalle: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9.5,
    color: "#444",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    borderStyle: "dashed",
  },
  renglonDetalleMonto: { fontFamily: "Helvetica-Bold", color: NAVY },
  bloqueTotales: { borderTopWidth: 2, borderTopColor: NAVY, paddingTop: 10, marginBottom: 16 },
  renglonTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  // Los renglones "grande" (SUBTOTAL/TOTAL) pasan de texto suelto a una
  // "tarjeta" tintada — el ojo encuentra el número sin tener que leer todo
  // el bloque. El TOTAL final (el que además lleva `reglaSuperior`, ver
  // modelo.ts) usa el navy sólido con letra blanca: es EL número que
  // importa, se destaca sobre el resto de totales/subtotales.
  renglonTotalDestacado: { backgroundColor: NAVY_SUAVE, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, marginTop: 3 },
  renglonTotalFinal: { backgroundColor: NAVY, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 10, marginTop: 6 },
  renglonTotalTexto: { fontSize: 9.5, color: TEXTO },
  renglonTotalGrande: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: NAVY },
  renglonTotalGrandeBlanco: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  tarjeta: {
    borderWidth: 1,
    borderColor: BORDE_SUAVE,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    backgroundColor: "#FAFBFC",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  tarjetaFila: { flexDirection: "row", justifyContent: "space-between" },
  tarjetaDescripcion: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: TEXTO, flex: 1, marginRight: 6 },
  tarjetaMonto: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: NAVY },
  tarjetaMontoVacio: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#8B98A3" },
  tarjetaSubcaption: { fontSize: 8, color: "#666", marginTop: 2 },
  validez: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 10, color: NAVY },
  legal: { fontSize: 8, color: "#444", lineHeight: 1.4, marginBottom: 4 },
  filaFotos: { flexDirection: "row", marginBottom: 6 },
  // Marco fino alrededor de cada foto (recorte de catálogo o subida por el
  // vendedor): sin esto, contra el fondo blanco de la página, una foto sin
  // borde se ve "cruda" pegada al texto — el mismo criterio de borde suave
  // que ya usan las tarjetas de opcionales.
  fotoMarco: { borderRadius: 4, borderWidth: 1, borderColor: BORDE_SUAVE, overflow: "hidden" },
  fotoCaption: { fontSize: 7.5, color: "#666", marginTop: 2, textAlign: "center" },
  pie: { borderTopWidth: 2, borderTopColor: TEAL, paddingTop: 10, marginTop: 6 },
  pieEmpresa: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.4, marginBottom: 3 },
  pieLinea: { fontSize: 8, color: NAVY, marginBottom: 2 },
  // "bottom"/"right" se miden desde el borde de PADDING del Page (que ahora
  // ya está inset por MARGEN_VERTICAL/MARGEN_HORIZONTAL — ver `page` arriba),
  // no desde el borde físico de la hoja: por eso "right" queda en 0 (ya
  // coincide con el margen derecho del cuerpo) y "bottom" se corrige restando
  // ese mismo padding, para que el número de página quede exactamente donde
  // estaba antes (20pt del borde físico) en vez de flotar 20pt más adentro.
  numeroPagina: {
    position: "absolute",
    bottom: 20 - MARGEN_VERTICAL,
    right: 0,
    fontSize: 8,
    color: "#999",
  },
});

type FilaDeFotos = ReturnType<typeof justificarFilas<FotoDocumentoModelo>>[number];

function FilaDeFotosVista({ fila }: { fila: FilaDeFotos }) {
  return (
    <View style={styles.filaFotos}>
      {fila.map((f, j) => (
        <View key={j} style={{ width: f.anchoRender, marginRight: j < fila.length - 1 ? 6 : 0 }}>
          <View style={styles.fotoMarco}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image no acepta alt */}
            <Image src={f.foto.url} style={{ width: f.anchoRender, height: f.altoRender }} />
          </View>
          {f.foto.caption && <Text style={styles.fotoCaption}>{f.foto.caption}</Text>}
        </View>
      ))}
    </View>
  );
}

function FilaImagenes({ fotos, altoObjetivo = 90 }: { fotos: FotoDocumentoModelo[]; altoObjetivo?: number }) {
  if (!fotos.length) return null;
  const filas = justificarFilas(fotos, ANCHO_CONTENIDO, altoObjetivo);
  return (
    <>
      {filas.map((fila, i) => (
        <View key={i} wrap={false}>
          <FilaDeFotosVista fila={fila} />
        </View>
      ))}
    </>
  );
}

/** Título + galería, para las secciones de fotos que van solas ("Fotos
 *  ilustrativas", "Modelos de referencia", "Fotos de referencia"). El
 *  título y la PRIMERA fila van juntos en un mismo `wrap={false}`: así
 *  nunca queda un título solo al final de una página con sus fotos recién
 *  en la siguiente (lo que sí le pasaba a la primera versión de esto). Las
 *  filas siguientes, si las hay, se comportan como cualquier otra fila:
 *  atómicas, pero libres de fluir a la página que corresponda.
 */
function GaleriaConTitulo({ titulo, fotos, altoObjetivo = 90 }: { titulo: string; fotos: FotoDocumentoModelo[]; altoObjetivo?: number }) {
  if (!fotos.length) return null;
  const [primera, ...resto] = justificarFilas(fotos, ANCHO_CONTENIDO, altoObjetivo);
  return (
    <View style={{ marginBottom: 16 }}>
      <View wrap={false}>
        <Text style={styles.seccionTitulo}>{titulo}</Text>
        {primera && <FilaDeFotosVista fila={primera} />}
      </View>
      {resto.map((fila, i) => (
        <View key={i} wrap={false}>
          <FilaDeFotosVista fila={fila} />
        </View>
      ))}
    </View>
  );
}

function bloqueAJsx(bloque: BloqueDocumento, key: number): ReactNode {
  switch (bloque.tipo) {
    case "encabezado":
      return (
        <View key={key} style={[styles.encabezado, { backgroundColor: bloque.color }]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image no acepta alt */}
          <Image src={bloque.logoUrl} style={styles.logo} />
        </View>
      );

    case "titulo":
      return (
        <Text key={key} style={styles.titulo}>
          {bloque.texto}
        </Text>
      );

    case "meta":
      return (
        <View key={key} style={styles.meta}>
          {bloque.pares.map((p, i) => (
            <Text key={i} style={styles.metaPar}>
              <Text style={styles.metaLabel}>{p.label} </Text>
              {p.value}
            </Text>
          ))}
        </View>
      );

    case "listaDetalle":
      if (!bloque.lineas.length && !bloque.siempreVisible) return null;
      return (
        <View key={key} style={{ marginBottom: 16 }}>
          <Text style={styles.seccionTitulo}>{bloque.titulo}</Text>
          {bloque.lineas.length > 0 && (
            <View style={styles.listaDetalle}>
              {bloque.lineas.map((l, i) => (
                <Text key={i} style={styles.detalleItem}>
                  <Text style={styles.detalleVineta}>•  </Text>
                  {l}
                </Text>
              ))}
            </View>
          )}
        </View>
      );

    case "seccionPrecios": {
      if (bloque.variante === "detalle") {
        return (
          <View key={key} style={styles.seccion} wrap={false}>
            {bloque.titulo && <Text style={styles.seccionTitulo}>{bloque.titulo}</Text>}
            {bloque.renglones.map((r, i) => (
              <View key={i} style={styles.renglonDetalle}>
                <Text>{r.descripcion}</Text>
                <Text style={styles.renglonDetalleMonto}>{r.monto}</Text>
              </View>
            ))}
          </View>
        );
      }
      return (
        <View key={key} style={styles.bloqueTotales}>
          {bloque.renglones.map((r, i) => {
            // Los renglones "grande" (SUBTOTAL/TOTAL/comparativos) se dibujan
            // como una tarjeta tintada — el TOTAL final (`reglaSuperior`, la
            // línea que cierra la cuenta cuando hay adicionales) en navy
            // sólido con letra blanca, el resto en un tinte más suave. Un
            // renglón chico (un adicional suelto entre SUBTOTAL y TOTAL) no
            // lleva tarjeta, sigue siendo texto simple.
            const esFinal = !!r.reglaSuperior;
            const filaStyle = [styles.renglonTotal, esFinal ? styles.renglonTotalFinal : r.grande ? styles.renglonTotalDestacado : undefined];
            const textoStyle = esFinal ? styles.renglonTotalGrandeBlanco : r.grande ? styles.renglonTotalGrande : styles.renglonTotalTexto;
            return (
              // wrap={false} por renglón, no en todo el bloque: un SUBTOTAL +
              // varios adicionales + TOTAL puede ser largo y no hay problema
              // en que fluya a la página siguiente, pero NINGÚN renglón
              // individual puede partirse a la mitad (así se perdía
              // silenciosamente el primero de dos TOTALES de revestimiento al
              // caer justo en el borde de una página — ver el comentario del
              // bug en el plan).
              <View key={i} wrap={false} style={filaStyle}>
                <Text style={textoStyle}>{r.descripcion}</Text>
                <Text style={textoStyle}>{r.monto}</Text>
              </View>
            );
          })}
        </View>
      );
    }

    case "tituloSeccion":
      return (
        <Text key={key} style={styles.seccionTitulo}>
          {bloque.texto}
        </Text>
      );

    case "tarjetaOpcional":
      return (
        <View key={key} style={styles.tarjeta} wrap={false}>
          <View style={styles.tarjetaFila}>
            <Text style={styles.tarjetaDescripcion}>{bloque.descripcion}</Text>
            <Text style={bloque.monto === null ? styles.tarjetaMontoVacio : styles.tarjetaMonto}>
              {bloque.monto === null ? "No incluye" : bloque.monto}
            </Text>
          </View>
          {bloque.subcaption && <Text style={styles.tarjetaSubcaption}>{bloque.subcaption}</Text>}
          {bloque.fotos.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <FilaImagenes fotos={bloque.fotos} altoObjetivo={70} />
            </View>
          )}
        </View>
      );

    case "validez":
      return (
        <Text key={key} style={styles.validez}>
          El presente presupuesto tiene una validez de {bloque.dias} días.
        </Text>
      );

    case "textoLegal":
      return (
        <View key={key} style={{ marginBottom: 14 }}>
          {bloque.texto.split("\n").map((linea, i) => (
            <Text key={i} style={styles.legal}>
              {linea || " "}
            </Text>
          ))}
        </View>
      );

    case "galeriaFotos":
    case "galeriaSeeds":
      return <GaleriaConTitulo key={key} titulo={bloque.titulo} fotos={bloque.fotos} />;

    case "pie": {
      const f = bloque.footer;
      const mapsUrl =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Playa y Sol S.A.S.") +
        "&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA";
      return (
        <View key={key} style={styles.pie} wrap={false}>
          <Text style={styles.pieEmpresa}>{f.empresa}</Text>
          {f.direccion && (
            <Text style={styles.pieLinea}>
              Dirección: <Link src={mapsUrl}>{f.direccion}</Link>
            </Text>
          )}
          {f.telFijo && <Text style={styles.pieLinea}>Tel: {f.telFijo}</Text>}
          {(f.contactoNombre || f.contactoCel) && (
            <Text style={styles.pieLinea}>
              Contacto: {f.contactoNombre}
              {f.contactoCel ? ` - Cel. ${f.contactoCel}` : ""}
            </Text>
          )}
          {f.whatsapp && <Text style={styles.pieLinea}>WhatsApp: {f.whatsapp}</Text>}
          {f.email && <Text style={styles.pieLinea}>E-mail: {f.email}</Text>}
          {f.web && <Text style={styles.pieLinea}>Web: {f.web}</Text>}
          {f.facebook && <Text style={styles.pieLinea}>Facebook: {f.facebook}</Text>}
          {f.instagram && <Text style={styles.pieLinea}>Instagram: {f.instagram}</Text>}
        </View>
      );
    }

    default:
      return null;
  }
}

export function PresupuestoPdfDocument({ bloques, titulo }: { bloques: BloqueDocumento[]; titulo: string }) {
  // El encabezado (si hay) va primero y a sangre, a todo el ancho de la
  // página — igual que una hoja membretada real. El resto son hijos directos
  // del Page (ver `styles.page`): así el margen se repite en cada hoja.
  const encabezado = bloques.find((b) => b.tipo === "encabezado");
  const resto = bloques.filter((b) => b.tipo !== "encabezado");

  return (
    <Document title={titulo}>
      <Page size="A4" style={styles.page}>
        {encabezado && bloqueAJsx(encabezado, -1)}
        {resto.map((b, i) => bloqueAJsx(b, i))}
        <Text
          style={styles.numeroPagina}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

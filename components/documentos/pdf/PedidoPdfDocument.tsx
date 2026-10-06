import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/brand";
import type { DocumentoPedido, SeccionProveedor } from "@/lib/domain/abastecimiento/pedidoDocumento";
import { formatARS } from "@/lib/format/ars";

/**
 * El pedido formal de materiales en PDF: logo y datos de la empresa, número y
 * fecha, la obra, y una sección por proveedor con su tabla y su subtotal.
 *
 * Pensado para dos usos: verse en el celular (WhatsApp) e imprimirse. Por eso
 * la letra es grande, el contraste alto y las filas van cebradas con una línea
 * fina: se lee bien en pantalla chica y también en blanco y negro.
 *
 * Misma paleta que los presupuestos (azul institucional y teal). No conoce el
 * catálogo ni las reglas del pedido: sólo dibuja un `DocumentoPedido` ya armado.
 */

const NAVY = "#244B5A";
const TEAL = "#00829C";
const TEXTO = "#111C22";
const SUAVE = "#4A5A63";
const GRIS = "#EEF2F6";
const BORDE = "#C9D3DA";
const AMBAR = "#92400E";
const AMBAR_FONDO = "#FEF3C7";

// El logo (logo-playa-sol.png) mide 931×121.
const LOGO_ANCHO = 190;
const LOGO_ALTO = LOGO_ANCHO / (931 / 121);

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10.5, color: TEXTO, paddingTop: 34, paddingBottom: 56, paddingHorizontal: 38 },
  cabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  logo: { width: LOGO_ANCHO, height: LOGO_ALTO },
  empresa: { alignItems: "flex-end", fontSize: 9, color: SUAVE, lineHeight: 1.4 },
  empresaNombre: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 10.5 },
  barraTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: NAVY,
    color: "#FFFFFF",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 3,
    marginBottom: 10,
  },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 14, letterSpacing: 0.6 },
  numero: { fontFamily: "Helvetica-Bold", fontSize: 15 },
  info: { borderWidth: 1, borderColor: BORDE, borderRadius: 4, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, marginBottom: 10, flexDirection: "row", flexWrap: "wrap" },
  infoPar: { width: "50%", marginBottom: 6, paddingRight: 8 },
  infoParAncho: { width: "100%", marginBottom: 6 },
  infoLabel: { fontFamily: "Helvetica-Bold", color: SUAVE, fontSize: 8, letterSpacing: 0.8, marginBottom: 1.5 },
  infoValor: { fontSize: 11, color: TEXTO },
  infoValorFuerte: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: TEXTO },
  resumen: { flexDirection: "row", marginBottom: 14, gap: 8 },
  resumenItem: { flexGrow: 1, flexBasis: 0, backgroundColor: GRIS, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "baseline" },
  resumenNumero: { fontFamily: "Helvetica-Bold", fontSize: 16, color: NAVY, marginRight: 6 },
  resumenTexto: { fontSize: 9.5, color: SUAVE },
  seccion: { marginBottom: 14 },
  proveedor: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: GRIS,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    borderWidth: 1,
    borderColor: BORDE,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  proveedorNombre: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 12 },
  proveedorContacto: { fontSize: 9.5, color: SUAVE, textAlign: "right" },
  filaEncabezado: { flexDirection: "row", backgroundColor: NAVY, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 9, paddingVertical: 5, paddingHorizontal: 6 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 5.5, paddingHorizontal: 6, borderBottomWidth: 0.75, borderBottomColor: BORDE },
  filaCebra: { backgroundColor: "#F6F8FA" },
  filaSubtotal: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 6, paddingHorizontal: 6, fontSize: 11, borderBottomWidth: 1, borderBottomColor: NAVY },
  cNumero: { width: 22, color: SUAVE, fontSize: 9 },
  cArticulo: { flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  cCantidad: { width: 54, textAlign: "right", fontFamily: "Helvetica-Bold" },
  cUnidad: { width: 56, textAlign: "left", paddingLeft: 6, color: SUAVE },
  cPrecio: { width: 78, textAlign: "right" },
  cSubtotal: { width: 88, textAlign: "right" },
  aConfirmar: { color: AMBAR, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  negrita: { fontFamily: "Helvetica-Bold" },
  totalCaja: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2, marginBottom: 6 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: 280,
    backgroundColor: NAVY,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  nota: { fontSize: 9.5, color: AMBAR, backgroundColor: AMBAR_FONDO, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 8, textAlign: "right", marginBottom: 8 },
  observaciones: { borderWidth: 1, borderColor: BORDE, borderRadius: 4, padding: 9, marginTop: 6, marginBottom: 6, fontSize: 10.5 },
  firmas: { flexDirection: "row", justifyContent: "space-between", marginTop: 38 },
  firma: { width: "42%", borderTopWidth: 1, borderTopColor: TEXTO, paddingTop: 4, textAlign: "center", fontSize: 9.5, color: SUAVE },
  pie: { position: "absolute", left: 38, right: 38, bottom: 22, borderTopWidth: 0.75, borderTopColor: BORDE, paddingTop: 5, flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: SUAVE },
});

const cantidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

function Tabla({ s, conTitulo }: { s: SeccionProveedor; conTitulo: boolean }) {
  return (
    <View style={styles.seccion}>
      {conTitulo && (
        <View style={styles.proveedor} wrap={false} minPresenceAhead={70}>
          <Text style={styles.proveedorNombre}>{s.nombre}</Text>
          <Text style={styles.proveedorContacto}>{[s.contacto, s.telefono].filter(Boolean).join("  ·  ")}</Text>
        </View>
      )}
      <View style={styles.filaEncabezado} fixed={false}>
        <Text style={styles.cNumero}>N°</Text>
        <Text style={styles.cArticulo}>Artículo</Text>
        <Text style={[styles.cCantidad, { fontFamily: "Helvetica-Bold" }]}>Cant.</Text>
        <Text style={[styles.cUnidad, { color: "#FFFFFF" }]}>Unidad</Text>
        <Text style={styles.cPrecio}>Precio unit.</Text>
        <Text style={styles.cSubtotal}>Subtotal</Text>
      </View>
      {s.lineas.map((l, i) => (
        <View key={i} style={i % 2 === 1 ? [styles.fila, styles.filaCebra] : styles.fila} wrap={false}>
          <Text style={styles.cNumero}>{i + 1}</Text>
          <Text style={styles.cArticulo}>{l.descripcion}</Text>
          <Text style={styles.cCantidad}>{cantidad(l.cantidad)}</Text>
          <Text style={styles.cUnidad}>{l.unidad}</Text>
          {l.precio === null ? (
            <>
              <Text style={[styles.cPrecio, styles.aConfirmar]}>A confirmar</Text>
              <Text style={styles.cSubtotal}>—</Text>
            </>
          ) : (
            <>
              <Text style={styles.cPrecio}>{formatARS(l.precio)}</Text>
              <Text style={styles.cSubtotal}>{formatARS(l.subtotal)}</Text>
            </>
          )}
        </View>
      ))}
      <View style={styles.filaSubtotal} wrap={false}>
        <Text style={styles.negrita}>{conTitulo ? `Subtotal ${s.nombre}: ` : "Subtotal: "}</Text>
        <Text style={[styles.negrita, { width: 88, textAlign: "right" }]}>{formatARS(s.subtotal)}</Text>
      </View>
    </View>
  );
}

function Dato({ etiqueta, valor, ancho, fuerte }: { etiqueta: string; valor: string; ancho?: boolean; fuerte?: boolean }) {
  return (
    <View style={ancho ? styles.infoParAncho : styles.infoPar}>
      <Text style={styles.infoLabel}>{etiqueta.toUpperCase()}</Text>
      <Text style={fuerte ? styles.infoValorFuerte : styles.infoValor}>{valor}</Text>
    </View>
  );
}

export function PedidoPdfDocument({
  doc,
  logoUrl,
  titulo,
}: {
  doc: DocumentoPedido;
  /** Dirección absoluta del logo; sin ella el encabezado lleva el nombre de la empresa. */
  logoUrl: string | null;
  titulo: string;
}) {
  const varios = doc.proveedores.length > 1;
  const articulos = doc.proveedores.reduce((n, s) => n + s.lineas.length, 0);
  const unico = !varios ? doc.proveedores[0] : undefined;
  return (
    <Document title={titulo} author={EMPRESA.nombre} creator={EMPRESA.nombre}>
      <Page size="A4" style={styles.page}>
        <View style={styles.cabecera}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image no acepta alt
            <Image src={logoUrl} style={styles.logo} />
          ) : (
            <Text style={[styles.empresaNombre, { fontSize: 17 }]}>{EMPRESA.nombre}</Text>
          )}
          <View style={styles.empresa}>
            <Text style={styles.empresaNombre}>{EMPRESA.nombre}</Text>
            <Text>{EMPRESA.direccion}</Text>
            <Text>Tel. {EMPRESA.telefono} · WhatsApp {EMPRESA.whatsapp}</Text>
            <Text>{EMPRESA.email}</Text>
            <Text>{EMPRESA.web}</Text>
          </View>
        </View>

        <View style={styles.barraTitulo}>
          <Text style={styles.titulo}>ORDEN DE PEDIDO DE MATERIALES</Text>
          <Text style={styles.numero}>N° {doc.numero}</Text>
        </View>

        <View style={styles.info}>
          <Dato etiqueta="Fecha" valor={doc.fecha} />
          <Dato etiqueta="Pide" valor={doc.solicitante || "—"} />
          <Dato etiqueta="Obra / cliente" valor={doc.obra || "—"} ancho fuerte />
          <Dato etiqueta="Condiciones" valor={doc.condiciones.join("  ·  ")} ancho />
          {unico && (
            <Dato
              etiqueta="Proveedor"
              valor={[unico.nombre, unico.contacto, unico.telefono].filter(Boolean).join("  ·  ")}
              ancho
            />
          )}
        </View>

        <View style={styles.resumen}>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenNumero}>{doc.proveedores.length}</Text>
            <Text style={styles.resumenTexto}>{doc.proveedores.length === 1 ? "proveedor" : "proveedores"}</Text>
          </View>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenNumero}>{articulos}</Text>
            <Text style={styles.resumenTexto}>{articulos === 1 ? "artículo" : "artículos"}</Text>
          </View>
          {doc.sinPrecio > 0 && (
            <View style={styles.resumenItem}>
              <Text style={[styles.resumenNumero, { color: AMBAR }]}>{doc.sinPrecio}</Text>
              <Text style={styles.resumenTexto}>a confirmar</Text>
            </View>
          )}
        </View>

        {doc.proveedores.map((s, i) => (
          <Tabla key={i} s={s} conTitulo={varios} />
        ))}

        <View style={styles.totalCaja} wrap={false}>
          <View style={styles.total}>
            <Text>{varios ? "TOTAL ESTIMADO" : "TOTAL"}</Text>
            <Text>{formatARS(doc.total)}</Text>
          </View>
        </View>
        {doc.sinPrecio > 0 && (
          <Text style={styles.nota}>
            El total no incluye {doc.sinPrecio} {doc.sinPrecio === 1 ? "artículo" : "artículos"} con precio a confirmar con el proveedor.
          </Text>
        )}

        {doc.observaciones && (
          <View style={styles.observaciones} wrap={false}>
            <Text>
              <Text style={styles.negrita}>Observaciones: </Text>
              {doc.observaciones}
            </Text>
          </View>
        )}

        <View style={styles.firmas} wrap={false}>
          <Text style={styles.firma}>Solicitó</Text>
          <Text style={styles.firma}>{varios ? "Recibió conforme" : `Recibió conforme (${unico?.nombre ?? "proveedor"})`}</Text>
        </View>

        <View style={styles.pie} fixed>
          <Text>{EMPRESA.nombre} · {EMPRESA.web}</Text>
          <Text>Pedido {doc.numero} · {doc.fecha}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

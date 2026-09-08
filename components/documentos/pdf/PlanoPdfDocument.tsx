import { Document, Page, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * PDF de una sola página para el plano de piscina (losetas) — ver
 * `lib/documentos/losetas/imagenCliente.tsx`. No arma nada propio: envuelve
 * el mismo PNG que ya se ofrece para descargar como "Imagen" en una página
 * de `@react-pdf/renderer` con su mismo tamaño (escalado a puntos), así que
 * lo que ve el cliente en el PDF es exactamente lo mismo que en la imagen —
 * nunca dos layouts a mantener en paralelo.
 *
 * Tamaño de página: ancho fijo tipo A4 apaisado (842pt) y alto según la
 * proporción real del PNG — no A4 fijo con la imagen recortada o con bordes
 * en blanco, que casi nunca calzan con la proporción de una pileta.
 */
const ANCHO_PAGINA_PT = 842;

const styles = StyleSheet.create({
  page: { padding: 0 },
  imagen: { width: "100%" },
});

export function PlanoPdfDocument({
  pngDataUri,
  width,
  height,
}: {
  pngDataUri: string;
  width: number;
  height: number;
}) {
  const altoPagina = Math.round((ANCHO_PAGINA_PT * height) / width);
  return (
    <Document>
      <Page size={[ANCHO_PAGINA_PT, altoPagina]} style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image no acepta alt */}
        <Image src={pngDataUri} style={styles.imagen} />
      </Page>
    </Document>
  );
}

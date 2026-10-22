/**
 * Las reglas de lo que SALE de la app en un pedido (archivo, mensaje, lo que se comparte): nada de montos con "$"
 * ni formato de precio, ni teléfonos (+54, 353, 011, 11 y similares, 7 o más dígitos), ni notas internas, ni el
 * contacto del proveedor. Devuelve la lista de problemas (vacía = sale limpio).
 */
export function problemasDeSalida(texto: string, notaInterna = "NOTA-INTERNA"): string[] {
  const problemas: string[] = [];
  const falla = (re: RegExp, que: string) => {
    const m = texto.match(re);
    if (m) problemas.push(`${que}: "${m[0]}"`);
  };
  if (texto.trim().length < 20) problemas.push("quedó vacío: la extracción no sirve");
  falla(/\$/, "monto con $");
  falla(/\d{1,3}(\.\d{3})+,\d{2}|\d+,\d{2}(?!\d)|\d+\.\d{2}(?!\d)/, "formato de precio");
  falla(/12345|12\.345|9876|123456|250000|250\.000/, "precio cargado");
  falla(/\+54|(?<!\d)353\d|(?<!\d)011(?!\d)|(?<!\d)11[ -]?\d{4}|\+?\d(?:[ ().-]?\d){7,}/, "teléfono");
  if (texto.includes(notaInterna)) problemas.push("nota interna");
  falla(/Juan Contacto/, "contacto del proveedor");
  falla(/Precio unit|Subtotal|TOTAL ESTIMADO|A confirmar|Costo estimado|tentativos/i, "palabra de precios");
  return problemas;
}

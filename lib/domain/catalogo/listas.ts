/**
 * Precios de lista de piscinas COMPLETAS (hormigón por tamaño, fibra Indusplast).
 *
 * Viven en el catálogo de `piscinas` como cualquier ítem, pero NO son opcionales
 * del presupuesto: son el punto de partida del subtotal de construcción. Se
 * distinguen por el prefijo de la clave, así que dar de alta uno nuevo desde la
 * pantalla de Catálogo con ese prefijo alcanza para que aparezca en el selector
 * de la calculadora y bajo su filtro de línea en el Catálogo.
 */
export const LINEAS_PISCINA = [
  { id: "hormigon", etiqueta: "Hormigón", prefijo: "lista_hormigon_" },
  { id: "indusplast", etiqueta: "Indusplast", prefijo: "indusplast_" },
] as const;

export type LineaPiscina = (typeof LINEAS_PISCINA)[number]["id"];

export const PREFIJOS_LISTA_PISCINA = LINEAS_PISCINA.map((l) => l.prefijo);

export function esListaDePrecios(clave: string): boolean {
  return PREFIJOS_LISTA_PISCINA.some((p) => clave.startsWith(p));
}

/** La línea de una piscina completa (por el prefijo de su clave), o null si el
 *  ítem no es una piscina de lista. */
export function lineaDeClave(clave: string): LineaPiscina | null {
  return LINEAS_PISCINA.find((l) => clave.startsWith(l.prefijo))?.id ?? null;
}

/** Orden en que se muestran los modelos de fibra Indusplast (de la lista de precios). */
export const MODELOS_INDUSPLAST = ["racionalista", "caribe", "finesa", "lagune", "spa"] as const;

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "indusplast_caribe_550" → "Caribe"; null si no es una piscina Indusplast. */
export function modeloIndusplast(clave: string): string | null {
  const m = /^indusplast_([a-z]+)_/.exec(clave);
  return m ? mayuscula(m[1]) : null;
}

/** La medida de una piscina de lista: "indusplast_caribe_550" → "550",
 *  "lista_hormigon_7x3_50" → "7x3.50", "lista_hormigon_6_5x2.5" → "6.5x2.5". */
export function medidaDeLista(clave: string): string | null {
  const linea = LINEAS_PISCINA.find((l) => clave.startsWith(l.prefijo));
  if (!linea) return null;
  const resto = clave.slice(linea.prefijo.length);
  if (linea.id === "indusplast") return resto.replace(/^[a-z]+_/, "");
  return resto.replace(/(\d)_(\d)/g, "$1.$2");
}

/** Nombre corto para el listado: "Caribe 550", "Hormigón 7x3.50". */
export function nombreCortoLista(clave: string): string | null {
  const linea = lineaDeClave(clave);
  const medida = medidaDeLista(clave);
  if (!linea || !medida) return null;
  if (linea === "indusplast") return `${modeloIndusplast(clave) ?? "Indusplast"} ${medida}`;
  return `Hormigón ${medida}`;
}

/** Clave de orden por tamaño: 400 < 450 < 500; 5x3 < 6x3 < 7x3 < 7x3.50 < 7x4. */
export function ordenMedida(clave: string): number {
  const medida = medidaDeLista(clave) ?? "";
  const [a, b] = medida.split("x").map((n) => parseFloat(n));
  return Number.isFinite(b) ? a * 1000 + b : Number.isFinite(a) ? a : Number.POSITIVE_INFINITY;
}

/** Un número como se escribe en una medida: "8", "4.5" (punto decimal, sin ceros de más). */
function medidaNumero(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Los datos de una piscina de hormigón nueva, a partir de su largo y ancho: la clave (con el
 * prefijo que la ubica en su sección y en la planilla), la descripción y el nombre en la planilla.
 * La clave reemplaza sólo el PRIMER punto decimal por "_" (8x4.5 → lista_hormigon_8x4_5), igual
 * que las que ya existen, y es la que reconoce el script de la planilla.
 */
export function datosPiscinaHormigon(largo: number, ancho: number): { clave: string; descripcion: string; medida: string } | null {
  if (!(largo > 0) || !(ancho > 0)) return null;
  const medida = `${medidaNumero(largo)}x${medidaNumero(ancho)}`;
  return {
    clave: "lista_hormigon_" + medida.replace(".", "_"),
    descripcion: `Piscina de hormigón ${medida} — precio de lista, obra terminada`,
    medida,
  };
}

/** Los datos de una piscina de fibra Indusplast nueva: modelo (uno de MODELOS_INDUSPLAST) y medida. */
export function datosPiscinaIndusplast(modelo: string, medida: number): { clave: string; descripcion: string; medida: string } | null {
  const m = modelo.trim().toLowerCase();
  if (!(MODELOS_INDUSPLAST as readonly string[]).includes(m)) return null;
  if (!Number.isInteger(medida) || medida <= 0) return null;
  return {
    clave: `indusplast_${m}_${medida}`,
    descripcion: `Piscina de fibra Indusplast ${mayuscula(m)} ${medida} — contado, kit estándar instalado`,
    medida: `${m.toUpperCase()} ${medida}`,
  };
}

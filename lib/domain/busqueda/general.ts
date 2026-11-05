import { filtrarCatalogo, ordenarCatalogo, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import { ordenarMateriales, type Material } from "@/lib/domain/abastecimiento/material";
import { filtrarProveedores, ordenarProveedores, type Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { coincideBusqueda } from "@/lib/texto";

/** Lo mínimo de un presupuesto para encontrarlo y abrirlo. */
export interface PresupuestoResumen {
  id: string;
  tipo: "piscinas" | "cercos" | "cobertores" | "losetas" | "revestimientos";
  cliente_nombre: string;
  created_at: string;
}

export interface FuentesBusqueda {
  items: ItemCatalogo[];
  materiales: Material[];
  proveedores: Proveedor[];
  presupuestos: PresupuestoResumen[];
}

export interface ResultadosBusqueda {
  items: ItemCatalogo[];
  materiales: Material[];
  proveedores: Proveedor[];
  presupuestos: PresupuestoResumen[];
  total: number;
}

/** Con una sola letra coincide casi todo y la lista no ayuda: se empieza a buscar desde dos. */
export const MINIMO_BUSQUEDA = 2;

const SIN_RESULTADOS: ResultadosBusqueda = { items: [], materiales: [], proveedores: [], presupuestos: [], total: 0 };

/** El nombre con el que se reconoce un ítem: "Caribe 550" antes que la descripción larga. */
export function nombreDeItem(item: Pick<ItemCatalogo, "clave" | "descripcion">): string {
  return nombreCortoLista(item.clave) ?? (item.descripcion || item.clave);
}

/**
 * Busca lo mismo en precios de venta, materiales, proveedores y presupuestos. Lo desactivado no aparece, igual que en
 * las listas. Un material también se encuentra por el nombre de su proveedor: buscar a un proveedor muestra lo que se
 * le compra. Los presupuestos llegan ordenados del más nuevo al más viejo y mantienen ese orden.
 */
export function buscarEnTodo(fuentes: FuentesBusqueda, busqueda: string): ResultadosBusqueda {
  const q = busqueda.trim();
  if (q.length < MINIMO_BUSQUEDA) return SIN_RESULTADOS;

  const nombreProveedor = new Map(fuentes.proveedores.map((p) => [p.id, p.nombre]));
  const items = ordenarCatalogo(filtrarCatalogo(fuentes.items, { busqueda: q }));
  const materiales = ordenarMateriales(
    fuentes.materiales.filter(
      (m) =>
        m.activo &&
        coincideBusqueda([m.nombre, m.notas, m.rubro, m.proveedor_id ? nombreProveedor.get(m.proveedor_id) : null].join(" "), q)
    )
  );
  const proveedores = ordenarProveedores(filtrarProveedores(fuentes.proveedores, { busqueda: q }));
  const presupuestos = fuentes.presupuestos.filter((p) => coincideBusqueda(p.cliente_nombre, q));

  return {
    items,
    materiales,
    proveedores,
    presupuestos,
    total: items.length + materiales.length + proveedores.length + presupuestos.length,
  };
}

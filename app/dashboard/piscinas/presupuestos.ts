import {
  guardarPresupuesto as guardar,
  listarPresupuestos as listar,
  obtenerPresupuesto as obtener,
  actualizarPresupuesto as actualizar,
  eliminarPresupuesto as eliminar,
  subirFotoPresupuesto as subirFoto,
} from "@/lib/presupuestos";
import {
  actualizarCatalogoItem as actualizarCatalogo,
  obtenerCatalogo as obtenerCat,
  guardarTextosCompartidos as guardarTextos,
} from "@/lib/catalogo";

const TIPO = "piscinas" as const;

export const guardarPresupuesto = (datos: unknown, clienteNombre: string) =>
  guardar(TIPO, datos, clienteNombre);

export const listarPresupuestos = () => listar(TIPO);

export const obtenerPresupuesto = (id: string) => obtener(id);

export const actualizarPresupuesto = (id: string, datos: unknown, clienteNombre: string) =>
  actualizar(id, datos, clienteNombre);

export const eliminarPresupuesto = (id: string) => eliminar(id);

export const subirFotoPresupuesto = (blob: Blob) => subirFoto(TIPO, blob);

export const actualizarCatalogoItem = (
  clave: string,
  precio: number | null,
  descripcion?: string
) => actualizarCatalogo(TIPO, clave, precio, descripcion);

export const obtenerCatalogo = () => obtenerCat(TIPO);

export const guardarTextosCompartidos = (
  entradas: { clave: string; descripcion: string }[]
) => guardarTextos(TIPO, entradas);

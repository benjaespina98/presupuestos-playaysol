import {
  guardarPresupuesto as guardar,
  listarPresupuestos as listar,
  obtenerPresupuesto as obtener,
  actualizarPresupuesto as actualizar,
  eliminarPresupuesto as eliminar,
  subirFotoPresupuesto as subirFoto,
} from "@/lib/presupuestos";
import { actualizarCatalogoItem as actualizarCatalogo } from "@/lib/catalogo";

const TIPO = "cercos" as const;

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

"use client";

import { IconEdit } from "@/components/icons";
import { BOTON_LAPIZ } from "./botones";

/**
 * El lápiz de las filas de una lista: la pista visual de que se puede editar. 44×44, con borde, hover, foco y
 * estado activo. Tocar toda la fila también abre la edición; el lápiz es el camino para el teclado y los
 * lectores de pantalla ("Editar <nombre>").
 */
export function BotonLapiz({ nombre, onClick, etiqueta, ayuda }: { nombre: string; onClick: () => void; etiqueta?: string; /** El globo que sale al apoyar el mouse (por defecto, el nombre accesible). */ ayuda?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={etiqueta ?? `Editar ${nombre}`} title={ayuda ?? etiqueta ?? `Editar ${nombre}`} className={BOTON_LAPIZ}>
      <IconEdit className="h-[18px] w-[18px]" />
    </button>
  );
}

/**
 * Para que tocar la fila entera abra la edición: devuelve el `onClick` de la fila, que ignora los toques sobre
 * botones, links y campos (teléfonos, menús, interruptores) para que no disparen la edición.
 */
export function alTocarFila(onEditar: () => void) {
  return (e: React.MouseEvent<HTMLElement>) => {
    const objetivo = e.target as HTMLElement;
    if (objetivo.closest("button, a, input, select, textarea, label, [role=menu], [role=menuitem]")) return;
    // Si se está seleccionando texto (para copiarlo), no se abre.
    if (window.getSelection()?.toString()) return;
    onEditar();
  };
}

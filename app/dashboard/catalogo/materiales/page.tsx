"use client";

import { sinTituloRepetido } from "@/lib/domain/catalogo/nombre";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { listarMateriales, listarProveedores } from "@/lib/abastecimiento";
import {
  RUBROS_MATERIAL,
  contarMaterialesPorRubro,
  filtrarMateriales,
  ordenarMateriales,
  type Material,
} from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { formatARS } from "@/lib/format/ars";
import { formatFechaCompleta, formatFechaRelativaCorta } from "@/lib/format/fecha";
import { opcionesDeOrden, ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { useBusquedaDeUrl } from "@/lib/useBusquedaDeUrl";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { BarraHerramientas } from "@/components/ui/BarraHerramientas";
import { Toast } from "@/components/ui/BarraListado";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { Aviso } from "@/components/ui/Aviso";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { botonDe } from "@/components/ui/botones";
import { COLUMNA_NUMERO, LISTA, LISTA_ENCABEZADO, LISTA_FILA, LISTA_GRUPO, LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";
import { MaterialModal } from "@/components/abastecimiento/MaterialModal";

/** Las columnas de la tabla desde `lg`: Material · Proveedor · Rubro · Precio · Unidad · Actualizado · Editar. */
const COLUMNAS = "lg:grid-cols-[minmax(0,1fr)_11rem_9rem_8rem_4rem_6.5rem_3.5rem]";

interface Filtros {
  busqueda: string;
  rubro: string;
  proveedorId: string;
  soloSinPrecio: boolean;
  incluirInactivos: boolean;
  orden: ClaveOrden;
}
const SIN_FILTROS: Filtros = { busqueda: "", rubro: "", proveedorId: "", soloSinPrecio: false, incluirInactivos: false, orden: "defecto" };
const ORDENES = opcionesDeOrden(["nombre", "precio", "actualizado"]);

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda, los filtros y el orden se conservan al abrir otra pantalla y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("materiales:filtros", SIN_FILTROS);
  const { rubro, proveedorId, soloSinPrecio, incluirInactivos } = filtros;
  useBusquedaDeUrl((b) => setFiltros({ ...SIN_FILTROS, busqueda: b }));
  const busqueda = useDeferredValue(filtros.busqueda);
  const orden = filtros.orden ?? "defecto";
  const cambiar = (parcial: Partial<Filtros>) => setFiltros({ ...filtros, ...parcial });
  const [editando, setEditando] = useState<Material | null>(null);
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Estable, para que abrir un aviso o cerrar una hoja no vuelva a dibujar todas las filas.
  const abrirEdicion = useCallback((m: Material) => {
    setMensaje(null);
    setEditando(m);
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [m, p] = await Promise.all([listarMateriales(), listarProveedores()]);
      if (cancelado) return;
      if (m.error) setError(m.error);
      else setMateriales(m.items);
      if (p.items) setProveedores(p.items);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const nombreProveedor = useMemo(() => new Map(proveedores.map((p) => [p.id, p.nombre])), [proveedores]);

  const visibles = useMemo(
    () =>
      materiales
        ? ordenarPor(
            ordenarMateriales(
              filtrarMateriales(materiales, {
                busqueda,
                rubro: rubro || null,
                proveedorId: proveedorId || null,
                soloSinPrecio,
                incluirInactivos,
              })
            ),
            orden,
            { nombre: (m) => m.nombre, precio: (m) => m.precio, actualizado: (m) => m.precio_actualizado }
          )
        : null,
    [materiales, busqueda, rubro, proveedorId, soloSinPrecio, incluirInactivos, orden]
  );

  const conteos = useMemo(
    () => contarMaterialesPorRubro(materiales ?? [], { busqueda, proveedorId: proveedorId || null, soloSinPrecio, incluirInactivos }),
    [materiales, busqueda, proveedorId, soloSinPrecio, incluirInactivos]
  );

  const sinPrecio = useMemo(
    () => (materiales ? materiales.filter((m) => (incluirInactivos || m.activo) && m.precio === null).length : 0),
    [materiales, incluirInactivos]
  );

  // Por categoría, con encabezados livianos que quedan fijos al bajar. Con un orden elegido, una sola lista (el orden vale para todo).
  const grupos = useMemo(() => {
    if (orden !== "defecto") return [["", visibles ?? []] as [string, Material[]]];
    const porRubro = new Map<string, Material[]>();
    for (const m of visibles ?? []) {
      const clave = m.rubro ?? "Sin rubro";
      const bloque = porRubro.get(clave);
      if (bloque) bloque.push(m);
      else porRubro.set(clave, [m]);
    }
    return [...porRubro.entries()].sort(([a], [b]) => (a === "Sin rubro" ? 1 : b === "Sin rubro" ? -1 : a.localeCompare(b, "es")));
  }, [visibles, orden]);

  const rubrosVisibles = [...RUBROS_MATERIAL, "Sin rubro"].filter((r) => (conteos.porRubro[r] ?? 0) > 0 || r === rubro);
  const hayFiltros = !!(filtros.busqueda || rubro || proveedorId || soloSinPrecio || incluirInactivos || orden !== "defecto");
  const cerrarToast = useCallback(() => setMensaje(null), []);

  const opcionesProveedor = [{ id: "", etiqueta: "Todos los proveedores" }, ...proveedores.map((p) => ({ id: p.id, etiqueta: p.nombre }))];

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina
        titulo="Materiales"
        descripcion="Lo que se compra para las obras: proveedor, precio de costo y cantidades por tamaño de pileta."
      />

      <BarraHerramientas
        buscador={{ valor: filtros.busqueda, onCambio: (v) => cambiar({ busqueda: v }), placeholder: "Buscar", etiqueta: "Buscar materiales" }}
        secciones={[
          {
            id: "rubro",
            titulo: "Rubro",
            opciones: [{ id: "", etiqueta: "Todos", cantidad: conteos.total }, ...rubrosVisibles.map((r) => ({ id: r, etiqueta: r, cantidad: conteos.porRubro[r] ?? 0 }))],
            valor: rubro,
            onCambio: (v) => cambiar({ rubro: v }),
          },
          {
            id: "proveedor",
            titulo: "Proveedor",
            opciones: opcionesProveedor,
            valor: proveedorId,
            onCambio: (v) => cambiar({ proveedorId: v }),
          },
        ]}
        orden={{ opciones: ORDENES, valor: orden, onCambio: (v) => cambiar({ orden: v }) }}
        interruptores={[
          { id: "a-confirmar", etiqueta: `Sólo "A confirmar" (${sinPrecio})`, valor: soloSinPrecio, onCambio: (v) => cambiar({ soloSinPrecio: v }) },
          { id: "inactivos", etiqueta: "Mostrar desactivados", valor: incluirInactivos, onCambio: (v) => cambiar({ incluirInactivos: v }) },
        ]}
        acciones={[{ etiqueta: "Cambiar varios precios", texto: "Cambiar precios", href: "/dashboard/catalogo/actualizar-precios?que=materiales" }]}
        agregar={{
          etiqueta: "Agregar material",
          onClick: () => {
            setMensaje(null);
            setCreando(true);
          },
        }}
        resultados={visibles?.length ?? 0}
        contador={
          visibles && !error ? `${visibles.length} ${hayFiltros && materiales ? `de ${materiales.filter((m) => incluirInactivos || m.activo).length} materiales` : visibles.length === 1 ? "material" : "materiales"}` : undefined
        }
        hayFiltros={hayFiltros}
        onLimpiar={() => setFiltros(SIN_FILTROS)}
      />

      {error && <Aviso tono="error">No se pudieron cargar los materiales: {error}</Aviso>}
      {!error && materiales === null && <ListaCargando />}

      {!error && visibles && visibles.length === 0 && (
        <ListaVacia
          accion={
            hayFiltros ? (
              <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className={botonDe("secundario", "px-4")}>
                Limpiar filtros
              </button>
            ) : undefined
          }
        >
          {hayFiltros ? "Ningún material coincide con el filtro." : "Todavía no hay materiales cargados."}
        </ListaVacia>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <div className={LISTA}>
            <div aria-hidden="true" className={`${LISTA_ENCABEZADO} ${COLUMNAS}`}>
              <span>Material</span>
              <span>Proveedor</span>
              <span>Rubro</span>
              <span className="text-right">Precio</span>
              <span>Unidad</span>
              <span className="text-center">Actualizado</span>
              <span className="text-center">Editar</span>
            </div>
            {grupos.map(([nombre, items]) => (
              <section key={nombre} aria-label={nombre || "Materiales"} className="border-t border-gray-100 first:border-t-0 lg:border-t-0">
                {nombre && (
                  <h3 className={`${LISTA_GRUPO} lg:hidden`}>
                    {nombre} <span className="font-normal text-[#4A5861]">({items.length})</span>
                  </h3>
                )}
                <ul className={LISTA_SEPARADORES}>
                  {items.map((m) => (
                    <FilaMaterial
                      key={m.id}
                      material={m}
                      proveedor={m.proveedor_id ? (nombreProveedor.get(m.proveedor_id) ?? null) : null}
                      onEditar={abrirEdicion}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {editando && (
        <MaterialModal
          key={editando.id}
          material={editando}
          proveedores={proveedores}
          onClose={() => setEditando(null)}
          onGuardado={(m) => {
            setMateriales((prev) => (prev ? prev.map((x) => (x.id === m.id ? m : x)) : prev));
            setEditando(null);
            setMensaje(`Se guardó "${m.nombre}".`);
          }}
        />
      )}

      {creando && (
        <MaterialModal
          material={null}
          proveedores={proveedores}
          onClose={() => setCreando(false)}
          onGuardado={(m) => {
            setMateriales((prev) => (prev ? [...prev, m] : [m]));
            setCreando(false);
            setMensaje(`Se agregó "${m.nombre}".`);
          }}
        />
      )}

      <Toast mensaje={mensaje} onCerrar={cerrarToast} />
    </PanelPortal>
  );
}

/**
 * Una fila (unos 52 px). Tocar la fila entera abre la edición, y el lápiz de la derecha es la pista visual (y
 * el camino para el teclado). En el celular: nombre y proveedor a la izquierda, precio con su unidad y el lápiz
 * a la derecha; desde `lg`, una fila de la tabla con todas las columnas.
 */
const FilaMaterial = memo(function FilaMaterial({ material: m, proveedor, onEditar }: { material: Material; proveedor: string | null; onEditar: (m: Material) => void }) {
  const relativa = m.precio_actualizado ? formatFechaRelativaCorta(m.precio_actualizado) : "";
  return (
    <li
      onClick={alTocarFila(() => onEditar(m))}
      className={`${LISTA_FILA} ${COLUMNAS} ${m.activo ? "" : "opacity-70"}`}
    >
      <span className="min-w-0 flex-1 lg:flex-none">
        <span className="flex items-center gap-2">
          <span className="line-clamp-3 break-words lg:truncate font-medium text-gray-900">{sinTituloRepetido(m.nombre, m.rubro)}</span>
          {!m.activo && <Pastilla className="shrink-0">Desactivado</Pastilla>}
        </span>
        <span className={`block truncate ${TEXTO_SECUNDARIO} lg:hidden`}>{proveedor ?? "Sin proveedor"}</span>
      </span>

      <span className="hidden min-w-0 truncate text-gray-700 lg:block" title={proveedor ?? undefined}>
        {proveedor ?? <span className="text-[#4A5861]">Sin proveedor</span>}
      </span>

      <span className="hidden min-w-0 truncate text-gray-700 lg:block">{m.rubro ?? ""}</span>

      <span className={`shrink-0 ${COLUMNA_NUMERO}`}>
        {m.precio === null ? (
          <Pastilla tono="aviso">A confirmar</Pastilla>
        ) : (
          <span className="whitespace-nowrap font-semibold text-gray-900">
            {formatARS(m.precio)}
            {m.unidad && <span className="text-[13px] font-normal text-[#4A5861] lg:hidden"> / {m.unidad}</span>}
          </span>
        )}
      </span>

      <span className={`hidden ${TEXTO_SECUNDARIO} lg:block`}>{m.unidad ?? ""}</span>

      <span className="hidden whitespace-nowrap text-center text-[13px] text-[#4A5861] lg:block" title={m.precio_actualizado ? formatFechaCompleta(m.precio_actualizado) : undefined}>
        {relativa}
      </span>

      <span className="flex shrink-0 justify-end lg:justify-center">
        <BotonLapiz nombre={m.nombre} onClick={() => onEditar(m)} />
      </span>
    </li>
  );
});

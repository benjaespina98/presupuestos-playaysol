"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { listarMateriales, listarProveedores } from "@/lib/abastecimiento";
import { listarItemsCatalogo } from "@/lib/catalogo";
import { sinTelefono, telefonosDe, type Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import type { Material } from "@/lib/domain/abastecimiento/material";
import {
  buscarEnTodo,
  MINIMO_BUSQUEDA,
  nombreDeItem,
  type FuentesBusqueda,
  type PresupuestoResumen,
} from "@/lib/domain/busqueda/general";
import { llevaStock, stockNegativo, textoResumenStock, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import { formatARS } from "@/lib/format/ars";
import { listarPresupuestosResumen } from "@/lib/presupuestos";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { TITULOS_TIPO } from "@/components/catalogo/titulos-tipo";
import { IconCopy } from "@/components/icons";
import { Aviso } from "@/components/ui/Aviso";
import { botonDe } from "@/components/ui/botones";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { Buscador } from "@/components/ui/FiltrosPlegables";
import { COLUMNA_NUMERO, LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";

/** Las áreas del portal, una tarjeta cada una. Sin explicaciones: el nombre alcanza. */
const AREAS = [
  {
    href: "/dashboard/nuevo",
    nombre: "Presupuestos",
    icono: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
  },
  {
    href: "/dashboard/losetas",
    nombre: "Plano de piscina",
    icono: <path d="M3 3h18v18H3zM3 8h4M3 13h4M17 8h4M17 13h4M8 3v4M13 3v4M8 17v4M13 17v4" />,
  },
  {
    href: "/dashboard/catalogo",
    nombre: "Precios",
    icono: <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01" />,
  },
  {
    href: "/dashboard/stock",
    nombre: "Stock Indusplast",
    conResumen: true,
    icono: <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7l8.7 5 8.7-5M12 22V12" />,
  },
  {
    href: "/dashboard/catalogo/materiales",
    nombre: "Compras",
    icono: <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  },
] as const;

/** Cuántos resultados se ven de cada grupo antes de tocar "Ver los N". */
const POR_GRUPO = 6;

const FILA = "flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 px-4 py-2 text-sm leading-5 transition-colors hover:bg-[#F4F8F9] active:bg-[#EAF0F2]";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit" });
const aLista = (ruta: string, busqueda: string) => `${ruta}?buscar=${encodeURIComponent(busqueda)}`;

interface Carga {
  fuentes: FuentesBusqueda;
  /** Los nombres de lo que no se pudo leer: se busca en lo demás y se avisa. */
  errores: string[];
}

export default function InicioPage() {
  const [carga, setCarga] = useState<Carga | null>(null);
  const [busqueda, setBusqueda] = useEstadoPersistente("inicio:busqueda", "");
  const consulta = useDeferredValue(busqueda);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [items, materiales, proveedores, presupuestos] = await Promise.all([
        listarItemsCatalogo(),
        listarMateriales(),
        listarProveedores(),
        listarPresupuestosResumen(),
      ]);
      if (cancelado) return;
      const errores = [
        items.error && "precios",
        materiales.error && "materiales",
        proveedores.error && "proveedores",
        presupuestos.error && "presupuestos",
      ].filter((e): e is string => !!e);
      setCarga({
        fuentes: {
          items: items.items ?? [],
          materiales: materiales.items ?? [],
          proveedores: proveedores.items ?? [],
          presupuestos: presupuestos.items ?? [],
        },
        errores,
      });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const resumenStock = useMemo(() => (carga ? textoResumenStock(carga.fuentes.items.filter((i) => i.activo)) : null), [carga]);
  const buscando = busqueda.trim().length > 0;

  return (
    <PanelPortal>
      <h1 className="sr-only">Inicio</h1>
      <Buscador
        valor={busqueda}
        onCambio={setBusqueda}
        placeholder="Buscá un precio, proveedor o cliente"
        etiqueta="Buscar precios, materiales, proveedores y presupuestos"
      />

      {carga && carga.errores.length > 0 && (
        <Aviso tono="error" className="mt-4">
          No se pudo leer: {carga.errores.join(", ")}. Revisá tu conexión y volvé a entrar.
        </Aviso>
      )}

      {buscando ? (
        <Resultados carga={carga} consulta={consulta} />
      ) : (
        <nav aria-label="Áreas del portal" className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              data-borde-sutil=""
              className="group flex min-h-24 items-center gap-4 rounded-xl border border-gray-200 bg-[#FFFFFF] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-marca hover:shadow-md active:translate-y-0 sm:p-6"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 shrink-0 text-[#647F8A] transition group-hover:text-[#244B5A]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {a.icono}
              </svg>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-gray-900">{a.nombre}</h2>
                {"conResumen" in a && resumenStock && <p className={`mt-0.5 ${TEXTO_SECUNDARIO}`}>{resumenStock}</p>}
              </div>
              <span aria-hidden="true" className="text-2xl text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-marca">
                ›
              </span>
            </Link>
          ))}
        </nav>
      )}
    </PanelPortal>
  );
}

function Resultados({ carga, consulta }: { carga: Carga | null; consulta: string }) {
  const resultados = useMemo(() => (carga ? buscarEnTodo(carga.fuentes, consulta) : null), [carga, consulta]);
  const q = consulta.trim();

  if (q.length < MINIMO_BUSQUEDA) {
    return <p className={`mt-4 ${TEXTO_SECUNDARIO}`}>Seguí escribiendo para buscar.</p>;
  }
  if (!carga || !resultados) {
    return (
      <div className="mt-4">
        <ListaCargando filas={4} />
      </div>
    );
  }
  const nombreProveedor = new Map(carga.fuentes.proveedores.map((p) => [p.id, p.nombre]));

  return (
    <div className="mt-4 space-y-4">
      <p role="status" className="sr-only">
        {resultados.total === 1 ? "1 resultado" : `${resultados.total} resultados`}
      </p>
      {resultados.total === 0 && <ListaVacia>Nada coincide con “{q}”.</ListaVacia>}
      <Grupo titulo="Precios de venta" lista={resultados.items} fila={(i) => <FilaItem key={i.id} item={i} />} />
      <Grupo
        titulo="Materiales"
        lista={resultados.materiales}
        fila={(m) => <FilaMaterial key={m.id} material={m} proveedor={m.proveedor_id ? nombreProveedor.get(m.proveedor_id) : undefined} />}
      />
      <Grupo titulo="Proveedores" lista={resultados.proveedores} fila={(p) => <FilaProveedor key={p.id} proveedor={p} />} />
      <Grupo titulo="Presupuestos" lista={resultados.presupuestos} fila={(p) => <FilaPresupuesto key={p.id} presupuesto={p} />} />
    </div>
  );
}

function Grupo<T>({ titulo, lista, fila }: { titulo: string; lista: T[]; fila: (elemento: T) => ReactNode }) {
  const [todos, setTodos] = useState(false);
  if (lista.length === 0) return null;
  const visibles = todos ? lista : lista.slice(0, POR_GRUPO);

  return (
    <section aria-label={titulo} className="overflow-hidden rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]">
      <h2 className="flex h-9 items-center gap-1.5 border-b border-[#D9DFE3] bg-[#F4F8F9] px-4 text-[13px] font-bold uppercase tracking-wide text-[#244B5A]">
        {titulo}
        <span className="font-medium text-[#4A5861]">({lista.length})</span>
      </h2>
      <ul className={LISTA_SEPARADORES}>{visibles.map(fila)}</ul>
      {!todos && lista.length > POR_GRUPO && (
        <div className="border-t border-[#EEF1F3] px-2 py-1">
          <button type="button" onClick={() => setTodos(true)} className={botonDe("texto", "w-full")}>
            Ver los {lista.length}
          </button>
        </div>
      )}
    </section>
  );
}

function FilaItem({ item }: { item: ItemCatalogo }) {
  const nombre = nombreDeItem(item);
  return (
    <li className="flex">
      <Link href={aLista("/dashboard/catalogo", nombre)} className={FILA}>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words font-medium text-gray-900">{nombre}</span>
          {llevaStock(item) && (
            <Pastilla tono={stockNegativo(item) ? "error" : "neutro"} className="mt-1">
              Stock {item.stock}
            </Pastilla>
          )}
        </span>
        <Precio precio={item.precio} unidad={item.unidad} sinPrecio="A cotizar" />
      </Link>
    </li>
  );
}

function FilaMaterial({ material, proveedor }: { material: Material; proveedor?: string }) {
  return (
    <li className="flex">
      <Link href={aLista("/dashboard/catalogo/materiales", material.nombre)} className={FILA}>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words font-medium text-gray-900">{material.nombre}</span>
          {proveedor && <span className={`block truncate ${TEXTO_SECUNDARIO}`}>{proveedor}</span>}
        </span>
        <Precio precio={material.precio} unidad={material.unidad} sinPrecio="A confirmar" />
      </Link>
    </li>
  );
}

function FilaProveedor({ proveedor }: { proveedor: Proveedor }) {
  const telefono = sinTelefono(proveedor) ? null : telefonosDe(proveedor.telefono!)[0];
  return (
    <li className="flex items-center">
      <Link href={aLista("/dashboard/catalogo/proveedores", proveedor.nombre)} className={FILA}>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words font-medium text-gray-900">{proveedor.nombre}</span>
          <span className={`block break-words ${TEXTO_SECUNDARIO}`}>{telefono ?? "Sin teléfono"}</span>
        </span>
      </Link>
      {telefono && (
        <a href={`tel:${telefono.replace(/[^\d+]/g, "")}`} aria-label={`Llamar a ${proveedor.nombre}`} className={botonDe("suave", "mr-3 shrink-0 px-3")}>
          Llamar
        </a>
      )}
    </li>
  );
}

function FilaPresupuesto({ presupuesto: p }: { presupuesto: PresupuestoResumen }) {
  return (
    <li className="flex items-center">
      <Link href={`/dashboard/${p.tipo}?id=${p.id}`} className={FILA}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900">{p.cliente_nombre}</span>
          <span className={`block truncate ${TEXTO_SECUNDARIO}`}>
            {TITULOS_TIPO[p.tipo]} · {fecha(p.created_at)}
          </span>
        </span>
      </Link>
      <Link
        href={`/dashboard/${p.tipo}?duplicar=${p.id}`}
        title="Duplicar"
        aria-label={`Duplicar presupuesto de ${p.cliente_nombre}`}
        className={botonDe("suave", "mr-3 w-11 shrink-0 px-0")}
      >
        <IconCopy className="h-4 w-4" />
      </Link>
    </li>
  );
}

function Precio({ precio, unidad, sinPrecio }: { precio: number | null; unidad: string | null; sinPrecio: string }) {
  if (precio === null) return <Pastilla tono="aviso">{sinPrecio}</Pastilla>;
  return (
    <span className={`shrink-0 ${COLUMNA_NUMERO}`}>
      <span className="block font-semibold text-gray-900">{formatARS(precio)}</span>
      {unidad && <span className={`block ${TEXTO_SECUNDARIO}`}>{unidad}</span>}
    </span>
  );
}

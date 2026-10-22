"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  listarTodosLosPresupuestos,
  anularPresupuesto,
  resumenPresupuesto,
  nombreCreador,
  type Presupuesto,
  type TipoCalculadora,
} from "@/lib/presupuestos";
import { AnularDialog } from "@/components/AnularDialog";
import { EtiquetaAnulado } from "@/components/Anulado";
import { botonDe } from "@/components/ui/botones";
import { BarraHerramientas } from "@/components/ui/BarraHerramientas";
import { contarPorFecha, dentroDeFecha, OPCIONES_FECHA, type FiltroFecha } from "@/lib/filtroFecha";
import { etiquetaCortaDeOrden, opcionesDeOrden, ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { contarAnulados, estaAnulado } from "@/lib/anulacion";
import { PanelPortal } from "@/components/PanelPortal";
import { IconEdit, IconCopy, IconTrash } from "@/components/icons";

const TIPOS_VALIDOS: TipoCalculadora[] = [
  "piscinas",
  "cercos",
  "cobertores",
  "losetas",
  "revestimientos",
];

const TITULOS: Record<TipoCalculadora, string> = {
  piscinas: "Piscinas",
  cercos: "Cercos",
  cobertores: "Cobertores",
  losetas: "Plano de Piscina",
  revestimientos: "Revestimientos",
};

const ORDENES = opcionesDeOrden(["nombre", "actualizado"]);

function esTipoValido(tipo: string): tipo is TipoCalculadora {
  return (TIPOS_VALIDOS as string[]).includes(tipo);
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function HistorialPage() {
  return (
    <Suspense fallback={null}>
      <HistorialTabla />
    </Suspense>
  );
}

function HistorialTabla() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoParam = searchParams.get("tipo");
  const tipoFiltro = tipoParam && esTipoValido(tipoParam) ? tipoParam : null;

  const [presupuestos, setPresupuestos] = useState<Presupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda y "mostrar anulados" se conservan al abrir un presupuesto y volver (tipo y usuario van en la URL).
  const [busqueda, setBusqueda] = useEstadoPersistente("historial:busqueda", "");
  const [porAnular, setPorAnular] = useState<Presupuesto | null>(null);
  const [mostrarAnulados, setMostrarAnulados] = useEstadoPersistente("historial:anulados", false);
  const [orden, setOrden] = useEstadoPersistente<ClaveOrden>("historial:orden", "defecto");
  const [fecha, setFecha] = useEstadoPersistente<FiltroFecha>("historial:fecha", "");
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const usuarioParam = searchParams.get("usuario");

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelado) setUserId(data.user?.id ?? null);
    });
    listarTodosLosPresupuestos()
      .then((data) => {
        if (!cancelado) setPresupuestos(data);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function cambiarTipo(tipo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tipo) params.set("tipo", tipo);
    else params.delete("tipo");
    router.push(`/dashboard/historial${params.toString() ? `?${params}` : ""}`);
  }

  function cambiarUsuario(usuario: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (usuario) params.set("usuario", usuario);
    else params.delete("usuario");
    router.push(`/dashboard/historial${params.toString() ? `?${params}` : ""}`);
  }

  const usuarios = useMemo(() => {
    if (!presupuestos) return [];
    const porId = new Map<string, string>();
    for (const p of presupuestos) {
      if (p.created_by) porId.set(p.created_by, nombreCreador(p.creador));
    }
    return Array.from(porId.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [presupuestos]);

  const presupuestosFiltrados = useMemo(() => {
    if (!presupuestos) return null;
    const q = busqueda.trim().toLowerCase();
    const filtrados = presupuestos.filter((p) => {
      if (!mostrarAnulados && estaAnulado(p)) return false;
      if (tipoFiltro && p.tipo !== tipoFiltro) return false;
      if (usuarioParam && p.created_by !== usuarioParam) return false;
      if (q && !p.cliente_nombre.toLowerCase().includes(q)) return false;
      if (!dentroDeFecha(p.created_at, fecha)) return false;
      return true;
    });
    return ordenarPor(filtrados, orden, { nombre: (p) => p.cliente_nombre, actualizado: (p) => p.created_at });
  }, [presupuestos, busqueda, tipoFiltro, usuarioParam, mostrarAnulados, fecha, orden]);

  // Cuántos hay por tipo con el resto de los filtros aplicados (los contadores de los chips).
  const conteoPorTipo = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = (presupuestos ?? []).filter(
      (p) => (mostrarAnulados || !estaAnulado(p)) && (!usuarioParam || p.created_by === usuarioParam) && (!q || p.cliente_nombre.toLowerCase().includes(q)) && dentroDeFecha(p.created_at, fecha)
    );
    const porTipo: Record<string, number> = {};
    for (const p of base) porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1;
    return { total: base.length, porTipo };
  }, [presupuestos, busqueda, usuarioParam, mostrarAnulados, fecha]);

  // Cuántos hay por período con el resto de los filtros aplicados.
  const conteoPorFecha = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return contarPorFecha(
      (presupuestos ?? []).filter(
        (p) =>
          (mostrarAnulados || !estaAnulado(p)) &&
          (!tipoFiltro || p.tipo === tipoFiltro) &&
          (!usuarioParam || p.created_by === usuarioParam) &&
          (!q || p.cliente_nombre.toLowerCase().includes(q))
      ),
      (p) => p.created_at
    );
  }, [presupuestos, busqueda, tipoFiltro, usuarioParam, mostrarAnulados]);

  const cantidadAnulados = useMemo(() => contarAnulados(presupuestos ?? []), [presupuestos]);

  /** Devuelve el mensaje de error (el diálogo queda abierto) o null si se anuló. */
  async function confirmarAnular(motivo: string): Promise<string | null> {
    if (!porAnular) return null;
    const objetivo = porAnular;
    setErrorAccion(null);
    const { error } = await anularPresupuesto(objetivo.id, motivo);
    if (error) return error.message;
    // Queda en la lista (con su etiqueta) para quien muestre los anulados.
    setPresupuestos((prev) =>
      prev
        ? prev.map((p) =>
            p.id === objetivo.id
              ? { ...p, anulado_at: new Date().toISOString(), anulado_por: userId, anulado_motivo: motivo }
              : p
          )
        : prev
    );
    setPorAnular(null);
    return null;
  }

  const hayFiltros = !!(busqueda || tipoFiltro || usuarioParam || fecha || mostrarAnulados || orden !== "defecto");
  const opcionesUsuario = [{ id: "", etiqueta: "Todos los usuarios" }, ...usuarios.map(([id, nombre]) => ({ id, etiqueta: nombre }))];

  return (
    <PanelPortal compacto amplio>
      <h1 className="sr-only">Historial</h1>
      <p className="sr-only">Todos los presupuestos guardados en la nube por el equipo.</p>

      <BarraHerramientas
        buscador={{ valor: busqueda, onCambio: setBusqueda, placeholder: "Buscar cliente", etiqueta: "Buscar por nombre de cliente" }}
        secciones={[
          {
            id: "tipo",
            titulo: "Tipo",
            opciones: [
              { id: "", etiqueta: "Todos", cantidad: conteoPorTipo.total },
              ...TIPOS_VALIDOS.map((t) => ({ id: t as string, etiqueta: TITULOS[t], cantidad: conteoPorTipo.porTipo[t] ?? 0 })),
            ],
            valor: tipoFiltro ?? "",
            onCambio: cambiarTipo,
          },
          ...(usuarios.length > 1
            ? [{ id: "usuario", titulo: "Usuario", opciones: opcionesUsuario, valor: usuarioParam ?? "", onCambio: cambiarUsuario }]
            : []),
          {
            id: "fecha",
            titulo: "Fecha",
            opciones: OPCIONES_FECHA.map((o) => ({ id: o.id, etiqueta: o.etiqueta, cantidad: conteoPorFecha[o.id] })),
            valor: fecha,
            onCambio: (v) => setFecha(v as FiltroFecha),
          },
        ]}
        orden={{
          opciones: ORDENES.map((o) => ({
            id: o.id,
            etiqueta: o.etiqueta.replace("Nombre", "Cliente").replace("Actualizado (más viejo primero)", "Fecha (más vieja primero)").replace("Actualizado (más reciente primero)", "Fecha (más reciente primero)"),
          })),
          valor: orden,
          onCambio: setOrden,
          etiquetaCorta: (v) => etiquetaCortaDeOrden(v).replace("Nombre", "Cliente").replace("Actualizado", "Fecha"),
        }}
        interruptores={cantidadAnulados > 0 ? [{ id: "anulados", etiqueta: `Mostrar anulados (${cantidadAnulados})`, valor: mostrarAnulados, onCambio: setMostrarAnulados }] : []}
        agregar={{ etiqueta: "Nuevo presupuesto", texto: "Nuevo", href: "/dashboard" }}
        resultados={presupuestosFiltrados?.length ?? 0}
        contador={
          presupuestosFiltrados && !error
            ? `${presupuestosFiltrados.length}${presupuestosFiltrados.length === 1 ? " presupuesto" : " presupuestos"}${hayFiltros && presupuestos ? ` de ${presupuestos.length}` : ""}`
            : undefined
        }
        hayFiltros={hayFiltros}
        onLimpiar={() => {
          setBusqueda("");
          setMostrarAnulados(false);
          setOrden("defecto");
          setFecha("");
          router.push("/dashboard/historial");
        }}
      />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Error al cargar el historial: {error}
        </p>
      )}

      {errorAccion && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorAccion}
        </p>
      )}

      {!error && presupuestos === null && <HistorialSkeleton />}

      {presupuestosFiltrados && presupuestosFiltrados.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center">
          <p className="text-sm text-gray-500">
            {hayFiltros
              ? "Ningún presupuesto coincide con el filtro."
              : "Todavía no hay presupuestos guardados en la nube."}
          </p>
          {!hayFiltros && (
            <Link
              href="/dashboard"
              className="mt-3 inline-block text-sm font-medium text-[#244B5A] hover:underline"
            >
              Crear el primero
            </Link>
          )}
        </div>
      )}

      {presupuestosFiltrados && presupuestosFiltrados.length > 0 && (
        <>
          {/* Desktop / tablet: tabla completa */}
          <div className="hidden rounded-lg border border-gray-200 bg-[#FFFFFF] sm:block lg:rounded-none">
            {/* Anchos pensados para que el nombre del cliente no se parta en dos líneas (si es larguísimo se
                recorta con "…" y el nombre completo queda en el tooltip) y el detalle tenga lugar. */}
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[8.5rem]" />
                <col className="w-[22%]" />
                <col />
                <col className="w-[11rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[18rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-[#F1F4F6] text-[13px] uppercase tracking-wide text-[#4A5861] sm:[&>th]:sticky sm:[&>th]:top-[var(--catalogo-barra,0px)] sm:[&>th]:z-10 sm:[&>th]:bg-[#F1F4F6]">
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Detalle</th>
                  <th className="px-4 py-3 font-semibold">Creado por</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {presupuestosFiltrados.map((p) => {
                  const anulado = estaAnulado(p);
                  const esDueño = !!userId && p.created_by === userId && !anulado;
                  return (
                    <tr key={p.id} className={`border-b border-gray-100 last:border-0 ${anulado ? "bg-gray-50/70 text-gray-500" : ""}`}>
                      <td className="px-4 py-3">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-[#E3ECEF] px-2.5 py-0.5 text-xs font-semibold text-[#244B5A]">
                          {TITULOS[p.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        <div className="flex items-center gap-2">
                          <span
                            title={p.cliente_nombre}
                            className={`min-w-0 truncate font-medium ${anulado ? "line-through" : ""}`}
                          >
                            {p.cliente_nombre}
                          </span>
                          {anulado && <EtiquetaAnulado className="shrink-0" />}
                        </div>
                        {anulado && p.anulado_motivo && (
                          <p className="mt-0.5 truncate text-xs text-gray-500" title={p.anulado_motivo}>
                            Motivo: {p.anulado_motivo}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="line-clamp-2" title={resumenPresupuesto(p.tipo, p.datos)}>
                          {resumenPresupuesto(p.tipo, p.datos)}
                        </span>
                      </td>
                      <td className="truncate px-4 py-3 text-gray-600" title={nombreCreador(p.creador)}>
                        {nombreCreador(p.creador)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatFecha(p.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {anulado && (
                            <Link href={`/dashboard/${p.tipo}?id=${p.id}`} title="Ver" className={botonDe("secundario", "px-3")}>
                              Ver
                            </Link>
                          )}
                          {esDueño && (
                            <Link
                              href={`/dashboard/${p.tipo}?id=${p.id}`}
                              title="Editar"
                              aria-label="Editar"
                              className={botonDe("secundario", "w-11 px-0")}
                            >
                              <IconEdit className="h-[18px] w-[18px]" />
                            </Link>
                          )}
                          {/* Un presupuesto anulado se ve y se exporta, pero no se duplica. */}
                          {!anulado && (
                            <Link href={`/dashboard/${p.tipo}?duplicar=${p.id}`} title="Duplicar" className={botonDe("suave", "px-3")}>
                              <IconCopy className="h-4 w-4" />
                              Duplicar
                            </Link>
                          )}
                          {esDueño && (
                            <button onClick={() => setPorAnular(p)} title="Anular" className={botonDe("peligro", "px-3")}>
                              <IconTrash className="h-4 w-4" />
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: una fila compacta por presupuesto (la tabla obligaba a scroll horizontal para llegar a las acciones). */}
          <ul className="divide-y divide-[#EEF1F3] rounded-lg border border-[#D9DFE3] bg-[#FFFFFF] sm:hidden">
            {presupuestosFiltrados.map((p) => {
              const detalle = resumenPresupuesto(p.tipo, p.datos);
              const anulado = estaAnulado(p);
              const esDueño = !!userId && p.created_by === userId && !anulado;
              return (
                <li key={p.id} className={`flex items-center gap-2 px-4 py-2 ${anulado ? "bg-gray-50" : ""}`}>
                  <div className="min-w-0 flex-1 text-[15px] leading-5">
                    <p className="line-clamp-2 break-words font-medium text-gray-900">
                      <span className={anulado ? "line-through" : ""}>{p.cliente_nombre}</span>
                      {anulado && <EtiquetaAnulado className="ml-2" />}
                    </p>
                    <p className="truncate text-[13px] text-[#4A5861]">
                      {TITULOS[p.tipo]}
                      {detalle ? ` · ${detalle}` : ""}
                    </p>
                    <p className="truncate text-[13px] text-[#4A5861]">
                      {formatFecha(p.created_at)}
                      {anulado && p.anulado_motivo ? ` · Motivo: ${p.anulado_motivo}` : nombreCreador(p.creador) !== "—" ? ` · ${nombreCreador(p.creador)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {anulado && (
                      <Link href={`/dashboard/${p.tipo}?id=${p.id}`} className={botonDe("secundario", "px-3")}>
                        Ver
                      </Link>
                    )}
                    {/* Un presupuesto anulado se ve y se exporta, pero no se duplica. */}
                    {!anulado && (
                      <Link href={`/dashboard/${p.tipo}?duplicar=${p.id}`} title="Duplicar" aria-label="Duplicar" className={botonDe("suave", "w-11 px-0")}>
                        <IconCopy className="h-[18px] w-[18px]" />
                      </Link>
                    )}
                    {esDueño && (
                      <Link href={`/dashboard/${p.tipo}?id=${p.id}`} title="Editar" aria-label="Editar" className={botonDe("secundario", "w-11 px-0")}>
                        <IconEdit className="h-[18px] w-[18px]" />
                      </Link>
                    )}
                    {esDueño && (
                      <button onClick={() => setPorAnular(p)} title="Anular" aria-label="Anular" className={botonDe("peligro", "w-11 px-0")}>
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AnularDialog
        open={porAnular !== null}
        titulo="Anular presupuesto"
        mensaje={
          porAnular
            ? `Vas a anular el presupuesto de "${porAnular.cliente_nombre}". Queda en el historial (se puede ver y exportar), pero ya no se puede modificar.`
            : ""
        }
        onConfirmar={confirmarAnular}
        onCancel={() => setPorAnular(null)}
      />
    </PanelPortal>
  );
}

// Reemplaza el antiguo texto "Cargando..." — con la data llegando en dos
// pasos (presupuestos + perfiles de los creadores), un simple texto se sentía
// como un salto brusco al aparecer toda la tabla de golpe. Esto imita la
// forma real de la tabla/tarjetas para que la transición sea más prolija.
function HistorialSkeleton() {
  return (
    <div>
      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-[#FFFFFF] shadow-sm sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
              <th className="px-4 py-3 font-medium">Creado por</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((i) => (
              <tr key={i} className="animate-pulse border-b border-gray-100 last:border-0">
                <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-28 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-24 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-gray-200" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-[#FFFFFF] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-200" />
              </div>
              <div className="h-3 w-12 rounded bg-gray-200" />
            </div>
            <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
              <div className="h-9 flex-1 rounded-md bg-gray-100" />
              <div className="h-9 flex-1 rounded-md bg-gray-100" />
              <div className="h-9 w-9 rounded-md bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

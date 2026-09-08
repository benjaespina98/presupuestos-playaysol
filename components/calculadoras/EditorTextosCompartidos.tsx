"use client";

import { useState } from "react";
import type { TipoCalculadora } from "@/lib/presupuestos";
import { guardarTextosCompartidos } from "@/lib/catalogo";
import type { FooterFijo, TextosCompartidos } from "@/lib/documentos/textosCompartidos";

/**
 * Editar el texto legal y los datos del pie (empresa/dirección/contacto)
 * desde la propia calculadora — antes esto sólo se podía cambiar escribiendo
 * directo en la base de datos: `guardarTextosCompartidos` (lib/catalogo.ts)
 * y `leerTextosCompartidos` (lib/documentos/textosCompartidos.ts) ya existían
 * y ya se usaban para LEER estos textos en los 4 documentos, pero ningún
 * componente los ofrecía para ESCRIBIR — el "Guardar como predeterminado
 * para todos" que menciona el comentario de `guardarTextosCompartidos` no
 * tenía, en los hechos, ningún botón que lo dispare.
 *
 * `tipo` importa: el texto legal y el pie son POR TIPO de calculadora
 * (`catalogo_items` los guarda con clave `(tipo, "__legal" | "__footer_*")`),
 * no un valor único para las 4 — piscinas puede tener condiciones distintas
 * a cercos.
 *
 * No dispara un refetch del catálogo al guardar: como se sabe exactamente
 * qué se acaba de escribir, `onGuardado` le pasa esos mismos valores al
 * padre para que los use ya mismo (ver el `textosOverride` en cada
 * Calculadora) — evita un viaje de ida y vuelta a la base sólo para
 * releer lo que ya se tiene en memoria.
 */
export function EditorTextosCompartidos({
  tipo,
  textos,
  onGuardado,
}: {
  tipo: TipoCalculadora;
  textos: TextosCompartidos;
  onGuardado: (nuevos: TextosCompartidos) => void;
}) {
  const [legal, setLegal] = useState(textos.legal);
  const [footer, setFooter] = useState<FooterFijo>(textos.footer);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  function cambiarFooter(campo: keyof FooterFijo, valor: string) {
    setFooter((f) => ({ ...f, [campo]: valor }));
    setGuardadoOk(false);
  }

  async function onGuardar() {
    setGuardando(true);
    setError(null);
    try {
      const entradas = [
        { clave: "__legal", descripcion: legal },
        ...(Object.keys(footer) as (keyof FooterFijo)[]).map((campo) => ({
          clave: `__footer_${campo}`,
          descripcion: footer[campo],
        })),
      ];
      const { error } = await guardarTextosCompartidos(tipo, entradas);
      if (error) throw error;
      onGuardado({ legal, footer });
      setGuardadoOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-900">
        Texto legal y pie del presupuesto <span className="font-normal text-gray-500">— vale para los próximos, no cambia los ya generados</span>
      </summary>
      <div className="space-y-4 border-t border-gray-100 p-5">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo guardar: {error}</p>
        )}
        {guardadoOk && !error && (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Guardado — los presupuestos nuevos de este tipo van a usar estos textos.
          </p>
        )}

        <div>
          <label htmlFor="editor-textos-legal" className="mb-1 block text-xs text-gray-500">
            Texto legal / condiciones
          </label>
          <textarea
            id="editor-textos-legal"
            value={legal}
            onChange={(e) => {
              setLegal(e.target.value);
              setGuardadoOk(false);
            }}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoFooter id="empresa" label="Empresa" valor={footer.empresa} onChange={cambiarFooter} />
          <CampoFooter id="direccion" label="Dirección" valor={footer.direccion} onChange={cambiarFooter} />
          <CampoFooter id="telFijo" label="Teléfono fijo" valor={footer.telFijo} onChange={cambiarFooter} />
          <CampoFooter id="contactoNombre" label="Nombre de contacto" valor={footer.contactoNombre} onChange={cambiarFooter} />
          <CampoFooter id="contactoCel" label="Celular de contacto" valor={footer.contactoCel} onChange={cambiarFooter} />
          <CampoFooter id="whatsapp" label="WhatsApp" valor={footer.whatsapp} onChange={cambiarFooter} />
          <CampoFooter id="email" label="E-mail" valor={footer.email} onChange={cambiarFooter} />
          <CampoFooter id="web" label="Web" valor={footer.web} onChange={cambiarFooter} />
          <CampoFooter id="facebook" label="Facebook (texto)" valor={footer.facebook} onChange={cambiarFooter} />
          <CampoFooter id="facebookUrl" label="Facebook (link)" valor={footer.facebookUrl} onChange={cambiarFooter} />
          <CampoFooter id="instagram" label="Instagram (texto)" valor={footer.instagram} onChange={cambiarFooter} />
          <CampoFooter id="instagramUrl" label="Instagram (link)" valor={footer.instagramUrl} onChange={cambiarFooter} />
        </div>

        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando}
          className="min-h-11 w-full rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar como predeterminado para todos"}
        </button>
      </div>
    </details>
  );
}

function CampoFooter({
  id,
  label,
  valor,
  onChange,
}: {
  id: keyof FooterFijo;
  label: string;
  valor: string;
  onChange: (campo: keyof FooterFijo, valor: string) => void;
}) {
  return (
    <div>
      <label htmlFor={`editor-textos-${id}`} className="mb-1 block text-xs text-gray-500">
        {label}
      </label>
      <input
        id={`editor-textos-${id}`}
        type="text"
        value={valor}
        onChange={(e) => onChange(id, e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

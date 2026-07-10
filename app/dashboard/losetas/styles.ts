export const CALCULATOR_STYLES = `
.pys-calc * { box-sizing: border-box; }
.pys-calc {
  font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  background: #f2f1ec;
  margin: 0;
  padding: clamp(12px, 2vw, 24px);
  color: #222;
  /* .btns-wrap es fixed al fondo del viewport (ver más abajo) -- sin este espacio
     reservado, el último field-section de la página queda tapado por la barra sin
     forma de revelarlo con scroll normal (mismo bug que se corrigió en mobile para
     piscinas/cercos/cobertores/revestimientos). --action-bar-h la fija el JS
     (ResizeObserver sobre .btns-wrap, altura real, ver script.ts). */
  padding-bottom: calc(24px + var(--action-bar-h, 0px));
}
.pys-calc .wrap {
  max-width: 1100px;
  margin: 0 auto;
  background: #fff;
  border-radius: 14px;
  padding: clamp(18px, 2.5vw, 32px);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.pys-calc h1 { font-size: 22px; margin: 0 0 4px; color: #1B3A5C; }
.pys-calc .subtitle { font-size: 14px; color: #666; margin-bottom: 28px; }
.pys-calc .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.pys-calc .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.pys-calc .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.pys-calc label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.pys-calc input, .pys-calc select { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; background: #fff; }
.pys-calc input:focus, .pys-calc select:focus { outline: 2px solid #1B3A5C; border-color: #1B3A5C; }
.pys-calc h3 { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 16px; padding-bottom: 10px; color: #1B3A5C; border-bottom: 1px solid #EDEAE0; }
.pys-calc .section-hint { font-size: 11px; font-weight: 400; letter-spacing: normal; text-transform: none; color: #999; }
/* Cada bloque de campos relacionados vive en su propia "ficha" — mismo lenguaje visual
   (borde suave, radio, encabezado navy en mayúsculas) que las cards del documento
   exportado, para que el formulario se sienta tan prolijo como el resultado. */
.pys-calc .field-section {
  background: #fff;
  border: 1px solid #EDEAE0;
  border-radius: 10px;
  padding: 20px 22px 22px;
  margin-bottom: 16px;
}
.pys-calc .field-section-muted { background: #FAFAF7; }
.pys-calc .plano-container { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 24px; margin: 8px 0 16px; overflow: visible; }
.pys-calc .brand { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.pys-calc .brand span { font-size: 12px; color: #999; }
.pys-calc .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.pys-calc .card { background: #F5F3EC; border: 1px solid #EAE6DA; border-radius: 10px; padding: 16px 18px; }
.pys-calc .card .label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #8A8371; }
.pys-calc .card .value { font-size: 23px; font-weight: 700; color: #1B3A5C; margin-top: 4px;}
.pys-calc .card.accent .value { color: #C0522D; }
.pys-calc .checkrow { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.pys-calc .checkrow input[type="checkbox"] { width: auto; }
.pys-calc .checkrow label { margin-bottom: 0; font-size: 13px; color: #333; }
.pys-calc .subfield { margin-top: 8px; }
/* Botones agrupados por función (Exportar vs. Presupuesto) en vez de 6 acciones
   sueltas en una sola fila — cada grupo con su etiqueta chica arriba. Fija al fondo
   del viewport (mismo tratamiento visual que .action-bar de las otras 4 calculadoras:
   fondo blanco, borde superior sutil, sombra hacia arriba) en vez de quedar en flujo
   normal al final de una página larga — losetas es de una sola columna sin panel
   dividido, así que "fixed" (no "sticky") es lo que la mantiene siempre visible sin
   necesidad de scrollear hasta el final. El padding-bottom que la compensa (para que
   no tape el último field-section) se calcula en JS con su altura real — ver
   ajustarEspacioBarraAcciones() en script.ts. */
.pys-calc .btns-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin: 0 auto;
  max-width: 1100px;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  background: #fff;
  border-top: 1px solid #EDEAE0;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
  padding: 14px 32px;
}
.pys-calc .btns-group { flex: 1 1 260px; min-width: 240px; }
/* El disparador del bottom sheet y su overlay solo existen en mobile (ver @media
   600px); en desktop las acciones se muestran inline en la barra fija de arriba. */
.pys-calc .losetas-sheet-trigger { display: none; }
.pys-calc .losetas-sheet-overlay { display: none; }
.pys-calc .btns-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8A8371; margin: 0 0 10px; }
.pys-calc .btns-group .helptext { margin-top: 10px; }
.pys-calc .btns { display: flex; gap: 10px; flex-wrap: wrap; }
.pys-calc button { background: #1B3A5C; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; transition: background 150ms ease, transform 150ms ease; }
.pys-calc button:hover { background: #14304c; }
.pys-calc button:active { transform: scale(.97); }
.pys-calc button.secondary { background: #fff; color: #1B3A5C; border: 1px solid #1B3A5C; }
.pys-calc button.secondary:hover { background: #f2f6fa; }
.pys-calc button.client { background: #C0522D; }
.pys-calc button.client:hover { background: #a3441f; }
.pys-calc button.danger-ghost { background: #fff; color: #a3441f; border: 1px solid #e2c4b8; padding: 6px 12px; font-size: 13px; }
.pys-calc button.danger-ghost:hover { background: #fbf0ec; }
/* Jerarquía de acciones dentro de .btns: 2 primarias sólidas (base + .client, ya
   cubiertas arriba) y el resto con el mismo tratamiento secundario (borde navy,
   mismo hover) sin importar si el elemento es <button> o <a> — antes ".secondary"
   solo estaba definido para "button.secondary", así que el <a> de Historial no
   tomaba ningún estilo y quedaba como texto plano suelto. */
.pys-calc .btns > a,
.pys-calc .btns > a.secondary {
  background: #fff;
  color: #1B3A5C;
  border: 1px solid #1B3A5C;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.pys-calc .btns > a:hover,
.pys-calc .btns > a.secondary:hover {
  background: #f2f6fa;
}
.pys-calc button.add-material { background: #fff; color: #1B3A5C; border: 1px dashed #1B3A5C; padding: 8px 14px; font-size: 13px; width: 100%; margin-top: 6px; }
.pys-calc button.add-material:hover { background: #f2f6fa; }
.pys-calc button:disabled { opacity: 0.6; cursor: not-allowed; }
.pys-calc .helptext { font-size: 12px; color: #999; margin-top: 6px; }
.pys-calc .material-row { display: grid; grid-template-columns: 1fr 140px auto; gap: 10px; align-items: center; margin-bottom: 8px; }
.pys-calc .material-cost-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 14px; }

/* Vista limpia (plano + medidas, sin precios) — mismo lenguaje visual "documento de
   estudio" que el resto de las calculadoras: acento navy arriba, tipografía con
   jerarquía clara, espaciado generoso, sin las líneas punteadas de planilla. */
.pys-calc #client-capture {
  position: fixed;
  top: -99999px;
  left: -99999px;
  width: 1100px;
  background: #fff;
  border-top: 5px solid #1B3A5C;
  padding: 48px;
  font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
.pys-calc #client-capture .chdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  padding-bottom: 18px;
  border-bottom: 1px solid #E1E7EC;
}
.pys-calc #client-capture .chdr img { height: 56px; }
.pys-calc #client-capture .chdr .ctitle { font-size: 21px; color: #1B3A5C; font-weight: 700; letter-spacing: .01em; }
.pys-calc #client-capture .chdr .csub { font-size: 13px; color: #6B7680; margin-top: 3px; }
.pys-calc #client-capture .cplano {
  border: 1px solid #E1E7EC;
  border-left: 3px solid #1B3A5C;
  border-radius: 8px;
  padding: 28px;
  background: #FAFBFC;
}
.pys-calc #client-capture .cfooter {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid #E1E7EC;
  font-size: 11px;
  color: #1B3A5C;
  text-align: left;
}

/* ---------- MOBILE (<600px) ---------- */
@media (max-width: 600px) {
  /* padding-bottom fijo = alto de la barra disparadora fija de abajo, para que el
     último field-section no quede tapado (en mobile la barra visible es el trigger,
     no la .btns-wrap, que acá es la hoja off-screen). */
  .pys-calc { padding: 10px 10px 76px; }
  .pys-calc .wrap { padding: 14px; border-radius: 10px; }
  .pys-calc .field-section { padding: 14px 14px 16px; }
  /* El plano tiene un viewBox fijo (680x420): con width:100% se achica
     proporcionalmente hasta volver ilegibles las medidas dibujadas adentro.
     En vez de forzarlo a entrar achicado, acá se mantiene a su tamaño real
     (legible) y el contenedor scrollea horizontalmente — el usuario recorre
     el plano con scroll/pellizco nativo en vez de entrecerrar los ojos. */
  .pys-calc .plano-container { padding: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .pys-calc .plano-container svg { width: 680px; max-width: none; }
  /* .row (2 campos) se mantiene en 2 columnas balanceadas; row3/row4 (3 y 4
     campos) pasan directo a 1 columna acá — antes recién colapsaban por
     debajo de 420px, y entre 420-600px (el rango de la mayoría de los
     celulares) quedaban en 2 columnas con un campo suelto solo en la
     última fila, desprolijo. */
  .pys-calc .row { grid-template-columns: 1fr 1fr; gap: 10px; }
  .pys-calc .row3, .pys-calc .row4 { grid-template-columns: 1fr; gap: 10px; }
  .pys-calc .cards { grid-template-columns: 1fr; }
  .pys-calc .material-row { grid-template-columns: 1fr 80px auto; gap: 6px; }
  /* font-size 16px evita que iOS Safari haga zoom automático al enfocar el campo */
  .pys-calc input, .pys-calc select { font-size: 16px; }
  /* --- Barra de acciones como BOTTOM SHEET en mobile ---
     Mismo patrón que las otras 4 calculadoras. La barra fija de escritorio no cabe
     con 6 botones en el ancho de un celular; acá se reemplaza por un disparador
     "Acciones ▾" fijo al fondo y una hoja inferior con todas las acciones como
     filas de ícono + TEXTO COMPLETO legible, agrupadas (Exportar / Presupuesto).
     No se toca la lógica de ningún botón: son los mismos <button>/<a>. */
  .pys-calc .losetas-sheet-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 30;
    width: 100%;
    background: #1B3A5C;
    color: #fff;
    border: none;
    padding: 15px 16px calc(15px + env(safe-area-inset-bottom, 0px));
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }
  .pys-calc .btns-wrap {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    top: auto;
    max-width: none;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 4px;
    margin: 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    box-shadow: 0 -6px 28px rgba(27,58,92,.22);
    transform: translateY(115%);
    transition: transform .28s cubic-bezier(.4,0,.2,1);
    z-index: 50;
  }
  .pys-calc .btns-wrap::before {
    content: '';
    display: block;
    width: 40px; height: 4px;
    background: #D8DEE3;
    border-radius: 3px;
    margin: 2px auto 6px;
  }
  .pys-calc.sheet-open .btns-wrap { transform: translateY(0); }
  .pys-calc .btns-group { flex: none; min-width: 0; }
  .pys-calc .btns-label { display: block; margin: 8px 0 2px; }
  .pys-calc .btns-group .helptext { display: none; }
  /* ...menos el estado de guardado en la nube, que sí debe verse dentro de la hoja
     (por eso "Guardar en la nube" no la cierra — ver initActionSheet en script.ts). */
  .pys-calc #cloudMsg { display: block; margin-top: 6px; }
  .pys-calc .btns { flex-direction: column; flex-wrap: nowrap; gap: 6px; }
  .pys-calc .btns > button, .pys-calc .btns > a {
    width: 100%;
    justify-content: flex-start;
    min-height: 50px;
    font-size: 15px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pys-calc .losetas-sheet-overlay {
    display: block;
    position: fixed; inset: 0;
    background: rgba(20,30,40,.42);
    opacity: 0; pointer-events: none;
    transition: opacity .28s ease;
    z-index: 40;
  }
  .pys-calc.sheet-open .losetas-sheet-overlay { opacity: 1; pointer-events: auto; }
  .pys-calc button.add-material { width: 100%; }
}

/* ---------- IMPRESIÓN / PDF ---------- */
/* Mismo patrón que las otras 4 calculadoras: ocultar el form editable, mostrar solo
   una "hoja" limpia. Acá reusamos #client-capture (la misma vista que ya arma
   "Descargar para cliente" — plano + medidas, sin precios) en vez de crear un tercer
   contenedor: imprimirVistaLimpia() la puebla antes de llamar a window.print(). */
/* Márgenes de página consistentes entre navegadores/dispositivos -- sin esto, el
   margen que agrega el diálogo de impresión por default puede variar bastante entre
   Chrome desktop y Safari mobile, además de sumarse al padding de acá abajo. */
@page{ margin: 14mm; }

@media print {
  html, body { width: auto !important; }
  .pys-calc { background: #fff; padding: 0; width: auto !important; }
  .pys-calc .wrap { display: none !important; }
  .pys-calc #client-capture {
    position: static !important;
    top: auto !important;
    left: auto !important;
    width: 100% !important;
    max-width: 100%;
    padding: 24px !important;
  }
}
`;

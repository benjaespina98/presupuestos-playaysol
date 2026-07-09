export const CALCULATOR_STYLES = `
.pys-calc * { box-sizing: border-box; }
.pys-calc {
  font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  background: #f2f1ec;
  margin: 0;
  padding: 24px;
  color: #222;
}
.pys-calc .wrap {
  max-width: 940px;
  margin: 0 auto;
  background: #fff;
  border-radius: 14px;
  padding: 32px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.pys-calc h1 { font-size: 22px; margin: 0 0 4px; color: #1B3A5C; }
.pys-calc .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
.pys-calc .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.pys-calc .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.pys-calc label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.pys-calc input, .pys-calc select { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; background: #fff; }
.pys-calc input:focus, .pys-calc select:focus { outline: 2px solid #1B3A5C; border-color: #1B3A5C; }
.pys-calc h3 { font-size: 14px; font-weight: 600; margin: 24px 0 10px; color: #1B3A5C; }
.pys-calc .plano-container { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 24px; margin: 20px 0; overflow: visible; }
.pys-calc .brand { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.pys-calc .brand span { font-size: 12px; color: #999; }
.pys-calc .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.pys-calc .card { background: #F5F3EC; border: 1px solid #EAE6DA; border-radius: 10px; padding: 16px 18px; }
.pys-calc .card .label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #8A8371; }
.pys-calc .card .value { font-size: 23px; font-weight: 700; color: #1B3A5C; margin-top: 4px;}
.pys-calc .card.accent .value { color: #C0522D; }
.pys-calc .precio-section { border-top: 1px solid #eee; padding-top: 18px; margin-top: 8px; }
.pys-calc .checkrow { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.pys-calc .checkrow input[type="checkbox"] { width: auto; }
.pys-calc .checkrow label { margin-bottom: 0; font-size: 13px; color: #333; }
.pys-calc .subfield { margin-top: 8px; }
.pys-calc .btns { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
.pys-calc button { background: #1B3A5C; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
.pys-calc button:hover { background: #14304c; }
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
  color: #99A3AC;
  text-align: center;
}

/* ---------- MOBILE (<600px) ---------- */
@media (max-width: 600px) {
  .pys-calc { padding: 10px; }
  .pys-calc .wrap { padding: 14px; border-radius: 10px; }
  .pys-calc .plano-container { padding: 10px; }
  .pys-calc .row, .pys-calc .row4 { grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .pys-calc .cards { grid-template-columns: 1fr; }
  .pys-calc .material-row { grid-template-columns: 1fr 80px auto; gap: 6px; }
  /* font-size 16px evita que iOS Safari haga zoom automático al enfocar el campo */
  .pys-calc input, .pys-calc select { font-size: 16px; }
  .pys-calc .btns { flex-direction: column; }
  .pys-calc button { width: 100%; min-height: 44px; padding: 12px 18px; }
  .pys-calc button.add-material { width: 100%; }
}

@media (max-width: 420px) {
  .pys-calc .row, .pys-calc .row4 { grid-template-columns: 1fr; }
}

/* ---------- IMPRESIÓN / PDF ---------- */
/* Mismo patrón que las otras 4 calculadoras: ocultar el form editable, mostrar solo
   una "hoja" limpia. Acá reusamos #client-capture (la misma vista que ya arma
   "Descargar para cliente" — plano + medidas, sin precios) en vez de crear un tercer
   contenedor: imprimirVistaLimpia() la puebla antes de llamar a window.print(). */
@media print {
  .pys-calc { background: #fff; padding: 0; }
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

export const CALCULATOR_STYLES = `
/* ===========================================================================
   PLANO DE PISCINA (losetas)

   Layout de dos columnas, igual que las otras 4 calculadoras: los campos a la
   izquierda y el RESULTADO (plano + m²) fijo a la derecha. Antes era una sola
   columna larguísima con el plano enterrado abajo de siete secciones de campos,
   así que había que scrollear para ver qué efecto tenía cada medida cargada.

   La paleta es la del portal (navy #1B3A5C sobre neutro frío), no el beige que
   tenía antes: es la misma calculadora dentro de la misma app, no debería
   sentirse como otro producto.
   =========================================================================== */
.pys-calc {
  --navy: #1B3A5C;
  --navy-soft: #EEF2F6;
  --linea: #D7E3E7;
  --texto: #1C2B33;
  --gris: #6B7680;
  --acento: #C0522D;
  font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  background: #F4F8F9;
  margin: 0;
  padding: clamp(12px, 2vw, 24px);
  color: var(--texto);
}
.pys-calc * { box-sizing: border-box; }

.pys-calc .wrap {
  max-width: 1500px;
  margin: 0 auto;
}

/* ---------- Encabezado ---------- */
.pys-calc .brand { margin: 0 0 18px; }
.pys-calc h1 { font-size: 20px; margin: 0 0 2px; color: var(--navy); }
.pys-calc .subtitle { font-size: 13.5px; color: var(--gris); margin: 0; }

/* ---------- Layout ---------- */
.pys-calc .lay { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 1000px) {
  .pys-calc .lay { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 24px; align-items: start; }
  /* El resultado acompaña al usuario mientras carga las medidas. */
  .pys-calc .out-sticky { position: sticky; top: 16px; }
}

/* ---------- Fichas de campos ---------- */
.pys-calc .field-section {
  background: #fff;
  border: 1px solid var(--linea);
  border-radius: 10px;
  padding: 18px 20px 20px;
  margin-bottom: 14px;
}
.pys-calc .field-section-muted { background: #FAFBFC; }
.pys-calc h3 {
  font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  margin: 0 0 14px; padding-bottom: 9px; color: var(--navy);
  border-bottom: 1px solid var(--linea);
}
.pys-calc .section-hint {
  font-size: 11px; font-weight: 400; letter-spacing: normal; text-transform: none; color: var(--gris);
}

/* Sección plegable (apariencia del plano): mismo aspecto que una ficha, pero
   cerrada por defecto — es cosmética, no debería competir con las medidas. */
.pys-calc .field-section-fold { padding: 0; }
.pys-calc .field-section-fold > summary {
  list-style: none; cursor: pointer; padding: 14px 20px;
  font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--navy); display: flex; align-items: center; gap: 8px;
}
.pys-calc .field-section-fold > summary::-webkit-details-marker { display: none; }
.pys-calc .field-section-fold > summary::after {
  content: '▾'; margin-left: auto; font-size: 12px; transition: transform 180ms ease;
}
.pys-calc .field-section-fold[open] > summary::after { transform: rotate(180deg); }
.pys-calc .field-section-fold[open] > summary { border-bottom: 1px solid var(--linea); }
.pys-calc .fold-body { padding: 16px 20px 20px; }

/* ---------- Campos ----------
   Una sola clase .row que se acomoda sola: sirve igual para 2 campos que para
   los 4 de "ancho por lado". Antes había .row / .row3 / .row4 con reglas
   distintas por breakpoint, y entre 420 y 600px quedaba un campo suelto en la
   última fila. */
.pys-calc .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 12px; }
.pys-calc label { display: block; font-size: 11.5px; color: var(--gris); margin-bottom: 4px; }
.pys-calc input, .pys-calc select {
  width: 100%; padding: 9px 10px; border: 1px solid var(--linea); border-radius: 7px;
  font-size: 14px; background: #fff; color: var(--texto); font-family: inherit;
}
.pys-calc input:focus, .pys-calc select:focus {
  outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft);
}
.pys-calc input[type="color"] { height: 40px; padding: 4px; cursor: pointer; }
.pys-calc .subfield { margin-top: 12px; }
.pys-calc .helptext { font-size: 11.5px; color: var(--gris); margin: 6px 0 0; line-height: 1.45; }
.pys-calc .helptext-lead { margin: -6px 0 12px; }
.pys-calc .helptext b { color: var(--texto); }

/* Casilleros con su sub-campo (solar húmedo, escalera, luces): tres bloques
   parejos en vez de repartidos entre tres secciones distintas. */
.pys-calc .opciones {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--linea);
}
.pys-calc .opcion { min-width: 0; }
.pys-calc .checkrow { display: flex; align-items: center; gap: 9px; }
.pys-calc .checkrow input[type="checkbox"] { width: 18px; height: 18px; margin: 0; accent-color: var(--navy); cursor: pointer; }
.pys-calc .checkrow label { margin-bottom: 0; font-size: 13.5px; color: var(--texto); cursor: pointer; }

/* ---------- Columna de resultado ---------- */
.pys-calc .plano-container {
  background: #fff; border: 1px solid var(--linea); border-radius: 10px;
  padding: 18px; margin-bottom: 14px;
}
/* Área de agarre de cada luz en el plano: se arrastra para reubicarla.
   touch-action:none evita que el navegador lo interprete como scroll/zoom. */
.pys-calc #svg .luz-drag { cursor: grab; touch-action: none; }
.pys-calc #svg .luz-drag:active { cursor: grabbing; }

.pys-calc .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.pys-calc .card {
  background: #fff; border: 1px solid var(--linea); border-radius: 10px; padding: 14px 16px;
}
.pys-calc .card .label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--gris); }
.pys-calc .card .value { font-size: 24px; font-weight: 700; color: var(--navy); margin-top: 4px; }
/* El m² extra es el número que se cotiza: es el que hay que mirar. */
.pys-calc .card.accent { border-color: var(--acento); background: #FDF6F3; }
.pys-calc .card.accent .value { color: var(--acento); }

/* ---------- Acciones ---------- */
.pys-calc .btns-wrap {
  background: #fff; border: 1px solid var(--linea); border-radius: 10px; padding: 16px 18px;
}
.pys-calc .btns { display: flex; gap: 10px; flex-wrap: wrap; }
.pys-calc .btns-menores { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--linea); }
.pys-calc button, .pys-calc .btns > a {
  flex: 1 1 auto; text-align: center; justify-content: center;
  background: var(--navy); color: #fff; border: 1px solid var(--navy);
  padding: 11px 16px; border-radius: 8px; font-size: 14px; font-family: inherit;
  cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
  transition: background 150ms ease, transform 150ms ease;
}
.pys-calc button:active, .pys-calc .btns > a:active { transform: scale(.98); }
.pys-calc button.client { background: var(--acento); border-color: var(--acento); }
.pys-calc button.client:hover { background: #a3441f; }
.pys-calc button.secondary, .pys-calc .btns > a.secondary {
  background: #fff; color: var(--navy);
}
.pys-calc button.secondary:hover, .pys-calc .btns > a.secondary:hover { background: var(--navy-soft); }
.pys-calc button.ghost {
  background: none; border-color: transparent; color: var(--gris); font-size: 13px;
}
.pys-calc button.ghost:hover { background: var(--navy-soft); color: var(--navy); }
.pys-calc button:disabled { opacity: .55; cursor: not-allowed; }
.pys-calc #cloudMsg:empty { display: none; }

/* ---------- Materiales (uso interno) ---------- */
.pys-calc .material-row { display: grid; grid-template-columns: 1fr 120px auto; gap: 10px; align-items: center; margin-bottom: 8px; }
/* Encabezado de columnas: una vez cargado el precio el placeholder desaparece,
   y sin esto no queda claro qué representa cada columna. */
.pys-calc .material-header {
  display: grid; grid-template-columns: 1fr 120px auto; gap: 10px; margin-bottom: 6px;
  font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--gris);
}
.pys-calc .material-header span:last-child { visibility: hidden; }
.pys-calc button.add-material {
  background: #fff; color: var(--navy); border: 1px dashed var(--navy);
  padding: 9px 14px; font-size: 13px; width: 100%; margin-top: 6px;
}
.pys-calc button.add-material:hover { background: var(--navy-soft); }
.pys-calc button.danger-ghost {
  flex: 0 0 auto; background: #fff; color: #a3441f; border: 1px solid #e2c4b8;
  padding: 7px 12px; font-size: 13px;
}
.pys-calc button.danger-ghost:hover { background: #fbf0ec; }
.pys-calc .material-cost-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 14px; }
.pys-calc .material-cost-grid .card { background: #F4F8F9; }
.pys-calc .material-cost-grid .value { font-size: 18px; }

/* ---------- Imagen para el cliente (fuera de pantalla, la captura html2canvas) ---------- */
.pys-calc #client-capture {
  position: fixed; top: -99999px; left: -99999px; width: 1100px;
  background: #fff; border-top: 5px solid var(--navy); padding: 48px;
  font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}
.pys-calc #client-capture .chdr {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid #E1E7EC;
}
.pys-calc #client-capture .chdr img { height: 56px; }
.pys-calc #client-capture .chdr .ctitle { font-size: 21px; color: var(--navy); font-weight: 700; letter-spacing: .01em; }
.pys-calc #client-capture .chdr .csub { font-size: 13px; color: var(--gris); margin-top: 3px; }
.pys-calc #client-capture .cplano {
  border: 1px solid #E1E7EC; border-left: 3px solid var(--navy);
  border-radius: 8px; padding: 28px; background: #FAFBFC;
}
.pys-calc #client-capture .cfooter {
  margin-top: 24px; padding-top: 14px; border-top: 1px solid #E1E7EC;
  font-size: 11px; color: var(--navy);
}

/* font-size 16px hasta 900px: con menos, iOS hace zoom al enfocar el campo.
   Mismo criterio que las otras 4 calculadoras. */
@media (max-width: 900px) {
  .pys-calc input, .pys-calc select, .pys-calc textarea { font-size: 16px; }
}

@media (max-width: 600px) {
  .pys-calc { padding: 10px 10px 24px; }
  .pys-calc .field-section { padding: 14px 14px 16px; }
  .pys-calc .fold-body { padding: 14px; }
  .pys-calc .field-section-fold > summary { padding: 12px 14px; }
  /* El plano tiene un viewBox fijo (680x420): con width:100% se achica
     proporcionalmente hasta volver ilegibles las medidas dibujadas adentro.
     Se mantiene a tamaño real y el contenedor scrollea en horizontal — el
     usuario lo recorre con scroll/pellizco nativo en vez de entrecerrar los ojos. */
  .pys-calc .plano-container { padding: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .pys-calc .plano-container svg { width: 680px; max-width: none; }
  .pys-calc .cards { grid-template-columns: 1fr; }
  .pys-calc .material-row, .pys-calc .material-header { grid-template-columns: 1fr 88px auto; gap: 6px; }
  /* Acciones a ancho completo: 44px+ de área de toque y sin texto cortado. */
  .pys-calc .btns { flex-direction: column; flex-wrap: nowrap; gap: 8px; }
  .pys-calc .btns > button, .pys-calc .btns > a { width: 100%; min-height: 48px; font-size: 15px; }
  .pys-calc button.danger-ghost { min-height: 0; }
}
`;

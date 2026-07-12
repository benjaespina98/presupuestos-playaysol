export const CALCULATOR_SCRIPT = `
// Envuelto en IIFE para que las declaraciones top-level (let materials, funciones)
// NO queden en el scope global: al navegar entre calculadoras (SPA, sin recargar) el
// realm es el mismo, y un segundo script que redeclare un let/const en el scope global
// tira "Identifier already declared" y muere entero. Las funciones que usan los
// handlers inline del markup (onclick/oninput/onblur) y las que llama React se exponen
// explícitamente en window al final.
(function(){
function fmt(n){ return new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(n); }
function money(n){ return new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n); }

let materials = [
  { name: 'Loseta com\\u00fan', price: 0 },
  { name: 'Decks', price: 0 }
];

function renderMaterials(){
  const c = document.getElementById('materialsContainer');
  c.innerHTML = materials.map((m, i) => \`
    <div class="material-row">
      <input type="text" value="\${m.name.replace(/"/g,'&quot;')}" placeholder="Nombre del material" oninput="updateMaterial(\${i}, 'name', this.value)">
      <input type="number" value="\${m.price}" min="0" placeholder="$/m\\u00b2" data-valor-inicial="\${m.price}" oninput="updateMaterial(\${i}, 'price', this.value)" onblur="confirmarPrecioMaterial(\${i}, this)">
      <button type="button" class="danger-ghost" onclick="removeMaterial(\${i})" \${materials.length <= 1 ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''}>Quitar</button>
    </div>
  \`).join('');
}

function updateMaterial(i, field, value){
  if(field === 'price'){ materials[i].price = parseFloat(value) || 0; }
  else { materials[i].name = value; }
  calc();
}

// Losetas no tenía ningún tipo de persistencia de catálogo antes (ni local): "Cancelar"
// acá es exactamente el comportamiento de siempre (el precio queda solo en este
// presupuesto). Por eso una sola pregunta alcanza, a diferencia de las otras 4
// calculadoras donde ya existe un valor previo persistido que se está sobrescribiendo.
// La clave es el nombre del material (no hay slug/id estable como en las otras 4).
async function confirmarPrecioMaterial(i, inputEl){
  const valorInicial = inputEl.dataset.valorInicial ?? '';
  const valorNuevo = inputEl.value;
  inputEl.dataset.valorInicial = valorNuevo;
  if(valorNuevo === valorInicial) return;
  if(!window.actualizarCatalogoItem || !window.mostrarModalCatalogo) return;
  const nombre = (materials[i].name || '').trim();
  if(!nombre) return; // sin nombre no hay clave estable para guardarlo en el catálogo
  const resultado = await window.mostrarModalCatalogo({
    titulo: 'Guardar precio de catálogo',
    mensaje: '¿Guardar $' + materials[i].price + ' como precio permanente de "' + nombre + '"?',
    botonPrimario: {
      texto: 'Guardar como precio permanente',
      aclaracion: 'Este precio va a verse en todos los presupuestos nuevos de losetas a partir de ahora'
    },
    botonSecundario: null
  });
  if(resultado !== 'primario') return;
  const { error } = await window.actualizarCatalogoItem(nombre, materials[i].price);
  if(error) console.error('No se pudo actualizar el catálogo compartido', error);
}

function addMaterial(){
  materials.push({ name: '', price: 0 });
  renderMaterials();
  calc();
}

function removeMaterial(i){
  if(materials.length <= 1) return;
  materials.splice(i, 1);
  renderMaterials();
  calc();
}

function renderMaterialCostCards(extra){
  const c = document.getElementById('materialCostCards');
  c.innerHTML = materials.map(m => \`
    <div class="card">
      <div class="label">Costo extra \\u2014 \${m.name || 'Sin nombre'}</div>
      <div class="value">$\${money(extra * m.price)}</div>
    </div>
  \`).join('');
}

function toggleSubfield(id, show){
  document.getElementById(id).style.display = show ? 'block' : 'none';
  calc();
}

function getState(){
  return {
    largo: parseFloat(document.getElementById('largo').value)||0,
    ancho: parseFloat(document.getElementById('ancho').value)||0,
    inc: parseFloat(document.getElementById('incluido').value)||0,
    solar: parseFloat(document.getElementById('solar').value)||0,
    opuesto: parseFloat(document.getElementById('opuesto').value)||0,
    lateral1: parseFloat(document.getElementById('lateral1').value)||0,
    lateral2: parseFloat(document.getElementById('lateral2').value)||0,
    solarHumedo: document.getElementById('chkSolarHumedo').checked,
    solarHumedoAncho: parseFloat(document.getElementById('solarHumedoAncho').value)||0,
    escalera: document.getElementById('chkEscalera').checked,
    escaleraPos: document.getElementById('escaleraPos').value,
    tipoPileta: document.getElementById('tipoPileta').value,
    labios: parseFloat(document.getElementById('labios').value)||0,
    luces: document.getElementById('chkLuces').checked,
    cantLuces: parseInt(document.getElementById('cantLuces').value)||0,
    revestimiento: document.getElementById('revestimiento').value,
    revestimientoOtro: document.getElementById('revestimientoOtro').value.trim(),
    nombre: document.getElementById('nombre').value.trim()
  };
}

function calc(){
  const s = getState();
  const areaInc = (s.largo + 2*s.inc) * (s.ancho + 2*s.inc);
  const areaFinal = (s.largo + s.solar + s.opuesto) * (s.ancho + s.lateral1 + s.lateral2);
  const extra = Math.max(0, areaFinal - areaInc);

  document.getElementById('m2inc').textContent = fmt(areaInc) + ' m\\u00b2';
  document.getElementById('m2extra').textContent = fmt(extra) + ' m\\u00b2';

  renderMaterialCostCards(extra);
  drawSvg('svg', 680, 420, s, false);
}

function drawSvg(svgId, viewW, viewHmax, s, showDims){
  const padTop = showDims ? 90 : 46;
  const padSide = showDims ? 130 : 90;
  const padBottom = showDims ? 110 : 60;
  const maxW = viewW - padSide*2;
  const maxH = viewHmax - padTop - padBottom;
  const totalW = s.largo + s.solar + s.opuesto;
  const totalH = s.ancho + s.lateral1 + s.lateral2;
  const pxPerM = Math.max(1, Math.min(maxW/Math.max(totalW,0.01), maxH/Math.max(totalH,0.01)));
  const ox = padSide, oy = padTop;

  const poolX = ox + s.solar*pxPerM;
  const poolY = oy + s.lateral1*pxPerM;
  const poolW = s.largo*pxPerM;
  const poolH = s.ancho*pxPerM;

  const svg = document.getElementById(svgId);

  let extras = '';
  let dims = '';
  let grid = '';

  if(showDims){
    for(let gx = 0; gx <= totalW + 0.001; gx++){
      const x = ox + gx*pxPerM;
      grid += \`<line x1="\${x}" y1="\${oy}" x2="\${x}" y2="\${oy+totalH*pxPerM}" stroke="#000" stroke-width="0.4" opacity="0.07"/>\`;
    }
    for(let gy = 0; gy <= totalH + 0.001; gy++){
      const y = oy + gy*pxPerM;
      grid += \`<line x1="\${ox}" y1="\${y}" x2="\${ox+totalW*pxPerM}" y2="\${y}" stroke="#000" stroke-width="0.4" opacity="0.07"/>\`;
    }
  }

  if(s.solarHumedo && s.solarHumedoAncho > 0){
    const shW = Math.min(s.solarHumedoAncho, s.largo) * pxPerM;
    extras += \`<rect x="\${poolX}" y="\${poolY}" width="\${shW}" height="\${poolH}" fill="#BFE0EF" opacity="0.8"/>\`;
    if(shW > 60){
      extras += \`<text x="\${poolX+shW/2}" y="\${poolY+poolH/2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#0C447C" font-family="Arial">Solar h\\u00famedo\${showDims ? ' ('+fmt(s.solarHumedoAncho)+'m)' : ''}</text>\`;
    }
  }

  if(s.escalera){
    const stepSize = Math.min(pxPerM*0.9, poolW*0.18, poolH*0.35, 46);
    let sx, sy;
    if(s.escaleraPos === 'solar'){ sx = poolX; sy = poolY+poolH/2-stepSize/2; }
    else if(s.escaleraPos === 'opuesto'){ sx = poolX+poolW-stepSize; sy = poolY+poolH/2-stepSize/2; }
    else if(s.escaleraPos === 'lateral1'){ sx = poolX+poolW/2-stepSize/2; sy = poolY; }
    else { sx = poolX+poolW/2-stepSize/2; sy = poolY+poolH-stepSize; }
    extras += \`<rect x="\${sx}" y="\${sy}" width="\${stepSize}" height="\${stepSize}" fill="#fff" stroke="#1B3A5C" stroke-width="1.2" stroke-dasharray="3 2"/>\`;
    extras += \`<text x="\${sx+stepSize/2}" y="\${sy+stepSize/2}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="#1B3A5C" font-family="Arial">Escalera</text>\`;
  }

  let espejoW = s.largo, espejoH = s.ancho;
  if(s.tipoPileta === 'fibra' && s.labios > 0){
    const labiosPx = s.labios * pxPerM;
    espejoW = Math.max(0, s.largo - 2*s.labios);
    espejoH = Math.max(0, s.ancho - 2*s.labios);
    extras += \`<rect x="\${poolX+labiosPx}" y="\${poolY+labiosPx}" width="\${Math.max(0,poolW-2*labiosPx)}" height="\${Math.max(0,poolH-2*labiosPx)}" rx="3" fill="none" stroke="#1B3A5C" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>\`;
    if(showDims && poolW-2*labiosPx > 90){
      extras += \`<text x="\${poolX+poolW/2}" y="\${poolY+labiosPx+14}" text-anchor="middle" font-size="10" fill="#1B3A5C" font-family="Arial" opacity="0.75">Espejo de agua \${fmt(espejoW)} x \${fmt(espejoH)} m</text>\`;
    }
  }

  if(s.luces && s.cantLuces > 0){
    const n = s.cantLuces;
    for(let i=0; i<n; i++){
      const t = n === 1 ? 0.5 : (i+0.5)/n;
      const lx = poolX + 6;
      const ly = poolY + t*poolH;
      extras += \`<circle cx="\${lx}" cy="\${ly}" r="4" fill="#FCDE5A" stroke="#B98A1E" stroke-width="0.75"/>\`;
    }
    if(showDims){
      extras += \`<text x="\${poolX+18}" y="\${poolY-14 > 20 ? poolY - 4 : poolY+poolH+18}" font-size="10" fill="#B98A1E" font-family="Arial">\${n} \${n===1 ? 'luz' : 'luces'}</text>\`;
    }
  }

  const dimColor = '#1B3A5C';
  const labelColor = '#7a4a2e';

  const revestLabels = { ceramicos: 'Cer\\u00e1micos', travertino: 'Travertino', pintura: 'Pintura', otro: s.revestimientoOtro || 'Otro' };
  const revestText = s.revestimiento ? revestLabels[s.revestimiento] : '';

  if(showDims){
    dims += \`<text x="\${poolX+poolW/2}" y="\${poolY-14}" text-anchor="middle" font-size="13" fill="\${dimColor}" font-family="Arial" font-weight="bold">Pileta \${fmt(s.largo)} x \${fmt(s.ancho)} m</text>\`;
    if(revestText){
      dims += \`<text x="\${poolX+poolW/2}" y="\${poolY-14-16}" text-anchor="middle" font-size="11" fill="#555" font-family="Arial">Revestimiento interior: \${revestText}</text>\`;
    }

    const topY = oy - 34;
    dims += \`<line x1="\${ox}" y1="\${topY}" x2="\${ox+totalW*pxPerM}" y2="\${topY}" stroke="\${dimColor}" stroke-width="0.75"/>\`;
    dims += tickH(ox, topY, dimColor); dims += tickH(ox+totalW*pxPerM, topY, dimColor);
    dims += \`<text x="\${ox+totalW*pxPerM/2}" y="\${topY-10}" text-anchor="middle" font-size="11" fill="\${dimColor}" font-family="Arial">Borde total: \${fmt(totalW)} m</text>\`;

    const leftX = Math.max(40, ox - 60);
    dims += \`<line x1="\${leftX}" y1="\${oy}" x2="\${leftX}" y2="\${oy+totalH*pxPerM}" stroke="\${dimColor}" stroke-width="0.75"/>\`;
    dims += tick(leftX, oy, dimColor); dims += tick(leftX, oy+totalH*pxPerM, dimColor);
    dims += \`<text x="\${leftX-16}" y="\${oy+totalH*pxPerM/2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="\${dimColor}" font-family="Arial" transform="rotate(-90 \${leftX-16} \${oy+totalH*pxPerM/2})">Borde total: \${fmt(totalH)} m</text>\`;

    dims += \`<text x="\${poolX+poolW/2}" y="\${oy+(s.lateral1*pxPerM)/2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="\${labelColor}" font-family="Arial">Lateral 1: \${fmt(s.lateral1)} m</text>\`;
    dims += \`<text x="\${poolX+poolW/2}" y="\${oy+s.lateral1*pxPerM+poolH+(s.lateral2*pxPerM)/2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="\${labelColor}" font-family="Arial">Lateral 2: \${fmt(s.lateral2)} m</text>\`;

    if(s.solar*pxPerM > 22){
      dims += \`<text x="\${ox+(s.solar*pxPerM)/2}" y="\${poolY+poolH/2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="\${labelColor}" font-family="Arial" transform="rotate(-90 \${ox+(s.solar*pxPerM)/2} \${poolY+poolH/2})">Solar: \${fmt(s.solar)} m</text>\`;
    }
    if(s.opuesto*pxPerM > 22){
      dims += \`<text x="\${ox+s.solar*pxPerM+poolW+(s.opuesto*pxPerM)/2}" y="\${poolY+poolH/2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="\${labelColor}" font-family="Arial" transform="rotate(-90 \${ox+s.solar*pxPerM+poolW+(s.opuesto*pxPerM)/2} \${poolY+poolH/2})">Opuesto: \${fmt(s.opuesto)} m</text>\`;
    }
  } else {
    dims += \`<text x="\${ox+totalW*pxPerM/2}" y="\${oy-14}" text-anchor="middle" font-size="12" fill="#555" font-family="Arial">Lateral 1: \${fmt(s.lateral1)} m</text>\`;
    dims += \`<text x="\${ox+totalW*pxPerM/2}" y="\${oy+totalH*pxPerM+24}" text-anchor="middle" font-size="12" fill="#555" font-family="Arial">Lateral 2: \${fmt(s.lateral2)} m</text>\`;
    dims += \`<text x="\${Math.max(14, ox-16)}" y="\${oy+totalH*pxPerM/2}" text-anchor="end" font-size="12" fill="#555" font-family="Arial">Solar: \${fmt(s.solar)} m</text>\`;
    dims += \`<text x="\${ox+totalW*pxPerM+16}" y="\${oy+totalH*pxPerM/2}" text-anchor="start" font-size="12" fill="#555" font-family="Arial">Opuesto: \${fmt(s.opuesto)} m</text>\`;
    dims += \`<text x="\${poolX+poolW/2}" y="\${poolY+poolH/2 - (revestText?8:0)}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#1B3A5C" font-family="Arial">\${fmt(s.largo)} x \${fmt(s.ancho)} m</text>\`;
    if(revestText){
      dims += \`<text x="\${poolX+poolW/2}" y="\${poolY+poolH/2 + 12}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#1B3A5C" font-family="Arial" opacity="0.7">Revestimiento: \${revestText}</text>\`;
    }
  }

  let scaleBar = '';
  let svgH = oy + totalH*pxPerM + padBottom;
  if(showDims){
    const barY = oy + totalH*pxPerM + 46;
    const segments = Math.min(5, Math.max(1, Math.floor(totalW)));
    const barX0 = ox;
    scaleBar += \`<text x="\${barX0}" y="\${barY-12}" font-size="11" fill="\${dimColor}" font-family="Arial">Escala gr\\u00e1fica</text>\`;
    for(let i=0; i<segments; i++){
      const x = barX0 + i*pxPerM;
      const fill = i % 2 === 0 ? '#1B3A5C' : '#ffffff';
      scaleBar += \`<rect x="\${x}" y="\${barY}" width="\${pxPerM}" height="10" fill="\${fill}" stroke="\${dimColor}" stroke-width="0.75"/>\`;
    }
    for(let i=0; i<=segments; i++){
      const x = barX0 + i*pxPerM;
      scaleBar += \`<text x="\${x}" y="\${barY+24}" text-anchor="middle" font-size="10" fill="\${dimColor}" font-family="Arial">\${i}m</text>\`;
    }
    svgH = barY + 40;
  }

  svg.setAttribute('viewBox', '0 0 ' + viewW + ' ' + svgH);

  svg.innerHTML = \`
    <rect x="\${ox}" y="\${oy}" width="\${totalW*pxPerM}" height="\${totalH*pxPerM}" rx="6" fill="#F7E6D3" stroke="#C0522D" stroke-width="1"/>
    \${grid}
    <rect x="\${poolX}" y="\${poolY}" width="\${poolW}" height="\${poolH}" rx="4" fill="#DCEBF7" stroke="#1B3A5C" stroke-width="1"/>
    \${extras}
    \${dims}
    \${scaleBar}
  \`;
}

function tick(x,y,color){ return \`<line x1="\${x-4}" y1="\${y}" x2="\${x+4}" y2="\${y}" stroke="\${color}" stroke-width="0.75"/>\`; }
function tickH(x,y,color){ return \`<line x1="\${x}" y1="\${y-4}" x2="\${x}" y2="\${y+4}" stroke="\${color}" stroke-width="0.75"/>\`; }

function exportarInterno(){
  html2canvas(document.getElementById('capture-area'), {backgroundColor: '#ffffff', scale: 3}).then(canvas => {
    const link = document.createElement('a');
    const nombre = document.getElementById('nombre').value.trim();
    link.download = window.armarNombreArchivo('Loseta', nombre, null) + '_interno.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => alert('Error generando la imagen: ' + err.message));
}

function exportarCliente(){
  const s = getState();
  document.getElementById('clientRef').textContent = s.nombre || '';
  drawSvg('svgClient', 1000, 650, s, true);

  const target = document.getElementById('client-capture');
  target.style.display = 'block';

  requestAnimationFrame(() => {
    html2canvas(target, {backgroundColor: '#ffffff', scale: 3, useCORS: true}).then(canvas => {
      const link = document.createElement('a');
      link.download = window.armarNombreArchivo('Loseta', s.nombre, null) + '_cliente.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err => alert('Error generando la imagen: ' + err.message));
  });
}

// Vista limpia para imprimir/exportar a PDF: reusa el mismo contenedor #client-capture
// que ya arma "Imagen para cliente" (plano + medidas, sin precios), en vez de crear
// un tercer contenedor — mismo patrón que el resto de las calculadoras (form editable
// oculto, solo se ve la "hoja" limpia). Los estilos de impresión que sacan #client-capture
// de su posición off-screen y ocultan .wrap están en styles.ts (@media print).
function imprimirVistaLimpia(){
  const s = getState();
  document.getElementById('clientRef').textContent = s.nombre || '';
  drawSvg('svgClient', 1000, 650, s, true);
  // El navegador no deja forzar el nombre de archivo del PDF generado por
  // window.print() ("Guardar como PDF") -- solo puede sugerirlo, y lo hace a
  // partir del <title> del documento en el momento de imprimir. Lo cambiamos acá
  // al mismo formato que ya usa el Word/PNG (armarNombreArchivo) y lo restauramos
  // después, para no dejar el título pisado si el usuario navega sin imprimir.
  const tituloOriginal = document.title;
  document.title = window.armarNombreArchivo('Loseta', s.nombre, null);
  // iOS no tiene un diálogo de impresión real: window.print() dispara la hoja
  // compartir/imprimir del sistema operativo, que sigue abierta después de que
  // 'afterprint' ya disparó adentro de la página -- si restauramos el título
  // enseguida, iOS puede terminar leyendo el título genérico (ya restaurado) en
  // vez del que pusimos, porque lee el nombre sugerido en un momento propio del
  // sistema que no está sincronizado con ese evento. El delay le da margen a esa
  // lectura antes de revertir.
  const restaurarTitulo = () => {
    window.removeEventListener('afterprint', restaurarTitulo);
    setTimeout(() => { document.title = tituloOriginal; }, 3000);
  };
  window.addEventListener('afterprint', restaurarTitulo);
  window.print();
}

function resetAll(){
  if(!confirm('\\u00bfLimpiar todos los campos y empezar un presupuesto nuevo?')) return;
  document.getElementById('largo').value = '';
  document.getElementById('ancho').value = '';
  document.getElementById('incluido').value = '0.5';
  document.getElementById('nombre').value = '';
  document.getElementById('solar').value = '0';
  document.getElementById('opuesto').value = '0';
  document.getElementById('lateral1').value = '0';
  document.getElementById('lateral2').value = '0';
  document.getElementById('chkSolarHumedo').checked = false;
  document.getElementById('chkEscalera').checked = false;
  document.getElementById('subSolarHumedo').style.display = 'none';
  document.getElementById('subEscalera').style.display = 'none';
  document.getElementById('solarHumedoAncho').value = '0';
  document.getElementById('escaleraPos').value = 'solar';
  document.getElementById('tipoPileta').value = 'hormigon';
  document.getElementById('subLabios').style.display = 'none';
  document.getElementById('labios').value = '0.20';
  document.getElementById('chkLuces').checked = false;
  document.getElementById('subLuces').style.display = 'none';
  document.getElementById('cantLuces').value = '0';
  document.getElementById('revestimiento').value = '';
  document.getElementById('subRevestOtro').style.display = 'none';
  document.getElementById('revestimientoOtro').value = '';
  materials = [ { name: 'Loseta com\\u00fan', price: 0 }, { name: 'Decks', price: 0 } ];
  renderMaterials();
  calc();
  const msg = document.getElementById('cloudMsg');
  if(msg){ msg.textContent = ''; }
}

renderMaterials();
document.querySelectorAll('#capture-area input, #capture-area select').forEach(el => el.addEventListener('input', calc));
calc();

function cargarPresupuestoExterno(datos){
  if(!datos) return;
  document.getElementById('largo').value = datos.largo ?? '';
  document.getElementById('ancho').value = datos.ancho ?? '';
  document.getElementById('incluido').value = datos.inc ?? '0.5';
  document.getElementById('nombre').value = datos.nombre ?? '';
  document.getElementById('solar').value = datos.solar ?? '0.5';
  document.getElementById('opuesto').value = datos.opuesto ?? '0.5';
  document.getElementById('lateral1').value = datos.lateral1 ?? '0.5';
  document.getElementById('lateral2').value = datos.lateral2 ?? '0.5';
  document.getElementById('chkSolarHumedo').checked = !!datos.solarHumedo;
  document.getElementById('solarHumedoAncho').value = datos.solarHumedoAncho ?? '1.0';
  document.getElementById('subSolarHumedo').style.display = datos.solarHumedo ? 'block' : 'none';
  document.getElementById('chkEscalera').checked = !!datos.escalera;
  document.getElementById('escaleraPos').value = datos.escaleraPos ?? 'solar';
  document.getElementById('subEscalera').style.display = datos.escalera ? 'block' : 'none';
  document.getElementById('tipoPileta').value = datos.tipoPileta ?? 'hormigon';
  document.getElementById('labios').value = datos.labios ?? '0.20';
  document.getElementById('subLabios').style.display = datos.tipoPileta === 'fibra' ? 'block' : 'none';
  document.getElementById('chkLuces').checked = !!datos.luces;
  document.getElementById('cantLuces').value = datos.cantLuces ?? '2';
  document.getElementById('subLuces').style.display = datos.luces ? 'block' : 'none';
  document.getElementById('revestimiento').value = datos.revestimiento ?? '';
  document.getElementById('revestimientoOtro').value = datos.revestimientoOtro ?? '';
  document.getElementById('subRevestOtro').style.display = datos.revestimiento === 'otro' ? 'block' : 'none';
  calc();
}
window.cargarPresupuestoExterno = cargarPresupuestoExterno;

async function guardarEnNubeClick(){
  const btn = document.getElementById('btnGuardarNube');
  const msg = document.getElementById('cloudMsg');
  const s = getState();
  if(btn){ btn.disabled = true; }
  if(msg){ msg.textContent = 'Guardando...'; msg.style.color = '#666'; }
  try{
    const result = window.presupuestoEnEdicionId
      ? await window.actualizarPresupuesto(window.presupuestoEnEdicionId, s, s.nombre)
      : await window.guardarPresupuesto(s, s.nombre);
    if(msg){
      if(result && result.error){
        msg.textContent = 'Error al guardar: ' + result.error.message;
        msg.style.color = '#a3441f';
      } else {
        msg.textContent = 'Presupuesto guardado en la nube.';
        msg.style.color = '#1B3A5C';
      }
    }
  } catch(err){
    if(msg){ msg.textContent = 'Error al guardar: ' + err.message; msg.style.color = '#a3441f'; }
  } finally {
    if(btn){ btn.disabled = false; }
  }
}

/* ---------------- BARRA DE ACCIONES: espacio reservado ---------------- */
// En desktop la barra (.btns-wrap) va en flujo normal, así que no tapa nada y no hace
// falta reservar espacio. En mobile lo que flota fijo al fondo es el disparador
// "Acciones ▾" (.losetas-sheet-trigger): reservamos un padding-bottom == su altura
// REAL para que no tape el último field-section. Cuando el disparador está oculto
// (desktop, display:none) su offsetHeight es 0 y el padding-bottom queda solo en 24px.
(function ajustarEspacioBarraAcciones(){
  const disparador = document.querySelector('.losetas-sheet-trigger');
  const pagina = document.querySelector('.pys-calc');
  if(!pagina) return;
  const actualizar = () => pagina.style.setProperty('--action-bar-h', (disparador ? disparador.offsetHeight : 0) + 'px');
  if(disparador) new ResizeObserver(actualizar).observe(disparador);
  window.addEventListener('resize', actualizar);
  actualizar();
})();

/* ---------------- BOTTOM SHEET DE ACCIONES (mobile) ---------------- */
// Abre/cierra la hoja inferior de acciones en mobile. Mismo patrón que las otras 4
// calculadoras (acá la clase 'sheet-open' va sobre .pys-calc). No toca la lógica de
// ningún botón. Se cierra al elegir una acción EXCEPTO "Guardar en la nube": su
// mensaje de estado (#cloudMsg) vive dentro de la hoja, así que hay que dejarla
// abierta para que se vea. En desktop el trigger no existe (return).
(function initActionSheet(){
  const root = document.querySelector('.pys-calc');
  const trigger = document.getElementById('losetas-action-trigger');
  const overlay = document.getElementById('losetas-action-overlay');
  const wrap = document.getElementById('btns-wrap');
  if(!root || !trigger || !wrap) return;
  const cerrar = () => { root.classList.remove('sheet-open'); trigger.setAttribute('aria-expanded','false'); };
  trigger.addEventListener('click', () => {
    const abierto = root.classList.toggle('sheet-open');
    trigger.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
  if(overlay) overlay.addEventListener('click', cerrar);
  wrap.querySelectorAll('button, a').forEach(el => {
    if(el.id === 'btnGuardarNube') return;
    el.addEventListener('click', cerrar);
  });
})();

// Handlers inline del markup (onclick/oninput/onblur) + funciones que llama React:
// tienen que vivir en window porque los atributos inline se evalúan en scope global,
// fuera de esta IIFE.
window.toggleSubfield = toggleSubfield;
window.addMaterial = addMaterial;
window.removeMaterial = removeMaterial;
window.updateMaterial = updateMaterial;
window.confirmarPrecioMaterial = confirmarPrecioMaterial;
window.exportarInterno = exportarInterno;
window.exportarCliente = exportarCliente;
window.imprimirVistaLimpia = imprimirVistaLimpia;
window.guardarEnNubeClick = guardarEnNubeClick;
window.resetAll = resetAll;
window.cargarPresupuestoExterno = cargarPresupuestoExterno;
})();
`;

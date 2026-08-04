(function(){
/* ---------------- STORAGE KEYS ---------------- */
const K_CATALOG = 'presupuesto-catalogo-opcionales';
const K_LEGAL   = 'presupuesto-texto-legal';
const K_FOOTER  = 'presupuesto-footer-empresa';
const K_FOTOS_OPC = 'presupuesto-fotos-por-opcional'; // metadata liviana; los bytes van en IndexedDB

/* ---------------- DEFAULTS ---------------- */
const defaultOptionales = [
  {id:cid(), slug:'luces', desc:'Luces de acero inoxidable con su respectiva controladora, fuente e instalaciones eléctricas, se pueden colocar 2 o 3 (siendo una en la cama de agua) — precio por unidad', price:240000, included:false},
  {id:cid(), slug:'reemplazo_losetas_decks', desc:'Reemplazo de losetas incluidas en vereda perimetral de 0.50 mts de ancho por decks atérmicos antideslizantes de 1x0.12 mts', price:1290000, included:false},
  {id:cid(), slug:'solarium_losetas', desc:'Solárium seco hormigón + losetas atérmicas, terminado (precio por m2)', price:239000, included:false},
  {id:cid(), slug:'solarium_decks', desc:'Solárium seco hormigón + decks atérmicos 1x0.12, terminado (precio por m2)', price:279000, included:false},
  {id:cid(), slug:'kit_limpieza', desc:'Kit de Limpieza: caño telescópico, manga desagote, manguera flotante, barre fondo, bichero, cloro', price:109000, included:false},
  {id:cid(), slug:'bano_quimico', desc:'Baño químico, en caso de corresponder', price:null, included:false},
  {id:cid(), slug:'retiro_tierra', desc:'Retiro de tierra desde la calle', price:null, included:false},
  {id:cid(), slug:'tapa_metalica', desc:'Tapa metálica sala de filtros', price:null, included:false},
  {id:cid(), slug:'climatizacion25000', desc:'Climatización bomba de calor inverter, hasta 25.000 lts, instalada (precio normal con instalación $3.300.000 — este valor es oportunidad con equipo físico en nuestro negocio)', price:2650000, included:false},
  {id:cid(), slug:'climatizacion30000', desc:'Climatización bomba de calor inverter, hasta 30.000 lts, instalada (ver diferentes gamas de equipos: básico, intermedio y pro)', price:null, included:false},
  {id:cid(), slug:'revestimiento_ceramico_bali', desc:'Revestimiento interior cerámico importado de Brasil símil piedra Bali, color verde o celeste 10x10 en malla, terminado, instalado', price:4990000, included:false},
  {id:cid(), slug:'revestimiento_piedra_bali', desc:'Revestimiento interior en piedra Bali importada de Indonesia de 10x10 y 20x20 cms, piedras individuales, se enciman unas con otras, sin juntas, terminado, instalado', price:null, included:false},
  {id:cid(), slug:'travertino_rustico_exterior', desc:'Revestimiento exterior de piscina en Mármol Travertino Rústico 60x40 cms, importado de Turquía, mano de obra y materiales, terminado', price:null, included:false},
  {id:cid(), slug:'travertino_pulido_interior', desc:'Revestimiento interior de piscina completa en Mármol Travertino Pulido Taponado 60x40 cms, importado de Turquía, mano de obra y materiales, terminado', price:null, included:false},
  {id:cid(), slug:'cerco_perimetral', desc:'Cerco perimetral desmontable de aluminio y lona microperforada para seguridad de niños y mascotas, materiales y mano de obra, instalado (valor por metro lineal)', price:79500, included:false},
];

const defaultLegal = `OBRA CIVIL PISCINA:

Ejecutada con materiales de primera calidad y construcción de:

1. - Toda la estructura será de hormigón de cemento portland con una mezcla homogénea de cementos áridos y agua (resistencia característica de H21), sin aplicación de otro material adicionado y compuesta de:

2. - Una losa de hormigón de 15 cm de espesor con armadura de hierros del 6 mm de diámetro cada 20 cm en ambos sentidos y de un solo tipo de acero en toda la obra.

3. - Muros laterales de hormigón de las mismas características que el anterior y encofrado entre el laminado vertical y un muro de mampostería de ladrillos comunes de 13 cm de espesor.

4. - Encadenados perimetral tanto superior e inferior incorporado en los laterales para soportar cambios de dilatación de materiales.

5. - Una losa perimetral de hormigón de 0.50 cm de ancho y 10 cm de espesor, formando una vereda en continuidad con el muro lateral.

6. - Todo el conjunto será terminado con revoque grueso y fino con agregado hidrófugo y sellado con elastómero en juntas y orificios entre el hormigón e instalación hidráulica.

7. - El tamaño de la sala de filtros será del tamaño que demanden los equipos (1,20 x 1,00 aproximadamente) y será en mampostería de ladrillos comunes enrasado y con piso doble nido de abejas con junta de arena para el filtrado y normal escurrimiento del agua.

8. - Una escalera de material emplazada en la parte baja.

B) SISTEMA HIDRÁULICO:

1. - Electro bomba monofásica autocebante 1/2 HP con trampa de pelo incorporada.
2. - Filtro VC30 de Poliuretano (apto para hasta 60.000 lts.), con multiválvulas de 6 funciones, colector de 6 picos, difusor ABS y visor para retro lavado. Incluye el manto filtrante.
3. - Hidromasajes zonificados, sistema embutido con toma de aire exterior.
4. - Toma de fondo, toma de limpia fondo y Skimmer o barre superficie.
5. - Toda la cañería de la conexión hidráulica será en PVC 3,2 reforzada de 10 kg. de presión.

El formato de la piscina será el determinado por el propietario.

La obra civil tiene una garantía de 10 años y el equipo hidráulico DOS años a excepción de desperfectos eléctricos.

El presente presupuesto incluye la excavación del pozo donde se construirá la piscina. No incluye la pintura. Recomendamos no pintarla hasta después de los tres meses de construida para favorecer el proceso de curado. No incluye la conexión eléctrica de 220V hasta la sala de filtros, no incluye tapa sala de filtros y no incluye conexión a cloacas.

IMPORTANTE: Las medidas especificadas precedentemente son libres, no de construcción.

OPCIONALES: Limpia fondo Robot automático marca Dolphin. Cubre piscina de lona microperforada. Ionizador solar boya. Nado contracorriente. Revestimiento en Venecitas vítreas importadas y cerámicas símil piedra. Desborde infinito. Climatización solar, eléctrica y a gas.

El presente no incluye sobreelevación de la construcción.`;

const defaultFooterFields = {
  empresa: 'PLAYA Y SOL S.A.S.',
  direccion: 'Corrientes 1210, 5900 Villa María, Córdoba',
  telFijo: '0353-4531612',
  contactoNombre: 'Cr. Francisco Espina',
  contactoCel: '3535668994',
  whatsapp: '3534224605',
  email: 'piscinas@playaysol.com.ar',
  web: 'www.playaysol.com.ar',
  facebook: 'Playa y Sol Piscinas',
  facebookUrl: '',
  instagram: '@playaysol.piscinas',
  instagramUrl: 'https://www.instagram.com/playaysol.piscinas/'
};

const defaultDimension = `7.00 mts largo por 3.00 mts ancho y de 1.00 mts a 1.45 mts de profundidad, incluye cama de agua de 1.50 mts largo por 3.00 mts de ancho, con escalera de tres escalones de 0.30 mts huella y 3.00 mts de ancho para ingreso a piscina.

Losetas Atérmicas Antideslizantes para el borde perimetral de la piscina 0.50 mts.

Los materiales están incluidos`;

// Logos reales de marca (imagen completa, incluye fondo de color + texto) — embebidos para que
// funcionen 100% offline y se vean idénticos en pantalla, PDF y Word.
// Fotos de ejemplo reales (extraídas de tu presupuesto modelo), precargadas por defecto
// en cada presupuesto nuevo, por opcional. Son editables/eliminables/agregables como cualquier otra foto.
const DEFAULT_PHOTO_SEEDS = {
  "climatizacion25000": [
    "/seeds/climatizacion25000-1-e031a7b1.jpg",
    "/seeds/climatizacion25000-2-09461576.jpg"
  ],
  "climatizacion30000": [
    "/seeds/climatizacion30000-1-39bb24d6.jpg",
    "/seeds/climatizacion30000-2-8b23b6df.jpg",
    "/seeds/climatizacion30000-3-b2373b9c.jpg"
  ],
  "revestimiento_ceramico_bali": [
    "/seeds/revestimiento_ceramico_bali-1-c19833a5.jpg",
    "/seeds/revestimiento_ceramico_bali-2-98907be6.jpg",
    "/seeds/revestimiento_ceramico_bali-3-417efb5f.jpg",
    "/seeds/revestimiento_ceramico_bali-4-dc038b92.jpg"
  ],
  "revestimiento_piedra_bali": [
    "/seeds/revestimiento_piedra_bali-1-98f57e64.jpg",
    "/seeds/revestimiento_piedra_bali-2-fde03c40.jpg",
    "/seeds/revestimiento_piedra_bali-3-b164545a.jpg"
  ],
  "travertino": [
    "/seeds/travertino-1-ac1fe49e.jpg",
    "/seeds/travertino-2-89179844.jpg",
    "/seeds/travertino-3-8c31fff6.jpg"
  ],
  "cerco_perimetral": [
    "/seeds/cerco_perimetral-1-6dde6bea.jpg",
    "/seeds/cerco_perimetral-2-23004a23.jpg"
  ]
};
const DEFAULT_FOTOS_GENERALES_SEED = [
  "/seeds/general-1-454abd16.jpg",
  "/seeds/general-2-a55d37fe.jpg",
  "/seeds/general-3-45ececf7.jpg"
];

const HEADER_VARIANTS = {
  teal: { color:'#00829C', img:'/header-teal.png' },
  navy: { color:'#214D5A', img:'/header-navy.png' }
};

/* ---------------- STATE ---------------- */
let state = {
  fecha: todayStr(),
  cliente:'', domicilio:'', localidad:'', tel:'', email:'',
  dimension: defaultDimension,
  validez: '7',
  subtotal: 0,
  items: [], // vacío por defecto: en el modelo estándar nada se agrega al TOTAL salvo que el equipo lo sume a mano
  opcionales: [],
  legal: defaultLegal,
  footer: {...defaultFooterFields},
  headerVariant: 'teal',
  fotos: [], // fotos generales (no atadas a un opcional puntual)
  fotosPorOpcional: {} // { [catalogItemId]: [{id, blob, url, caption, width, height}] }
};

function cid(){ return 'i'+Math.random().toString(36).slice(2,9); }
function todayStr(){
  const d = new Date();
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function fmt(n){
  n = Number(n)||0;
  return '$ ' + n.toLocaleString('es-AR');
}

/* ---------------- FOTOS EN INDEXEDDB (sin el límite de ~5-10MB de localStorage) ---------------- */
let _dbPromise = null;
function openFotosDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open('PlayaSolPresupuestosDB', 1);
    req.onupgradeneeded = ()=>{
      req.result.createObjectStore('fotos', { keyPath:'id' });
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
  return _dbPromise;
}
async function idbPutFoto(id, blob){
  const db = await openFotosDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('fotos','readwrite');
    tx.objectStore('fotos').put({ id, blob });
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}
async function idbGetFoto(id){
  const db = await openFotosDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('fotos','readonly');
    const req = tx.objectStore('fotos').get(id);
    req.onsuccess = ()=>resolve(req.result ? req.result.blob : null);
    req.onerror = ()=>reject(req.error);
  });
}
async function idbDeleteFoto(id){
  const db = await openFotosDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('fotos','readwrite');
    tx.objectStore('fotos').delete(id);
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}
function blobToDataURL(blob){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
// Word (guardado como .doc con HTML embebido) falla en renderizar imágenes pesadas —
// muestra el ícono de "imagen rota" al convertir a PDF si el base64 es muy grande.
// Por eso, para el export a Word SIEMPRE reducimos cada foto a un tamaño liviano y seguro,
// sin importar cuán pesada sea la foto original que subió el usuario.
function blobToConstrainedDataURL(blob, maxDim=900, quality=0.72){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      let w = img.naturalWidth, h = img.naturalHeight;
      if(w > maxDim || h > maxDim){
        const scale = maxDim / Math.max(w,h);
        w = Math.round(w*scale); h = Math.round(h*scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
// Aviso al usuario cuando una o más fotos no se pudieron cargar (dañadas, formato no
// soportado, almacenamiento lleno): antes fallaban en silencio y la foto simplemente no
// aparecía, dando la sensación de que la app estaba rota.
function avisarFotosFallidas(n){
  if(!n) return;
  alert(n === 1
    ? 'No se pudo cargar una de las fotos. Puede estar dañada o en un formato no soportado — probá con otra.'
    : 'No se pudieron cargar ' + n + ' de las fotos seleccionadas. Pueden estar dañadas o en un formato no soportado.');
}
// Las fotos de ejemplo viven como .jpg reales en /seeds. Antes iban embebidas en
// base64 dentro de este mismo archivo, que por eso pesaba ~1,8 MB y bloqueaba la
// carga de la calculadora entera. Ahora se piden por red solo cuando hacen falta,
// quedan en la caché del navegador y se comparten entre las 5 calculadoras.
async function fotoDesdeSeed(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('No se pudo cargar la foto de ejemplo ' + url);
  const blob = await res.blob();
  const id = cid();
  await idbPutFoto(id, blob);
  // Un solo objectURL, reusado para el <img> de medición y para el state — antes se
  // creaban dos por foto y uno quedaba huérfano hasta recargar la página.
  const objectUrl = URL.createObjectURL(blob);
  const img = await new Promise(res=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = ()=>res(i); // una seed rota no puede colgar el arranque
    i.src = objectUrl;
  });
  return { id, blob, url: objectUrl, caption:'', width: img.naturalWidth, height: img.naturalHeight };
}

// Nunca dejar que una foto de ejemplo que no cargó (red caída, archivo movido)
// tumbe el arranque de la calculadora: se descartan las que fallen y sigue.
async function fotosDesdeSeeds(urls){
  const resultados = await Promise.allSettled(urls.map(fotoDesdeSeed));
  return resultados.filter(r=>r.status==='fulfilled').map(r=>r.value);
}

// Fotos generales de ejemplo (modelos/pileta terminada) — estas sí son por presupuesto,
// para que cada cotización nueva arranque con un par de fotos de referencia lindas.
async function seedFotosGeneralesDefaults(){
  state.fotos = await fotosDesdeSeeds(DEFAULT_FOTOS_GENERALES_SEED);
}

// Si el catálogo guardado en esta compu viene de una versión más vieja del archivo
// (sin el campo "slug" que asocia cada opcional con sus fotos de ejemplo), lo reconstruye
// buscando palabras clave en la descripción. Así las fotos no se pierden aunque hayas
// estado usando una copia de antes de que existiera este campo.
function repairCatalogSlugs(){
  const rules = [
    { slug:'revestimiento_ceramico_bali', test: d => /bali/i.test(d) && /cer[aá]mic/i.test(d) },
    { slug:'revestimiento_piedra_bali',   test: d => /bali/i.test(d) && /piedra/i.test(d) && !/cer[aá]mic/i.test(d) },
    { slug:'travertino',                  test: d => /travertino/i.test(d) },
    { slug:'climatizacion25000',          test: d => /climatizaci[oó]n/i.test(d) && /25\.?000/.test(d) },
    { slug:'climatizacion30000',          test: d => /climatizaci[oó]n/i.test(d) && /30\.?000/.test(d) },
    { slug:'cerco_perimetral',            test: d => /cerco perimetral/i.test(d) },
  ];
  let changed = false;
  state.opcionales.forEach(op=>{
    if(op.slug) return; // ya tiene uno, no lo tocamos
    const match = rules.find(r=>r.test(op.desc));
    if(match){ op.slug = match.slug; changed = true; }
  });
  return changed;
}

/* ---------------- PERSISTENCIA de fotos por opcional (catálogo compartido, NO por presupuesto) ---------------- */
async function loadFotosPorOpcional(){
  let meta = null;
  try{
    const raw = localStorage.getItem(K_FOTOS_OPC);
    meta = raw ? JSON.parse(raw) : null;
  }catch(e){ meta = null; }

  // 1) Reconstruir lo que ya estaba guardado (fotos propias que hayas subido)
  state.fotosPorOpcional = {};
  if(meta){
    for(const opId of Object.keys(meta)){
      const lista = [];
      for(const fm of meta[opId]){
        const blob = await idbGetFoto(fm.id).catch(()=>null);
        if(!blob) continue; // si se perdió algo, lo salteamos en vez de romper todo
        lista.push({ id:fm.id, caption:fm.caption||'', width:fm.width, height:fm.height, blob, url:URL.createObjectURL(blob) });
      }
      if(lista.length) state.fotosPorOpcional[opId] = lista;
    }
  }

  // 2) Reparar catálogos viejos sin "slug"
  if(repairCatalogSlugs()) saveCatalog();

  // 3) Completar SOLO los opcionales con slug reconocido que todavía no tengan
  //    ninguna foto propia guardada — nunca pisa fotos que ya hayas subido.
  // B) Sembrado en paralelo (Promise.all) en vez de una imagen por vez: en cold start
  //    baja el armado del catálogo de fotos por opcional de ~680ms a ~200ms.
  const seedTasks = [];
  for(const op of state.opcionales){
    if(!op.slug || !DEFAULT_PHOTO_SEEDS[op.slug]) continue;
    if(state.fotosPorOpcional[op.id] && state.fotosPorOpcional[op.id].length) continue;
    seedTasks.push((async ()=>{
      state.fotosPorOpcional[op.id] = await fotosDesdeSeeds(DEFAULT_PHOTO_SEEDS[op.slug]);
    })());
  }
  if(seedTasks.length){ await Promise.all(seedTasks); await saveFotosPorOpcional(); }
}

async function saveFotosPorOpcional(){
  try{
    const meta = {};
    Object.keys(state.fotosPorOpcional).forEach(opId=>{
      const arr = state.fotosPorOpcional[opId];
      if(arr && arr.length){
        meta[opId] = arr.map(f=>({ id:f.id, caption:f.caption, width:f.width, height:f.height }));
      }
    });
    localStorage.setItem(K_FOTOS_OPC, JSON.stringify(meta));
  }catch(e){ console.error('No se pudieron guardar las fotos del catálogo', e); }
}

/* ---------------- STORAGE LOAD (localStorage — offline, por copia individual del archivo) ---------------- */
// Fragmentos de texto que NO cambian entre versiones (para reconocer un ítem ya guardado
// aunque su descripción se haya retocado un poco, y aunque sea de antes de que existiera "slug").
const LEGACY_MATCH_FRAGMENTS = {
  luces: 'luces de acero inoxidable',
  reemplazo_losetas_decks: 'decks atérmicos antideslizantes',
  solarium_losetas: 'solárium seco hormigón + losetas atérmicas',
  solarium_decks: 'solárium seco hormigón + decks atérmicos',
  kit_limpieza: 'kit de limpieza: caño telescópico',
  bano_quimico: 'baño químico, en caso de corresponder',
  retiro_tierra: 'retiro de tierra desde la calle',
  tapa_metalica: 'tapa metálica sala de filtros',
  climatizacion25000: 'hasta 25.000 lts',
  climatizacion30000: 'hasta 30.000 lts',
  revestimiento_ceramico_bali: 'cerámico importado de brasil símil piedra bali',
  revestimiento_piedra_bali: 'piedra bali importada',
  travertino_rustico_exterior: 'mármol travertino rústico',
  travertino_pulido_interior: 'mármol travertino pulido taponado',
  cerco_perimetral: 'aluminio y lona microperforada',
};

function loadCatalog(){
  try{
    const raw = localStorage.getItem(K_CATALOG);
    const saved = raw ? JSON.parse(raw) : [];
    // Auto-merge: si agregamos un ítem nuevo al modelo estándar (ej. Luces) después de que
    // ya guardaste tu catálogo, antes se quedaba invisible para siempre. Ahora, cualquier
    // ítem del modelo estándar que falte en tu catálogo guardado se agrega solo — reconociendo
    // por slug, o por un fragmento de texto estable (para catálogos guardados antes de que
    // existiera "slug", o con la descripción retocada) — sin tocar tus precios ni tildes ya guardados.
    const merged = saved.slice();
    const existeYa = (def) => merged.some(o => {
      if(def.slug && o.slug === def.slug) return true;
      const frag = LEGACY_MATCH_FRAGMENTS[def.slug];
      if(frag && (o.desc||'').toLowerCase().includes(frag)) return true;
      if(!def.slug && o.desc === def.desc) return true;
      return false;
    });
    let seAgregoAlgo = false;
    defaultOptionales.forEach(def => {
      if(!existeYa(def)){ merged.push({...def, id:cid()}); seAgregoAlgo = true; }
    });
    state.opcionales = merged.length ? merged : defaultOptionales;
    if(seAgregoAlgo){
      try{ localStorage.setItem(K_CATALOG, JSON.stringify(state.opcionales)); }catch(e){}
    }
  }catch(e){
    state.opcionales = defaultOptionales;
  }
  try{
    const raw2 = localStorage.getItem(K_LEGAL);
    state.legal = raw2 ? raw2 : defaultLegal;
  }catch(e){
    state.legal = defaultLegal;
  }
  try{
    const raw3 = localStorage.getItem(K_FOOTER);
    state.footer = raw3 ? {...defaultFooterFields, ...JSON.parse(raw3)} : {...defaultFooterFields};
  }catch(e){
    state.footer = {...defaultFooterFields};
  }
}

// Aplica el catálogo COMPARTIDO (Supabase) sobre los defaults ya cargados de
// localStorage: precios/descripciones de opcionales (por slug) y los textos fijos/pie
// que alguien dejó como predeterminados con "Guardar para todos". Se corre en el init,
// antes del primer render y antes de cargar un presupuesto de la nube: así los
// presupuestos NUEVOS toman los valores compartidos, pero uno abierto desde el historial
// mantiene los suyos (cargarPresupuestoExterno pisa después). Es la contraparte de
// lectura que faltaba: antes esta tabla solo se escribía y nadie la leía.
async function aplicarCatalogoCompartido(){
  if(!window.obtenerCatalogoCompartido) return;
  let filas;
  try{ filas = await window.obtenerCatalogoCompartido(); }
  catch(e){ console.error('No se pudo leer el catálogo compartido', e); return; }
  if(!Array.isArray(filas)) return;
  for(const fila of filas){
    const clave = fila.clave;
    if(clave === '__legal'){
      if(fila.descripcion != null) state.legal = fila.descripcion;
    } else if(clave.indexOf('__footer_') === 0){
      const campo = clave.slice('__footer_'.length);
      if(campo && fila.descripcion != null && campo in state.footer) state.footer[campo] = fila.descripcion;
    } else {
      const op = state.opcionales.find(o=>o.slug === clave);
      if(op){
        if(fila.precio !== null && fila.precio !== undefined) op.price = fila.precio;
        if(fila.descripcion) op.desc = fila.descripcion;
      }
    }
  }
}

// Botón "Guardar como predeterminado para todos" (sección Textos fijos): empuja el
// texto legal + todos los campos del pie al catálogo compartido de una sola vez.
async function guardarTextosParaTodos(){
  const flash = document.getElementById('save-textos-flash');
  const btn = document.getElementById('btn-save-textos-todos');
  if(!window.guardarTextosCompartidos){
    if(flash) flash.textContent = 'No disponible.';
    return;
  }
  const entradas = [{ clave:'__legal', descripcion: state.legal || '' }];
  Object.keys(footerFieldIds).forEach(elId=>{
    const campo = footerFieldIds[elId];
    entradas.push({ clave:'__footer_'+campo, descripcion: state.footer[campo] || '' });
  });
  if(btn) btn.disabled = true;
  if(flash){ flash.textContent = 'Guardando...'; flash.style.color = 'var(--primary-dark)'; }
  try{
    const { error } = await window.guardarTextosCompartidos(entradas);
    if(error) throw error;
    if(flash) flash.textContent = 'Guardado para todos ✓';
  }catch(e){
    console.error('No se pudieron guardar los textos compartidos', e);
    if(flash){ flash.textContent = 'Error al guardar'; flash.style.color = 'var(--danger)'; }
  }finally{
    if(btn) btn.disabled = false;
    setTimeout(()=>{ if(flash) flash.textContent=''; }, 2500);
  }
}

function saveCatalog(){
  try{
    localStorage.setItem(K_CATALOG, JSON.stringify(state.opcionales));
    flashSaved();
  }catch(e){ console.error('No se pudo guardar el catálogo', e); }
}

// Popup "actualizar para todos vs. solo este presupuesto" al editar precio/descripción
// de un opcional del catálogo. Se dispara en blur, solo si el valor cambió respecto al
// que tenía cuando se renderizó (data-valor-inicial). "Cancelar" = el cambio ya quedó
// aplicado a este presupuesto nomás (vía el listener 'input', que no se toca acá).
async function confirmarCambioCatalogoOpcional(inputEl, campo){
  const valorInicial = inputEl.dataset.valorInicial ?? '';
  const valorNuevo = inputEl.value;
  inputEl.dataset.valorInicial = valorNuevo; // no volver a preguntar por este mismo cambio
  if(valorNuevo === valorInicial) return;
  const op = state.opcionales.find(o=>o.id===inputEl.dataset.id);
  if(!op || !op.slug || !window.actualizarCatalogoItem || !window.mostrarModalCatalogo) return; // opcionales agregados a mano no tienen clave estable
  const etiqueta = op.desc.length > 44 ? op.desc.slice(0,44)+'…' : op.desc;
  const mensaje = campo==='price'
    ? `Precio de "${etiqueta}": ${valorInicial===''?'sin precio':'$'+valorInicial} → ${valorNuevo===''?'sin precio':'$'+valorNuevo}`
    : `Nueva descripción de "${etiqueta}"`;
  const resultado = await window.mostrarModalCatalogo({
    titulo: '¿Dónde guardar el cambio?',
    mensaje,
    botonPrimario: { texto: 'Guardar en el catálogo' },
    botonSecundario: { texto: 'Solo este presupuesto' }
  });
  if(resultado !== 'primario') return;
  const { error } = await window.actualizarCatalogoItem(op.slug, op.price, op.desc);
  if(error) console.error('No se pudo actualizar el catálogo compartido', error);
}

// Popup "este/todos" al cambiar las fotos de un opcional — misma lógica que precio/
// descripción: el cambio ya está en el documento actual (state.fotosPorOpcional).
// Devuelve true si además hay que guardarlo en el catálogo compartido.
async function confirmarFotosEnCatalogo(cambio){
  if(!window.mostrarModalCatalogo) return true;
  const r = await window.mostrarModalCatalogo({
    titulo: '¿Dónde guardar el cambio?',
    mensaje: cambio==='quitar' ? 'Quitaste una foto de este opcional.' : 'Agregaste fotos a este opcional.',
    botonPrimario: { texto: 'Guardar en el catálogo' },
    botonSecundario: { texto: 'Solo este presupuesto' }
  });
  return r === 'primario';
}

function saveLegal(){
  try{ localStorage.setItem(K_LEGAL, state.legal); }
  catch(e){ console.error('No se pudo guardar el texto legal', e); }
}
function saveFooter(){
  try{ localStorage.setItem(K_FOOTER, JSON.stringify(state.footer)); }
  catch(e){ console.error('No se pudo guardar el pie de página', e); }
}
let flashTimeout;
function flashSaved(){
  const el = document.getElementById('save-flash');
  el.textContent = 'Catálogo guardado ✓';
  clearTimeout(flashTimeout);
  flashTimeout = setTimeout(()=>{ el.textContent=''; }, 1500);
}

/* ---------------- SERIALIZACIÓN DEL PRESUPUESTO (para Guardar en la nube) ---------------- */
function quoteToPlainState(){
  return {
    fecha: state.fecha, cliente: state.cliente, domicilio: state.domicilio,
    localidad: state.localidad, tel: state.tel, email: state.email,
    dimension: state.dimension, validez: state.validez, subtotal: state.subtotal,
    items: state.items,
    // Se guarda por slug (estable entre dispositivos/sesiones) y no por id: el id de cada
    // opcional es aleatorio y se regenera en cada carga del catálogo por defecto mientras
    // no haya nada guardado en localStorage, así que guardar solo el id hacía que los
    // checks tildados de "Opcionales" se vieran destildados al reabrir el presupuesto en
    // otra compu/celular (o incluso en la misma, la primera vez que el catálogo local
    // todavía no tenía ids persistidos). Los opcionales agregados a mano no tienen slug
    // estable, así que para esos el id sigue siendo el único identificador posible.
    opcionalesIncluidos: state.opcionales.filter(o=>o.included===true).map(o=>o.slug || o.id),
    // Los bytes de cada foto viven en IndexedDB (idbPutFoto) para esta copia del navegador,
    // y además en Supabase Storage (storageUrl) para poder restaurarlas en otro dispositivo.
    fotos: state.fotos.map(f=>({ id:f.id, caption:f.caption, width:f.width, height:f.height, storageUrl: f.storageUrl||null })),
    headerVariant: state.headerVariant
  };
}

// Sube a Supabase Storage las fotos que todavía no tengan storageUrl (evita resubir en cada guardado).
async function ensureFotosSubidasANube(){
  if(!window.subirFotoPresupuesto) return;
  for(const f of state.fotos){
    if(f.storageUrl || !f.blob) continue;
    try{
      const result = await window.subirFotoPresupuesto(f.blob);
      if(result && result.url) f.storageUrl = result.url;
    }catch(e){ console.error('No se pudo subir una foto a la nube', e); }
  }
}

// Aplica al state un objeto de presupuesto (viene de la nube, vía cargarPresupuestoExterno) y
// refresca la UI. Antes esto vivía en loadQuote(id), que primero escribía el objeto en
// localStorage bajo una key temporal y lo releía — un rodeo que existía solo porque loadQuote()
// también servía para el ahora-eliminado tab "Guardados" (localStorage). Al sacar ese tab, esta
// función pasa a recibir los datos directo, sin el paso intermedio por localStorage.
async function aplicarPresupuestoAlState(q){
  state.fecha=q.fecha; state.cliente=q.cliente; state.domicilio=q.domicilio;
  state.localidad=q.localidad; state.tel=q.tel; state.email=q.email;
  state.dimension=q.dimension; state.validez=q.validez; state.subtotal=q.subtotal;
  state.items = (q.items||[]).map(it=>({...it, id: it.id||cid()}));
  state.headerVariant = q.headerVariant || 'teal';
  const incluidos = q.opcionalesIncluidos || [];
  // Coincide primero por slug (nuevo formato) y por id como respaldo (presupuestos
  // guardados antes de este fix, o el raro opcional agregado a mano sin slug).
  state.opcionales.forEach(o=>{ o.included = (o.slug && incluidos.includes(o.slug)) || incluidos.includes(o.id); });

  // Traer los bytes reales de cada foto: primero IndexedDB (rápido, esta copia del navegador);
  // si no está (otro dispositivo, o se limpió), caer a la copia en Supabase Storage y cachearla.
  const fotosMeta = q.fotos || [];
  state.fotos = [];
  for(const fm of fotosMeta){
    let blob = await idbGetFoto(fm.id).catch(()=>null);
    if(!blob && fm.storageUrl){
      try{
        const resp = await fetch(fm.storageUrl);
        if(resp.ok){ blob = await resp.blob(); await idbPutFoto(fm.id, blob).catch(()=>{}); }
      }catch(e){ /* sin conexión o foto inexistente: se salteará abajo */ }
    }
    if(!blob) continue; // si por algo se perdió, la salteamos en vez de romper todo
    state.fotos.push({ id: fm.id, caption: fm.caption||'', width: fm.width, height: fm.height, blob, url: URL.createObjectURL(blob), storageUrl: fm.storageUrl||null });
  }
  // Nota: las fotos por opcional NO se tocan acá — son del catálogo compartido
  // (state.fotosPorOpcional), no cambian según qué presupuesto estés viendo.

  renderForm();
  // Colapsá todas las secciones del acordeón (estado inicial por defecto).
  document.querySelectorAll('.acc-item').forEach(it=>it.classList.remove('open'));
  document.querySelectorAll('.acc-head').forEach(h=>h.setAttribute('aria-expanded','false'));
}

// Espera a que termine el arranque de la calculadora (initPromise) para no correr en paralelo
// con seedFotosGeneralesDefaults() y perder las fotos.
async function cargarPresupuestoExterno(datos){
  if(!datos) return;
  try{
    await initPromise;
    await aplicarPresupuestoAlState(datos);
  }catch(e){
    console.error('No se pudo cargar el presupuesto desde la nube', e);
  }
}
window.cargarPresupuestoExterno = cargarPresupuestoExterno;

async function newQuote(){
  state.fecha = todayStr();
  state.cliente=''; state.domicilio=''; state.localidad=''; state.tel=''; state.email='';
  state.dimension = defaultDimension;
  state.subtotal = 0;
  state.items = [];
  state.opcionales.forEach(o=>o.included=false);
  // Nota: NO tocamos state.fotosPorOpcional acá — es el catálogo compartido, persistente,
  // no algo que se reinicie en cada presupuesto nuevo.
  await seedFotosGeneralesDefaults();
  renderForm();
}


function renderForm(){
  document.getElementById('f-fecha').value = state.fecha;
  document.getElementById('f-cliente').value = state.cliente;
  document.getElementById('f-domicilio').value = state.domicilio;
  document.getElementById('f-localidad').value = state.localidad;
  document.getElementById('f-tel').value = state.tel;
  document.getElementById('f-email').value = state.email;
  document.getElementById('f-dimension').value = state.dimension;
  document.getElementById('f-validez').value = state.validez;
  document.getElementById('f-subtotal').value = state.subtotal;
  document.getElementById('f-legal').value = state.legal;
  document.getElementById('f-empresa').value = state.footer.empresa;
  document.getElementById('f-direccion').value = state.footer.direccion;
  document.getElementById('f-telFijo').value = state.footer.telFijo;
  document.getElementById('f-whatsapp').value = state.footer.whatsapp;
  document.getElementById('f-contactoNombre').value = state.footer.contactoNombre;
  document.getElementById('f-contactoCel').value = state.footer.contactoCel;
  document.getElementById('f-email2').value = state.footer.email;
  document.getElementById('f-web').value = state.footer.web;
  document.getElementById('f-facebook').value = state.footer.facebook;
  document.getElementById('f-facebookUrl').value = state.footer.facebookUrl;
  document.getElementById('f-instagram').value = state.footer.instagram;
  document.getElementById('f-instagramUrl').value = state.footer.instagramUrl;
  document.getElementById('f-header-variant').value = state.headerVariant;

  renderItemsList();
  renderOptList();
  renderFotosList();
  renderPreview();
}

function renderFotosList(){
  const wrap = document.getElementById('fotos-list');
  wrap.innerHTML = '';
  if(state.fotos.length===0){
    wrap.innerHTML = '<div class="quote-empty">Sin fotos todavía. Subí una o más con el botón de arriba.</div>';
    return;
  }
  state.fotos.forEach(f=>{
    const row = document.createElement('div');
    row.className = 'foto-item';
    row.innerHTML = `
      <img src="${f.url}" alt="">
      <input type="text" value="${escAttr(f.caption)}" placeholder="Descripción (ej: Revestimiento piedra Bali)" data-id="${f.id}">
      <button class="btn-mini" data-id="${f.id}" title="Quitar">✕</button>`;
    row.querySelector('input').addEventListener('input', e=>{
      const foto = state.fotos.find(x=>x.id===f.id);
      if(foto) foto.caption = e.target.value;
      renderPreview();
    });
    row.querySelector('.btn-mini').addEventListener('click', async ()=>{
      state.fotos = state.fotos.filter(x=>x.id!==f.id);
      await idbDeleteFoto(f.id).catch(()=>{});
      renderFotosList(); renderPreview();
    });
    wrap.appendChild(row);
  });
}

function renderItemsList(){
  const wrap = document.getElementById('items-list');
  wrap.innerHTML = '';
  state.items.forEach(it=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" value="${escAttr(it.desc)}" data-id="${it.id}" data-field="desc" class="item-desc">
      <input type="text" value="${it.price||0}" data-id="${it.id}" data-field="price" class="item-price" inputmode="decimal">
      <button class="btn-mini" data-id="${it.id}" title="Quitar">✕</button>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('.item-desc').forEach(inp=>inp.addEventListener('input', e=>{
    updateItem(e.target.dataset.id,'desc', e.target.value); renderPreview();
  }));
  wrap.querySelectorAll('.item-price').forEach(inp=>inp.addEventListener('input', e=>{
    updateItem(e.target.dataset.id,'price', parseNum(e.target.value)); renderPreview();
  }));
  wrap.querySelectorAll('.btn-mini').forEach(btn=>btn.addEventListener('click', e=>{
    state.items = state.items.filter(i=>i.id!==e.target.dataset.id);
    renderItemsList(); renderPreview();
  }));
}

function renderOptList(){
  const wrap = document.getElementById('opt-list');
  wrap.innerHTML = '';
  state.opcionales.forEach(op=>{
    const block = document.createElement('div');
    block.className = 'opt-block' + (op.included===true ? ' is-included' : '');
    // Ojo: en piscinas el opcional SIEMPRE sale en el documento (a diferencia de
    // cercos/cobertores/revestimientos, que lo ocultan si no está tildado). Acá el
    // checkbox decide si sale con precio o como "No incluye" — por eso la etiqueta
    // es "Con precio" y no "Incluir en este presupuesto".
    block.innerHTML = `
      <div class="opt-top">
        <label class="opt-incluir" title="Tildado = sale con precio en el documento. Destildado = sale igual, pero como 'No incluye'.">
          <input type="checkbox" ${op.included===true?'checked':''} data-id="${op.id}" class="opt-check">
          <span>Con precio</span>
        </label>
        <div class="opt-top-actions">
          <button class="btn-mini opt-del" data-id="${op.id}" title="Quitar este opcional del catálogo">✕</button>
        </div>
      </div>
      <div class="opt-body">
        <label class="opt-f">
          <span class="opt-f-lbl">Descripción</span>
          <textarea data-id="${op.id}" data-field="desc" class="opt-desc" data-valor-inicial="${escAttr(op.desc)}" rows="2">${escAttr(op.desc)}</textarea>
        </label>
        <div class="opt-pricegrid">
          <label class="opt-f">
            <span class="opt-f-lbl">Precio</span>
            <span class="opt-price-wrap"><span class="opt-cur">$</span><input type="text" value="${op.price===null||op.price===undefined?'':op.price}" placeholder="Sin precio" data-id="${op.id}" data-field="price" class="opt-price" inputmode="decimal" data-valor-inicial="${op.price===null||op.price===undefined?'':op.price}"></span>
          </label>
        </div>
      </div>
      <div class="opt-fotos">
        <span class="opt-fotos-lbl">Fotos de este opcional</span>
        <div class="opt-fotos-thumbs" id="opt-fotos-thumbs-${op.id}"></div>
        <label class="opt-add-foto">📷 Agregar fotos<input type="file" accept="image/*" multiple class="opt-foto-input" data-id="${op.id}"></label>
      </div>`;
    wrap.appendChild(block);
    renderOptFotosThumbs(op.id);
  });
  wrap.querySelectorAll('.opt-check').forEach(cb=>cb.addEventListener('change', e=>{
    updateOpt(e.target.dataset.id,'included', e.target.checked);
    const card = e.target.closest('.opt-block'); if(card) card.classList.toggle('is-included', e.target.checked);
    renderPreview();
  }));
  wrap.querySelectorAll('.opt-desc').forEach(inp=>inp.addEventListener('input', e=>{
    updateOpt(e.target.dataset.id,'desc', e.target.value); renderPreview();
  }));
  wrap.querySelectorAll('.opt-desc').forEach(inp=>inp.addEventListener('blur', e=>{
    saveCatalog();
    confirmarCambioCatalogoOpcional(e.target, 'desc');
  }));
  wrap.querySelectorAll('.opt-price').forEach(inp=>inp.addEventListener('input', e=>{
    const v = e.target.value.trim();
    updateOpt(e.target.dataset.id,'price', v===''?null:parseNum(v)); renderPreview();
  }));
  wrap.querySelectorAll('.opt-price').forEach(inp=>inp.addEventListener('blur', e=>{
    saveCatalog();
    confirmarCambioCatalogoOpcional(e.target, 'price');
  }));
  wrap.querySelectorAll('.opt-del').forEach(btn=>btn.addEventListener('click', async ()=>{
    if(!confirm('¿Quitar este opcional del catálogo? Se borra para todas las cotizaciones futuras (esta compu).')) return;
    const opId = btn.dataset.id;
    state.opcionales = state.opcionales.filter(o=>o.id!==opId);
    const fotosDelOp = state.fotosPorOpcional[opId] || [];
    for(const f of fotosDelOp){ await idbDeleteFoto(f.id).catch(()=>{}); }
    delete state.fotosPorOpcional[opId];
    renderOptList(); renderPreview();
    saveCatalog();
    await saveFotosPorOpcional();
  }));
  wrap.querySelectorAll('.opt-foto-input').forEach(inp=>inp.addEventListener('change', async e=>{
    const opId = e.target.dataset.id;
    const files = Array.from(e.target.files || []);
    let fallidas = 0, agregadas = 0;
    for(const file of files){
      try{
        const { blob, width, height } = await resizeImageFile(file, 1400);
        const id = cid();

        await idbPutFoto(id, blob);
        const url = URL.createObjectURL(blob);
        if(!state.fotosPorOpcional[opId]) state.fotosPorOpcional[opId] = [];
        state.fotosPorOpcional[opId].push({ id, url, blob, caption:'', width, height });
        renderOptFotosThumbs(opId);
        renderPreview();
        agregadas++;
      }catch(err){ console.error('No se pudo procesar la foto', err); fallidas++; }
    }
    e.target.value = '';
    avisarFotosFallidas(fallidas);
    if(agregadas > 0 && await confirmarFotosEnCatalogo('agregar')) await saveFotosPorOpcional();
  }));
}

function renderOptFotosThumbs(opId){
  const wrap = document.getElementById('opt-fotos-thumbs-'+opId);
  if(!wrap) return;
  const fotos = state.fotosPorOpcional[opId] || [];
  wrap.innerHTML = fotos.map(f=>`
    <div class="opt-foto-thumb">
      <img src="${f.url}" alt="">
      <button data-op="${opId}" data-foto="${f.id}" title="Quitar">✕</button>
    </div>`).join('');
  wrap.querySelectorAll('button').forEach(btn=>btn.addEventListener('click', async ()=>{
    const opIdBtn = btn.dataset.op, fotoId = btn.dataset.foto;
    state.fotosPorOpcional[opIdBtn] = (state.fotosPorOpcional[opIdBtn]||[]).filter(f=>f.id!==fotoId);
    renderOptFotosThumbs(opIdBtn);
    renderPreview();
    if(await confirmarFotosEnCatalogo('quitar')){
      await idbDeleteFoto(fotoId).catch(()=>{});
      await saveFotosPorOpcional();
    }
  }));
}

function updateItem(id, field, val){
  const it = state.items.find(i=>i.id===id);
  if(it) it[field]=val;
}
function updateOpt(id, field, val){
  const op = state.opcionales.find(i=>i.id===id);
  if(op) op[field]=val;
}
function parseNum(v){
  const n = parseFloat(String(v).replace(/[^\d.-]/g,''));
  return isNaN(n)?0:n;
}
function escAttr(s){
  return String(s||'').replace(/"/g,'&quot;');
}
function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------------- RENDER: PREVIEW ---------------- */
// Convierte texto plano con saltos de línea en HTML con <br> explícitos.
// A propósito NO usamos CSS white-space:pre-wrap para el texto legal/dimensión/pie:
// Word (al abrir el .doc y guardarlo) no respeta esa propiedad de forma confiable y
// termina uniendo todo en un solo párrafo pegoteado. Con <br> explícitos se ve igual
// en pantalla/PDF y además queda bien en Word.
function textToBrHtml(text){
  return escHtml(text||'').split('\n').map(l=>l===''?'&nbsp;':l).join('<br>');
}

function onlyDigits(s){ return (s||'').replace(/\D/g,''); }

function renderFooterHtml(){
  const f = state.footer;
  const lines = [];
  lines.push(`<b>${escHtml(f.empresa)}</b>`);

  if(f.direccion){
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Playa y Sol S.A.S.') + '&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA';
    lines.push(`Dirección: <a href="${mapsUrl}" target="_blank">${escHtml(f.direccion)}</a>`);
  }
  if(f.telFijo){
    lines.push(`Tel: <a href="tel:${onlyDigits(f.telFijo)}">${escHtml(f.telFijo)}</a>`);
  }
  if(f.contactoNombre || f.contactoCel){
    const cel = f.contactoCel ? `<a href="tel:${onlyDigits(f.contactoCel)}">${escHtml(f.contactoCel)}</a>` : '';
    lines.push(`Contacto: ${escHtml(f.contactoNombre)}${f.contactoCel?' - Cel. '+cel:''}`);
  }
  if(f.whatsapp){
    lines.push(`WhatsApp: <a href="https://wa.me/549${onlyDigits(f.whatsapp)}" target="_blank">${escHtml(f.whatsapp)}</a>`);
  }
  if(f.email){
    lines.push(`E-mail: <a href="mailto:${escAttr(f.email)}">${escHtml(f.email)}</a>`);
  }
  if(f.web){
    const webUrl = f.web.startsWith('http') ? f.web : 'https://' + f.web;
    lines.push(`Web: <a href="${webUrl}" target="_blank">${escHtml(f.web)}</a>`);
  }
  if(f.facebook){
    lines.push(f.facebookUrl
      ? `Facebook: <a href="${escAttr(f.facebookUrl)}" target="_blank">${escHtml(f.facebook)}</a>`
      : `Facebook: ${escHtml(f.facebook)}`);
  }
  if(f.instagram){
    lines.push(f.instagramUrl
      ? `Instagram: <a href="${escAttr(f.instagramUrl)}" target="_blank">${escHtml(f.instagram)}</a>`
      : `Instagram: ${escHtml(f.instagram)}`);
  }
  return lines.join('<br>');
}

// Bloque de fotos sin título (para intercalar debajo de un opcional puntual, o reutilizar
// en la galería general). photoSrc: función (foto)=>string con el src a usar.
function renderItemPhotosBlock(fotos, photoSrc, forExport){
  if(!fotos || !fotos.length) return '';
  if(!forExport){
    let html = `<div class="photo-grid" style="margin:8px 0 14px;">`;
    fotos.forEach(f=>{
      html += `<figure><img src="${photoSrc(f)}" alt="">`;
      if(f.caption) html += `<figcaption>${escHtml(f.caption)}</figcaption>`;
      html += `</figure>`;
    });
    html += `</div>`;
    return html;
  }
  const COL_W = 250; // ancho seguro para A4 con margenes de Word (evita overflow/corte de imagen)
  const dims = f=>{
    const w = COL_W;
    const h = (f.width && f.height) ? Math.round(COL_W * f.height / f.width) : Math.round(COL_W*0.75);
    return {w,h};
  };
  let rows = '';
  for(let i=0; i<fotos.length; i+=2){
    const f1 = fotos[i], f2 = fotos[i+1];
    const d1 = dims(f1);
    rows += '<tr>';
    rows += `<td style="width:50%;padding:6px;text-align:center;"><img src="${photoSrc(f1)}" width="${d1.w}" height="${d1.h}"><br><span style="font-size:9pt;color:#5C7480;">${escHtml(f1.caption||'')}</span></td>`;
    if(f2){
      const d2 = dims(f2);
      rows += `<td style="width:50%;padding:6px;text-align:center;"><img src="${photoSrc(f2)}" width="${d2.w}" height="${d2.h}"><br><span style="font-size:9pt;color:#5C7480;">${escHtml(f2.caption||'')}</span></td>`;
    } else {
      rows += '<td></td>';
    }
    rows += '</tr>';
  }
  return `<table style="width:100%;border-collapse:collapse;margin:6px 0 10px;">${rows}</table>`;
}

// Medidas de la pileta como lista de renglones cortos en vez de un párrafo corrido —
// se divide el texto libre (tal cual lo tipeó el usuario) por saltos de línea y por
// oración (". "), sin reordenar ni inventar contenido. Se reusa igual en el export a
// Word (docxDimensionCard más abajo) para que ambas vistas queden consistentes.
function splitDimensionLines(text){
  return String(text||'')
    .split(/\n+/)
    .flatMap(line => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map(s => s.trim())
    .filter(Boolean);
}

function renderDimensionCard(text){
  const lineas = splitDimensionLines(text);
  if(!lineas.length) return `<div class="dim-card empty-note">(sin datos)</div>`;
  const items = lineas.map(l => `<li>${escHtml(l)}</li>`).join('');
  return `<div class="dim-card"><ul class="dim-list">${items}</ul></div>`;
}

// Galería general (tab "Fotos", no atada a un opcional puntual)
function renderPhotosHtml(photoSrc, forExport){
  if(!state.fotos.length) return '';
  const title = forExport
    ? `<div style="font-weight:bold;text-decoration:underline;margin:22px 0 8px;">Fotos ilustrativas</div>`
    : `<div class="photos-title">Fotos ilustrativas</div>`;
  return title + renderItemPhotosBlock(state.fotos, photoSrc, forExport);
}

function applyHeaderVariant(){
  const v = HEADER_VARIANTS[state.headerVariant] || HEADER_VARIANTS.teal;
  const bg = document.getElementById('sheet-header-bg');
  const img = document.getElementById('sheet-logo-img');
  if(bg) bg.style.background = v.color;
  if(img) img.src = v.img;
}

// Genera las filas de precio. En pantalla usa flexbox (.price-line). En el export a Word
// usa una <table> real: el "float:right" que usamos en pantalla para alinear el precio
// es justamente lo que Word interpreta mal y hace que el texto se superponga.
function buildPriceRows(rows, forExport){
  if(!forExport){
    return rows.map(r=>`<div class="price-line ${r.cls||''}"><span>${r.descHtml}</span><span>${r.priceHtml}</span></div>`).join('');
  }
  const trs = rows.map(r=>{
    const isTotal = r.cls==='total';
    const isSubtotal = r.cls==='subtotal';
    const bold = isTotal || isSubtotal ? 'font-weight:bold;' : '';
    const fontSize = isTotal ? 'font-size:13pt;' : 'font-size:11pt;';
    const borderTop = isTotal ? 'border-top:2px solid #123F49;' : '';
    const cellStyle = `${fontSize}${bold}${borderTop}border-bottom:1px dotted #ccc;padding:4px 6px;`;
    return `<tr><td style="${cellStyle}">${r.descHtml}</td><td align="right" style="${cellStyle}white-space:nowrap;">${r.priceHtml}</td></tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;">${trs}</table>`;
}

// Constructor único del cuerpo del documento, usado tanto para la vista en pantalla/PDF
// como para el export a Word — así evitamos mantener dos versiones que se desincronizan,
// y evitamos el truco frágil de "retocar con regex" el HTML ya renderizado.
function buildDocumentBody({ forExport=false, photoSrc } = {}){
  const total = Number(state.subtotal||0) + state.items.reduce((s,i)=>s+Number(i.price||0),0);
  const hayIncluidos = state.items.length > 0;
  // Los opcionales SIEMPRE se muestran TODOS (catálogo completo), con sus fotos si tienen.
  // Lo que varía por presupuesto es si están tildados como incluidos en ESTA piscina:
  // tildado + con precio → se muestra el precio; no tildado (o sin precio cargado) → "No incluye".
  const todosOpt = state.opcionales;

  let html = `<div class="doc-title">Presupuesto de construcción piscina</div>`;
  html += `<div class="meta-grid">`;
  html += `<div class="meta-line"><b>Fecha:</b> ${escHtml(state.fecha)}</div>`;
  html += `<div class="meta-line"><b>Señor/Sra:</b> ${escHtml(state.cliente)||(forExport?'':'<span class="empty-note">(sin datos)</span>')}</div>`;
  html += `<div class="meta-line"><b>Domicilio:</b> ${escHtml(state.domicilio)}</div>`;
  html += `<div class="meta-line"><b>Localidad:</b> ${escHtml(state.localidad)}</div>`;
  html += `<div class="meta-line"><b>Tel:</b> ${escHtml(state.tel)}</div>`;
  html += `<div class="meta-line"><b>Email:</b> ${escHtml(state.email)}</div>`;
  html += `</div>`;

  html += `<div class="section-heading">Dimensión piscina</div>`;
  html += renderDimensionCard(state.dimension);

  const incluidosRows = [{ descHtml:'SUBTOTAL', priceHtml:fmt(state.subtotal), cls:'subtotal' }];
  if(hayIncluidos){
    state.items.forEach(it=>{
      incluidosRows.push({ descHtml:escHtml(it.desc), priceHtml:fmt(it.price) });
    });
    incluidosRows.push({ descHtml:'TOTAL', priceHtml:fmt(total), cls:'total' });
  }
  html += `<div class="included-block">${buildPriceRows(incluidosRows, forExport)}</div>`;

  if(todosOpt.length){
    html += `<div class="opt-title">Opcionales</div>`;
    todosOpt.forEach(op=>{
      const priceHtml = (op.included===true && op.price!==null && op.price!==undefined) ? fmt(op.price) : 'No incluye';
      const rowHtml = buildPriceRows([{ descHtml: escHtml(op.desc), priceHtml }], forExport);
      const fotosOp = state.fotosPorOpcional[op.id];
      if(fotosOp && fotosOp.length){
        html += `<div class="opt-card">${rowHtml}${renderItemPhotosBlock(fotosOp, photoSrc, forExport)}</div>`;
      } else {
        html += rowHtml;
      }
    });
  }

  html += `<div class="validity">El presente presupuesto tiene una validez de ${escHtml(state.validez)} días.</div>`;

  html += `<div class="legal-block">${textToBrHtml(state.legal)}</div>`;

  html += renderPhotosHtml(photoSrc, forExport);

  html += `<div class="footer-block">${renderFooterHtml()}</div>`;

  return html;
}

function renderPreview(){
  applyHeaderVariant();
  const html = buildDocumentBody({ forExport:false, photoSrc: f=>f.url });

  document.getElementById('sheet-body').innerHTML = html;
}

/* ---------------- EVENTS: form fields ---------------- */
function bindSimpleField(id, stateKey){
  document.getElementById(id).addEventListener('input', e=>{
    state[stateKey] = e.target.value;
    renderPreview();
  });
}
bindSimpleField('f-fecha','fecha');
bindSimpleField('f-cliente','cliente');
bindSimpleField('f-domicilio','domicilio');
bindSimpleField('f-localidad','localidad');
bindSimpleField('f-tel','tel');
bindSimpleField('f-email','email');
bindSimpleField('f-dimension','dimension');
bindSimpleField('f-validez','validez');

document.getElementById('f-subtotal').addEventListener('input', e=>{
  state.subtotal = parseNum(e.target.value);
  renderPreview();
});
document.getElementById('f-legal').addEventListener('input', e=>{
  state.legal = e.target.value;
  renderPreview();
});
document.getElementById('f-legal').addEventListener('blur', saveLegal);

const footerFieldIds = {
  'f-empresa':'empresa', 'f-direccion':'direccion', 'f-telFijo':'telFijo',
  'f-whatsapp':'whatsapp', 'f-contactoNombre':'contactoNombre', 'f-contactoCel':'contactoCel',
  'f-email2':'email', 'f-web':'web', 'f-facebook':'facebook', 'f-facebookUrl':'facebookUrl',
  'f-instagram':'instagram', 'f-instagramUrl':'instagramUrl'
};
Object.keys(footerFieldIds).forEach(elId=>{
  const key = footerFieldIds[elId];
  const el = document.getElementById(elId);
  el.addEventListener('input', e=>{ state.footer[key] = e.target.value; renderPreview(); });
  el.addEventListener('blur', saveFooter);
});

const btnSaveTextosTodos = document.getElementById('btn-save-textos-todos');
if(btnSaveTextosTodos) btnSaveTextosTodos.addEventListener('click', guardarTextosParaTodos);

document.getElementById('f-header-variant').addEventListener('change', e=>{
  state.headerVariant = e.target.value;
  renderPreview();
});

function resizeImageFile(file, maxDim){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = ()=>{
      let { width, height } = img;
      if(width > maxDim || height > maxDim){
        const ratio = Math.min(maxDim/width, maxDim/height);
        width = Math.round(width*ratio);
        height = Math.round(height*ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob=>{
        URL.revokeObjectURL(url);
        resolve({ blob, width, height });
      }, 'image/jpeg', 0.85);
    };
    img.onerror = (e)=>{ URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

document.getElementById('foto-input').addEventListener('change', async e=>{
  const files = Array.from(e.target.files || []);
  let fallidas = 0;
  for(const file of files){
    try{
      // Redimensionamos a un máximo de 1400px de lado: se ve nítido en pantalla/PDF/Word
      // y evita fotos de celular de varios MB que rompen el diseño o llenan el almacenamiento.
      const { blob, width, height } = await resizeImageFile(file, 1400);
      const id = cid();
      await idbPutFoto(id, blob);
      const url = URL.createObjectURL(blob);
      state.fotos.push({ id, url, blob, caption:'', width, height });
      renderFotosList();
      renderPreview();
    }catch(err){
      console.error('No se pudo procesar la foto', err);
      fallidas++;
    }
  }
  e.target.value = ''; // permite volver a elegir el mismo archivo si hace falta
  avisarFotosFallidas(fallidas);
});

document.getElementById('btn-add-item').addEventListener('click', ()=>{
  state.items.push({id:cid(), desc:'Nuevo ítem', price:0});
  renderItemsList(); renderPreview();
});
document.getElementById('btn-check-all').addEventListener('click', ()=>{
  state.opcionales.forEach(o=>o.included=true);
  renderOptList(); renderPreview();
});
document.getElementById('btn-uncheck-all').addEventListener('click', ()=>{
  state.opcionales.forEach(o=>o.included=false);
  renderOptList(); renderPreview();
});
document.getElementById('btn-add-opt').addEventListener('click', ()=>{
  state.opcionales.push({id:cid(), desc:'Nuevo opcional', price:0});
  renderOptList(); renderPreview(); saveCatalog();
});

document.getElementById('btn-new-quote').addEventListener('click', ()=>{
  if(state.cliente.trim() && !confirm('¿Limpiar el formulario y empezar de cero? Si no guardaste el presupuesto actual, se pierde lo tipeado.')) return;
  newQuote();
});


/* ================================================================
   GENERADOR DE WORD REAL (.docx) — reemplaza el truco viejo de
   "HTML guardado con extensión .doc". Ese truco lo abre bien Word,
   pero herramientas de conversión (iLovePDF, etc.) esperan un .docx
   de verdad y no entienden imágenes en base64 dentro de ese HTML —
   por eso las fotos se rompían al pasar a PDF. Con docx.js armamos
   un archivo .docx binario real, compatible con cualquier conversor.
================================================================= */
/* ================================================================
   GENERADOR DE WORD REAL (.docx) — reemplaza el truco viejo de
   "HTML guardado con extensión .doc". Ese truco lo abre bien Word,
   pero herramientas de conversión (iLovePDF, etc.) esperan un .docx
   de verdad y no entienden imágenes en base64 dentro de ese HTML —
   por eso las fotos se rompían al pasar a PDF. Con docx.js armamos
   un archivo .docx binario real, compatible con cualquier conversor.
================================================================= */
/* La librería docx pesa ~370 KB y viene de un CDN. Antes se bajaba en TODA carga
   de TODA calculadora — y peor: el script de la calculadora no arrancaba hasta que
   terminaba de bajar, así que el formulario tardaba en aparecer por una librería
   que solo hace falta si alguien aprieta "Word". Ahora se pide recién en el primer
   export, y estos bindings se completan en ese momento. */
let Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, ExternalHyperlink, AlignmentType, BorderStyle, WidthType,
    ShadingType, PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo,
    PositionalTabLeader, VerticalAlign, PageOrientation,
    convertMillimetersToTwip;

const DOCX_PAGE_WIDTH_MM = 160; // ancho útil de página (A4 con márgenes ~2.5cm)
let DOCX_CONTENT_WIDTH_TWIP, NO_BORDER, NO_BORDERS;

const DOCX_CDN = 'https://cdn.jsdelivr.net/npm/docx@8.6.0/build/index.umd.min.js';
let docxPromise = null;

function cargarDocx(){
  if(docxPromise) return docxPromise;
  docxPromise = new Promise((resolve, reject)=>{
    if(window.docx) return resolve(window.docx);
    const s = document.createElement('script');
    s.src = DOCX_CDN;
    s.onload = ()=> window.docx ? resolve(window.docx)
      : reject(new Error('El generador de Word cargó incompleto.'));
    s.onerror = ()=> reject(new Error('No se pudo descargar el generador de Word. Revisá la conexión.'));
    document.head.appendChild(s);
  }).then(lib=>{
    ({ Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
       ImageRun, ExternalHyperlink, AlignmentType, BorderStyle, WidthType,
       ShadingType, PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo,
       PositionalTabLeader, VerticalAlign, PageOrientation,
       convertMillimetersToTwip } = lib);
    DOCX_CONTENT_WIDTH_TWIP = convertMillimetersToTwip(DOCX_PAGE_WIDTH_MM);
    NO_BORDER  = { style: BorderStyle.NONE, size:0, color:"FFFFFF" };
    NO_BORDERS = { top:NO_BORDER, bottom:NO_BORDER, left:NO_BORDER, right:NO_BORDER };
    return lib;
  }).catch(err=>{
    docxPromise = null; // permite reintentar si fue un problema de red puntual
    throw err;
  });
  return docxPromise;
}
const DOCX_NAVY = "1B3A5C"; // navy de marca — antes usaba un teal oscuro (00566A) distinto al del resto del portal
const DOCX_TEAL = "00829C";
const DOCX_TEXT = "1C2B33";
const DOCX_MUTED = "5C7480"; // mismo gris que --muted en -calc.css, para el pie del documento
const DOCX_NAVY_SOFT = "EEF2F6";
const DOCX_BORDER_SOFT = "E1E7EC";

async function blobToUint8Array(blob){
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}
async function dataUrlToUint8Array(dataUrl){
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
// Para incrustar en el .docx: siempre reconvertimos a JPEG liviano vía canvas,
// así garantizamos que el tipo declarado (jpg) coincida siempre con los bytes reales,
// sin importar el formato original de la foto (png, heic-ya-convertido, etc.)
function blobToConstrainedUint8Array(blob, maxDim=1100, quality=0.78){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      let w = img.naturalWidth, h = img.naturalHeight;
      if(w > maxDim || h > maxDim){
        const scale = maxDim / Math.max(w,h);
        w = Math.round(w*scale); h = Math.round(h*scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      canvas.toBlob(async (outBlob)=>{
        const buf = await outBlob.arrayBuffer();
        resolve({ bytes: new Uint8Array(buf), width:w, height:h });
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function docxTitle(text){
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      border: { bottom: { color: DOCX_TEAL, space: 6, style: BorderStyle.SINGLE, size: 12 } },
      children: [ new TextRun({ text, bold:true, size:27, color:DOCX_NAVY, allCaps:true, characterSpacing:20 }) ]
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] })
  ];
}

function docxMetaLine(label, value){
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: label + ' ', bold:true, underline:{}, size:22, color:DOCX_TEXT }),
      new TextRun({ text: value || '', size:22, color:DOCX_TEXT }),
    ]
  });
}

// Ficha de datos del cliente: agrupa las líneas de meta (fecha/cliente/domicilio/etc.)
// en una sola celda con fondo suave, en vez de líneas sueltas — más fácil de escanear
// y separa visualmente "datos del cliente" del resto del documento.
function docxMetaCard(pares){
  const paras = pares
    .filter(p => p.value)
    .map(p => new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: p.label + ' ', bold:true, size:20, color:DOCX_NAVY }),
        new TextRun({ text: p.value, size:20, color:DOCX_TEXT }),
      ]
    }));
  return new Table({
    width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
    columnWidths:[DOCX_CONTENT_WIDTH_TWIP],
    rows:[ new TableRow({ children:[ new TableCell({
      width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
      shading:{ fill: DOCX_NAVY_SOFT, type: ShadingType.CLEAR },
      margins:{ top:180, bottom:140, left:220, right:220 },
      children: paras
    }) ] }) ]
  });
}

// (splitDimensionLines está definida más arriba, junto a renderDimensionCard — la
// versión HTML — y se reusa acá para que Word y pantalla/PDF partan el texto igual)
function docxDimensionCard(text){
  const lineas = splitDimensionLines(text);
  if(!lineas.length) return null;
  const paras = lineas.map(l => new Paragraph({
    spacing: { after: 60 },
    indent: { left: 160 },
    bullet: { level: 0 },
    children: [ new TextRun({ text: l, size:21, color:DOCX_TEXT }) ]
  }));
  return new Table({
    width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
    columnWidths:[DOCX_CONTENT_WIDTH_TWIP],
    rows:[ new TableRow({ children:[ new TableCell({
      width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
      borders: { top:NO_BORDER, bottom:NO_BORDER, right:NO_BORDER,
        left:{ style:BorderStyle.SINGLE, size:18, color:DOCX_NAVY } },
      margins:{ top:140, bottom:140, left:220, right:160 },
      children: paras
    }) ] }) ]
  });
}

function docxDivider(){
  return new Paragraph({
    spacing: { before: 100, after: 160 },
    border: { bottom: { color:"CCCCCC", space:1, style:BorderStyle.SINGLE, size:4 } },
    children: []
  });
}

function docxSectionTitle(text){
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    border: { bottom: { color: DOCX_TEAL, space:2, style:BorderStyle.SINGLE, size:8 } },
    children: [ new TextRun({ text, bold:true, size:20, color:DOCX_NAVY, allCaps:true, characterSpacing:10 }) ]
  });
}

function docxBodyText(text, {size=22, italic=false} = {}){
  // respeta saltos de línea igual que textToBrHtml — nunca usar \n dentro de un TextRun
  const paras = String(text||'').split('\n');
  return paras.map(line => new Paragraph({
    spacing: { after: 40 },
    children: [ new TextRun({ text: line, size, italic, color:DOCX_TEXT }) ]
  }));
}

// Línea de precio con puntos guía reales de Word (PositionalTab), igual al efecto
// del subrayado punteado del HTML — nunca usar tabStops+"\t" literal, no es confiable.
function docxPriceLine(desc, price, {bold=false, big=false, topRule=false} = {}){
  const size = big ? 26 : 22;
  const color = big ? DOCX_NAVY : DOCX_TEXT;
  const opts = {
    spacing: { after: 80 },
    children: [
      new TextRun({ text: desc, bold, size, color }),
      new TextRun({ bold, size, color, children: [
        new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.DOT }),
        price,
      ] }),
    ]
  };
  if(topRule){ opts.border = { top: { color: DOCX_NAVY, space:6, style:BorderStyle.DOUBLE, size:8 } }; }
  return new Paragraph(opts);
}

function docxValidity(dias){
  return new Paragraph({
    spacing: { before:160, after:80 },
    children: [ new TextRun({ text: `El presente presupuesto tiene una validez de ${dias} días.`, bold:true, size:22, color:DOCX_TEXT }) ]
  });
}

/* NO_BORDER / NO_BORDERS se declaran arriba y se completan en cargarDocx():
   dependen de BorderStyle, que recién existe cuando la librería bajó. */

// Fotos como objetos inline independientes: cada foto va en su propio párrafo
// centrado, NO en celdas de una tabla de 2 columnas. Así, al redimensionar una foto
// en Word, las demás no se modifican — antes compartían el ancho de columna de la
// tabla y agrandar una arrastraba a la de al lado.
function docxPhotoNodes(fotos, imgBytesById){
  const nodes = [];
  for(const f of (fotos||[])){
    const info = imgBytesById[f.id];
    if(info && info.bytes){
      const ratio = (info.height && info.width) ? info.height/info.width : 0.75;
      const w = 400, h = Math.round(w*ratio);
      nodes.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: f.caption ? 20 : 140 },
        keepLines: true,
        children: [ new ImageRun({ type:'jpg', data: info.bytes, transformation:{ width:w, height:h },
          altText:{ title:'Foto', description:'Foto ilustrativa', name:'Foto' } }) ]
      }));
    }
    if(f.caption){
      nodes.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing:{ after:140 }, children:[ new TextRun({ text:f.caption, italic:true, size:18, color:"555555" }) ] }));
    }
  }
  return nodes;
}

// Galería general (título + fotos) para el bloque "Fotos ilustrativas" al final.
function docxPhotoGallery(fotos, imgBytesById){
  if(!fotos || !fotos.length) return [];
  return [ docxSectionTitle('Fotos ilustrativas'), ...docxPhotoNodes(fotos, imgBytesById) ];
}

// Ficha de producto para un opcional (con o sin fotos): descripción + precio y, si tiene,
// sus fotos, todo dentro de una sola celda con borde y fondo suave — reemplaza el patrón
// anterior de "línea de precio suelta + fotos pegadas debajo sin agrupar visualmente".
function docxOptCard(desc, priceTxt, fotosOp, imgBytesById){
  const sinPrecio = priceTxt === 'No incluye';
  const cellChildren = [
    new Paragraph({
      spacing: { after: (fotosOp && fotosOp.length) ? 120 : 0 },
      children: [
        new TextRun({ text: desc, bold:true, size:21, color:DOCX_TEXT }),
        new TextRun({ bold:true, size:21, color: sinPrecio ? '8B98A3' : DOCX_NAVY, children: [
          new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE }),
          priceTxt,
        ] }),
      ]
    })
  ];
  if(fotosOp && fotosOp.length){
    docxPhotoNodes(fotosOp, imgBytesById).forEach(n => cellChildren.push(n));
  }
  const softBorder = { style:BorderStyle.SINGLE, size:4, color:DOCX_BORDER_SOFT };
  return new Table({
    width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
    columnWidths:[DOCX_CONTENT_WIDTH_TWIP],
    rows:[ new TableRow({ children:[ new TableCell({
      width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
      borders: { top:softBorder, bottom:softBorder, left:softBorder, right:softBorder },
      shading:{ fill:'FAFBFC', type: ShadingType.CLEAR },
      margins:{ top:160, bottom:160, left:200, right:200 },
      children: cellChildren
    }) ] }) ]
  });
}

function docxHyperlinkLine(label, displayText, url){
  return new Paragraph({
    spacing:{ after:40 },
    children:[
      new TextRun({ text: label, size:20, color:DOCX_TEXT }),
      new ExternalHyperlink({ link:url, children:[ new TextRun({ text:displayText, size:20, color:"0563C1", underline:{} }) ] })
    ]
  });
}

// Pie de documento tradicional: alineado a la izquierda (no centrado), en el navy
// de marca, tipografía discreta (19=9.5pt vs los 20-22 del cuerpo). Se conserva el
// aire de sobra arriba y el divisor sutil para que no quede flotando pegado al
// contenido, pero color y alineación vuelven al formato de pie clásico. Links en
// navy subrayado para distinguirse del texto plano. Igual que .footer-block (CSS).
function docxFooter(f, footerColor){
  // keepNext:true en cada línea (menos la última) evita que Word corte el pie a la mitad
  // al pasar de página — si no entra completo, empuja todo el bloque a la página siguiente.
  function hlLine(label, displayText, url, keepNext){
    return new Paragraph({
      spacing:{ after:40 }, keepLines:true, keepNext,
      children:[
        new TextRun({ text: label, size:19, color:DOCX_NAVY }),
        new ExternalHyperlink({ link:url, children:[ new TextRun({ text:displayText, size:19, color:DOCX_NAVY, underline:{} }) ] })
      ]
    });
  }
  function textLine(text, keepNext){
    return new Paragraph({ spacing:{after:40}, keepLines:true, keepNext, children:[ new TextRun({ text, size:19, color:DOCX_NAVY }) ] });
  }

  const paras = [];
  paras.push(new Paragraph({ spacing:{before:280, after:80}, keepLines:true, keepNext:true,
    border:{ top:{color:"E1E7EC", space:10, style:BorderStyle.SINGLE, size:6} },
    children:[ new TextRun({ text:f.empresa||'', bold:true, size:21, color:DOCX_NAVY, characterSpacing:6 }) ] }));
  if(f.direccion){
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Playa y Sol S.A.S.') + '&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA';
    paras.push(hlLine('Dirección: ', f.direccion, mapsUrl, true));
  }
  if(f.telFijo){
    paras.push(hlLine('Tel: ', f.telFijo, 'tel:'+f.telFijo.replace(/\D/g,''), true));
  }
  if(f.contactoNombre || f.contactoCel){
    const txt = 'Contacto: ' + (f.contactoNombre||'') + (f.contactoCel ? ' - Cel. '+f.contactoCel : '');
    paras.push(textLine(txt, true));
  }
  if(f.whatsapp){
    paras.push(hlLine('WhatsApp: ', f.whatsapp, 'https://wa.me/549'+f.whatsapp.replace(/\D/g,''), true));
  }
  if(f.email){
    paras.push(hlLine('E-mail: ', f.email, 'mailto:'+f.email, true));
  }
  if(f.web){
    const webUrl = f.web.startsWith('http') ? f.web : 'https://'+f.web;
    paras.push(hlLine('Web: ', f.web, webUrl, true));
  }
  if(f.facebook){
    paras.push(f.facebookUrl ? hlLine('Facebook: ', f.facebook, f.facebookUrl, true) : textLine('Facebook: '+f.facebook, true));
  }
  if(f.instagram){
    // última línea: sin keepNext (nada que mantener después de esto)
    paras.push(f.instagramUrl ? hlLine('Instagram: ', f.instagram, f.instagramUrl, false) : textLine('Instagram: '+f.instagram, false));
  }
  return paras;
}

/* ---------------- EXPORT WORD (.doc) ---------------- */
async function buildDocxSections(){
  const total = Number(state.subtotal||0) + state.items.reduce((s,i)=>s+Number(i.price||0),0);
  const hayIncluidos = state.items.length > 0;
  const todosOpt = state.opcionales;
  const v = HEADER_VARIANTS[state.headerVariant] || HEADER_VARIANTS.teal;

  const headerBytes = await dataUrlToUint8Array(v.img);
  const todasLasFotos = [...state.fotos, ...Object.values(state.fotosPorOpcional).flat()];
  const imgBytesById = {};
  for(const f of todasLasFotos){
    imgBytesById[f.id] = await blobToConstrainedUint8Array(f.blob);
  }

  const children = [];

  children.push(new Table({
    width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
    columnWidths:[DOCX_CONTENT_WIDTH_TWIP],
    rows:[ new TableRow({ children:[ new TableCell({
      width:{ size:DOCX_CONTENT_WIDTH_TWIP, type:WidthType.DXA },
      shading:{ fill: v.color.replace('#',''), type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins:{ top:300, bottom:300 },
      children:[ new Paragraph({ alignment:AlignmentType.CENTER,
        children:[ new ImageRun({ type:'png', data:headerBytes, transformation:{ width:130, height:130 },
          altText:{ title:'Logo', description:'Playa y Sol', name:'Logo' } }) ] }) ]
    }) ] }) ]
  }));
  children.push(new Paragraph({ spacing:{after:200}, children:[] }));

  children.push(...docxTitle('Presupuesto de construcción piscina'));
  children.push(docxMetaCard([
    { label:'Fecha:', value: state.fecha },
    { label:'Señor/Sra:', value: state.cliente },
    { label:'Domicilio:', value: state.domicilio },
    { label:'Localidad:', value: state.localidad },
    { label:'Tel:', value: state.tel },
    { label:'Email:', value: state.email },
  ]));
  children.push(new Paragraph({ spacing:{after:220}, children:[] }));

  children.push(docxSectionTitle('Dimensión piscina'));
  const dimCard = docxDimensionCard(state.dimension);
  if(dimCard) children.push(dimCard);
  children.push(new Paragraph({ spacing:{after:120}, children:[] }));

  children.push(docxPriceLine('SUBTOTAL', fmt(state.subtotal), {bold:true}));
  if(hayIncluidos){
    state.items.forEach(it=> children.push(docxPriceLine(it.desc, fmt(it.price))));
    children.push(docxPriceLine('TOTAL', fmt(total), {bold:true, big:true, topRule:true}));
  }

  if(todosOpt.length){
    children.push(docxSectionTitle('Opcionales'));
    todosOpt.forEach(op=>{
      const priceTxt = (op.included===true && op.price!==null && op.price!==undefined) ? fmt(op.price) : 'No incluye';
      const fotosOp = state.fotosPorOpcional[op.id];
      children.push(docxOptCard(op.desc, priceTxt, fotosOp, imgBytesById));
      children.push(new Paragraph({ spacing:{after:80}, children:[] }));
    });
  }

  children.push(docxValidity(state.validez));
  children.push(...docxBodyText(state.legal, {size:19}));
  children.push(...docxPhotoGallery(state.fotos, imgBytesById));
  children.push(...docxFooter(state.footer, v.color));

  return children;
}

// Arma el .docx en memoria (sin descargarlo) — lo usa downloadWord().
async function buildWordBlob(){
  const nombreArchivo = window.armarNombreArchivo('Piscina', state.cliente, state.fecha);

  const children = await buildDocxSections();
  const doc = new Document({ styles: { default: { document: { run: { font: "Arial" } } } },
    sections: [{
      properties: {
        page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
                margin: { top: convertMillimetersToTwip(20), bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(25), right: convertMillimetersToTwip(25) } }
      },
      children
    }]
  });
  const blob = await Packer.toBlob(doc);
  return { blob, nombreArchivo };
}

async function downloadWord(){
  const btn = document.getElementById('btn-download-word');
  const originalText = btn.textContent;
  btn.textContent = 'Generando...';
  btn.disabled = true;
  try{
    await cargarDocx();
    const { blob, nombreArchivo } = await buildWordBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombreArchivo}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }catch(e){
    console.error('No se pudo generar el Word', e);
    alert('Hubo un problema generando el Word. Revisá la consola (F12) para más detalle.');
  }finally{
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
document.getElementById('btn-download-word').addEventListener('click', downloadWord);

/* ---------------- PDF (window.print) ---------------- */
// El navegador no deja forzar el nombre de archivo del PDF generado por window.print()
// ("Guardar como PDF") -- solo puede sugerirlo, y lo hace a partir del <title> del
// documento en el momento de imprimir. Lo cambiamos acá al mismo formato que ya usa
// el Word (armarNombreArchivo) y lo restauramos después, para no dejar el título
// pisado si el usuario navega sin imprimir. El usuario todavía puede editar el
// nombre a mano en el diálogo antes de confirmar -- eso no se puede evitar, solo
// se asegura que el nombre sugerido por defecto sea el correcto.
function imprimirConNombre(){
  const tituloOriginal = document.title;
  document.title = window.armarNombreArchivo('Piscina', state.cliente, state.fecha);
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
  // El cambio de document.title recién se propaga al chrome nativo del navegador
  // (la barra de pestaña/título que lee el share sheet de "Guardar en PDF") en el
  // siguiente tick -- si window.print() se llama en el mismo tick sincrónico que el
  // cambio de título, en mobile (iOS/Android) el share sheet a veces alcanza a leer
  // todavía el título viejo y el PDF sale sin cliente/fecha/tipo. Este pequeño delay
  // le da tiempo al navegador a propagar el título antes de que el sistema lo capture.
  setTimeout(() => window.print(), 60);
}

/* ---------------- ACORDEÓN ---------------- */
// Cada sección se abre/cierra de forma independiente (no excluyente): por defecto
// están todas abiertas para que el panel aproveche el alto de la pantalla, y el
// usuario pliega las que no necesita.
document.querySelectorAll('.acc-head').forEach(head=>{
  head.addEventListener('click', ()=>{
    const item = head.closest('.acc-item');
    const abierto = item.classList.toggle('open');
    head.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
});

/* ---------------- ACTION BAR: espacio reservado en mobile ---------------- */
// En mobile (<=900px, ver -calc.css) el form-panel deja de tener su propio
// scroll interno y pasa a scrollear con la página entera -- ahí el sticky de
// .action-bar se ancla al viewport en vez de al form-panel, y sin espacio de
// sobra al final el último ítem de una lista larga (ej. Opcionales) queda
// tapado sin forma de revelarlo con scroll normal. Reservamos ese espacio con
// un padding-bottom == altura REAL de la barra (medida, no estimada, porque
// varía según cuántos botones entran por fila y el wrap de texto).
/* ---------------- INIT ---------------- */
// Se guarda la promesa (en vez de dejar la IIFE anónima) para que cargarPresupuestoExterno
// pueda esperar a que termine todo el arranque asincrónico antes de tocar el state — si no,
// seedFotosGeneralesDefaults() puede terminar después y pisar las fotos recién restauradas.
let initPromise = (async function init(){
  await loadCatalog();
  await aplicarCatalogoCompartido();
  // A) Las fotos generales (las que se ven al entrar) y el formulario NO dependen del
  //    catálogo de fotos por opcional, así que se muestran primero: en cold start eso baja
  //    la espera hasta la primera foto de ~800ms a <100ms. El sembrado de fotos por opcional
  //    (que vive en el tab "Opcionales") sigue en segundo plano y re-renderiza al terminar.
  await seedFotosGeneralesDefaults();
  renderForm();
  await loadFotosPorOpcional();
  renderForm();
})();

/* ---------------- GUARDAR EN LA NUBE (Supabase) ---------------- */
async function guardarPresupuestoNube(){
  const flash = document.getElementById('save-cloud-flash');
  const btn = document.getElementById('btn-save-cloud');
  if(!state.cliente.trim()){
    if(flash){ flash.textContent = 'Poné al menos el nombre del cliente antes de guardar.'; flash.style.color = 'var(--danger)'; }
    return;
  }
  if(btn) btn.disabled = true;
  if(flash){ flash.textContent = 'Guardando...'; flash.style.color = 'var(--primary-dark)'; }
  try{
    await ensureFotosSubidasANube();
    const datos = quoteToPlainState();
    const { error } = window.presupuestoEnEdicionId
      ? await window.actualizarPresupuesto(window.presupuestoEnEdicionId, datos, state.cliente)
      : await window.guardarPresupuesto(datos, state.cliente);
    if(error) throw error;
    if(flash){ flash.textContent = 'Guardado en la nube ✓'; flash.style.color = 'var(--primary-dark)'; }
  }catch(err){
    if(flash){ flash.textContent = 'Error al guardar: ' + (err && err.message ? err.message : err); flash.style.color = 'var(--danger)'; }
  }finally{
    if(btn) btn.disabled = false;
    setTimeout(()=>{ if(flash) flash.textContent=''; }, 3000);
  }
}


// Handlers inline del markup (onclick) + funciones que llama React: viven en window
// porque los atributos inline se evalúan en scope global, fuera de esta IIFE. El wrap
// evita el choque "Identifier already declared" al re-inyectar el script en la misma
// página (SPA) navegando entre calculadoras (const K_CATALOG, let state, etc.).
window.imprimirConNombre = imprimirConNombre;
window.guardarPresupuestoNube = guardarPresupuestoNube;
})();

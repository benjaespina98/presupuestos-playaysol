const CALCULATOR_MARKUP = `
<div class="app">
  <!-- ===================== FORM PANEL ===================== -->
  <div class="form-panel">
    <h1>Presupuestos · Revestimientos</h1>

    <div class="field"><label>Estilo del encabezado</label>
      <select id="f-header-variant" style="width:100%; padding:8px 9px; font-size:13px; border:1px solid var(--border); border-radius:6px;">
        <option value="teal">Encabezado teal</option>
        <option value="navy">Marca general (azul)</option>
      </select>
    </div>

    <div class="accordion">

    <!-- DATOS -->
    <section class="acc-item open">
    <button type="button" class="acc-head" data-acc="datos" aria-expanded="true">Datos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-datos">
      <div class="field"><label>Fecha</label><input type="text" id="f-fecha"></div>
      <div class="field"><label>Señor/Sra</label><input type="text" id="f-cliente" placeholder="Apellido, Nombre"></div>
      <div class="field"><label>Domicilio</label><input type="text" id="f-domicilio"></div>
      <div class="row2">
        <div class="field"><label>Localidad</label><input type="text" id="f-localidad"></div>
        <div class="field"><label>Teléfono</label><input type="text" id="f-tel" inputmode="tel"></div>
      </div>
      <div class="field"><label>Email</label><input type="text" id="f-email" inputmode="email"></div>
      <div class="field"><label>Notas de la pileta</label>
        <textarea id="f-dimension" rows="4" placeholder="Ej: pileta existente, revestimiento actual gresite en buen estado."></textarea>
      </div>
      <div class="field"><label>Validez (días)</label><input type="text" id="f-validez" inputmode="decimal" style="max-width:90px"></div>
    </div>

    <!-- CÁLCULO -->
    </section>

    <section class="acc-item open">
    <button type="button" class="acc-head" data-acc="items" aria-expanded="true">Cálculo<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-items">
      <div class="hint">Calculá los m² totales a revestir (fondo + paredes) según las medidas de la pileta. Fórmula: m² = (largo × ancho) + 2 × profundidad × (largo + ancho).</div>
      <div class="row2">
        <div class="field"><label>Largo pileta (m)</label><input type="text" id="f-largo" inputmode="decimal"></div>
        <div class="field"><label>Ancho pileta (m)</label><input type="text" id="f-ancho" inputmode="decimal"></div>
      </div>
      <div class="field"><label>Profundidad promedio (m)</label><input type="text" id="f-profundidad" inputmode="decimal" style="max-width:110px"></div>
      <div class="row2">
        <div class="field"><label>Fondo (m²)</label><input type="text" id="f-m2-fondo" inputmode="decimal" readonly style="background:var(--bg);"></div>
        <div class="field"><label>Paredes (m²)</label><input type="text" id="f-m2-paredes" inputmode="decimal" readonly style="background:var(--bg);"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Escalera (m²)</label><input type="text" id="f-escalera" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Desperdicio (m²)</label><input type="text" id="f-desperdicio" inputmode="decimal" placeholder="0"></div>
      </div>
      <div class="section-label" title="Cargá una etiqueta y el número de m² que corresponda; se suma directo al total, sin ningún cálculo">Adicionales de m² (ej. escalón extra, borde, etc.)</div>
      <div id="m2-items-list"></div>
      <button class="btn-add" id="btn-add-m2-item">+ Agregar adicional de m²</button>
      <div class="field" style="margin-top:12px;"><label>TOTAL m² a revestir</label><input type="text" id="f-m2-total" inputmode="decimal" readonly style="background:var(--bg);font-weight:700;"></div>
      <div class="section-label" title="Cargos adicionales que se suman al total, ej. traslados">Adicionales incluidos en el TOTAL</div>
      <div id="items-list"></div>
      <button class="btn-add" id="btn-add-item">+ Agregar ítem</button>
    </div>

    <!-- OPCIONALES -->
    </section>

    <section class="acc-item open">
    <button type="button" class="acc-head" data-acc="opcionales" aria-expanded="true">Tipos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-opcionales">
      <div class="hint">Tildá los tipos de revestimiento que van en este presupuesto (podés tildar más de uno, ej. interior + borde solar). El total de cada tipo se calcula multiplicando el precio /m² por el TOTAL m² de la pestaña Cálculo — salvo los ítems marcados "por obra" (precio fijo, no se multiplica).</div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <button class="btn-secondary" id="btn-check-all" style="margin-top:0;">☑ Todos</button>
        <button class="btn-secondary" id="btn-uncheck-all" style="margin-top:0;">☐ Ninguno</button>
      </div>
      <div id="opt-list"></div>
      <button class="btn-add" id="btn-add-opt">+ Agregar tipo</button>
      <div class="save-flash" id="save-flash"></div>
    </div>

    <!-- FOTOS -->
    </section>

    <section class="acc-item open">
    <button type="button" class="acc-head" data-acc="fotos" aria-expanded="true">Fotos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-fotos">
      <div class="section-label" title="Fotos generales al final del documento. Para fotos de un ítem puntual, subilas en Opcionales">Fotos generales</div>
      <input type="file" id="foto-input" accept="image/*" multiple style="margin-bottom:10px; font-size:12px;">
      <div id="fotos-list"></div>
    </div>

    <!-- TEXTOS FIJOS -->
    </section>

    <section class="acc-item open">
    <button type="button" class="acc-head" data-acc="textos" aria-expanded="true">Textos fijos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-textos">
      <div class="field"><label>Texto legal / técnico</label><textarea id="f-legal" rows="12"></textarea></div>

      <div class="section-label">Pie de página</div>
      <div class="field"><label>Empresa</label><input type="text" id="f-empresa"></div>
      <div class="field"><label>Dirección</label><input type="text" id="f-direccion"></div>
      <div class="row2">
        <div class="field"><label>Tel. fijo</label><input type="text" id="f-telFijo" inputmode="tel"></div>
        <div class="field"><label>WhatsApp</label><input type="text" id="f-whatsapp" inputmode="tel"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Contacto</label><input type="text" id="f-contactoNombre"></div>
        <div class="field"><label>Cel. contacto</label><input type="text" id="f-contactoCel" inputmode="tel"></div>
      </div>
      <div class="field"><label>Email</label><input type="text" id="f-email2" inputmode="email"></div>
      <div class="field"><label>Web</label><input type="text" id="f-web"></div>
      <div class="row2">
        <div class="field"><label>Facebook</label><input type="text" id="f-facebook"></div>
        <div class="field"><label>Link Facebook</label><input type="text" id="f-facebookUrl" placeholder="https://..."></div>
      </div>
      <div class="row2">
        <div class="field"><label>Instagram</label><input type="text" id="f-instagram"></div>
        <div class="field"><label>Link Instagram</label><input type="text" id="f-instagramUrl" placeholder="https://..."></div>
      </div>

      <button class="btn-secondary" type="button" id="btn-save-textos-todos" style="margin-top:14px;" title="Guarda el texto legal y el pie como predeterminados para todos los usuarios">Guardar como predeterminado para todos</button>
      <div class="save-flash" id="save-textos-flash"></div>
    </div>

    </section>

    </div><!-- /.accordion -->

    <div class="action-bar">
      <button class="btn-add" id="btn-new-quote" style="width:100%; justify-content:center;">Limpiar formulario</button>
      <button type="button" class="action-trigger" id="btn-action-sheet" aria-expanded="false" aria-controls="action-row">Acciones <span aria-hidden="true">▾</span></button>
      <div class="action-row" id="action-row">
        <button class="btn-secondary" onclick="imprimirConNombre()" style="margin-top:0;" title='PDF — antes de imprimir: en "Más ajustes" desmarcá "Encabezados y pies" y tildá "Gráficos de fondo"'>🖨️<span class="btn-label"> PDF</span></button>
        <button class="btn-secondary" id="btn-download-word" style="margin-top:0;" title="Word">📄<span class="btn-label"> Word</span></button>
        <button class="btn-secondary" id="btn-save-cloud" onclick="guardarPresupuestoNube()" style="margin-top:0;" title="Guardar en la nube">☁️<span class="btn-label"> Guardar en la nube</span></button>
        <a class="btn-secondary" href="/dashboard/historial?tipo=revestimientos" style="margin-top:0;text-decoration:none;text-align:center;" title="Historial">📋<span class="btn-label"> Historial</span></a>
      </div>
      <div class="save-flash" id="save-cloud-flash"></div>
      <div class="action-overlay" id="action-overlay"></div>
    </div>
  </div>

  <!-- ===================== PREVIEW PANEL ===================== -->
  <div class="preview-panel">
    <div class="sheet" id="sheet">
      <div class="sheet-header" id="sheet-header-bg">
        <img class="logo-mark" id="sheet-logo-img" alt="Playa & Sol">
      </div>
      <div class="sheet-body" id="sheet-body">
        <!-- generado por JS -->
      </div>
    </div>
  </div>
</div>
`;

export function buildCalculatorHtml() {
  return CALCULATOR_MARKUP;
}

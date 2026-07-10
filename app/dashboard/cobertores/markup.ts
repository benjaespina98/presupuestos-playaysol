const CALCULATOR_MARKUP = `
<div class="app">
  <!-- ===================== FORM PANEL ===================== -->
  <div class="form-panel">
    <h1>Presupuestos · Cobertores de Pileta</h1>

    <div class="field"><label>Estilo del encabezado</label>
      <select id="f-header-variant" style="width:100%; padding:8px 9px; font-size:13px; border:1px solid var(--border); border-radius:6px;">
        <option value="teal">Encabezado teal</option>
        <option value="navy">Marca general (azul)</option>
      </select>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="guardados">Guardados</button>
      <button class="tab-btn" data-tab="datos">Datos</button>
      <button class="tab-btn" data-tab="items">Cálculo</button>
      <button class="tab-btn" data-tab="opcionales">Opcionales</button>
      <button class="tab-btn" data-tab="fotos">Fotos</button>
      <button class="tab-btn" data-tab="textos">Textos fijos</button>
    </div>

    <!-- GUARDADOS -->
    <div class="tab-content active" id="tab-guardados">
      <input type="text" class="quote-search" id="quote-search" placeholder="Buscar por cliente...">
      <div id="quote-list"></div>
      <button class="btn-add" id="btn-new-quote">+ Nuevo presupuesto</button>
    </div>

    <!-- DATOS -->
    <div class="tab-content" id="tab-datos">
      <div class="field"><label>Fecha</label><input type="text" id="f-fecha"></div>
      <div class="field"><label>Señor/Sra</label><input type="text" id="f-cliente" placeholder="Apellido, Nombre"></div>
      <div class="field"><label>Domicilio</label><input type="text" id="f-domicilio"></div>
      <div class="row2">
        <div class="field"><label>Localidad</label><input type="text" id="f-localidad"></div>
        <div class="field"><label>Teléfono</label><input type="text" id="f-tel" inputmode="tel"></div>
      </div>
      <div class="field"><label>Email</label><input type="text" id="f-email" inputmode="email"></div>
      <div class="field"><label>Notas de la pileta (forma, detalles)</label>
        <textarea id="f-dimension" rows="4" placeholder="Ej: pileta rectangular, esquinas rectas, sin escalera romana."></textarea>
      </div>
      <div class="field"><label>Validez (días)</label><input type="text" id="f-validez" inputmode="decimal" style="max-width:90px"></div>
    </div>

    <!-- CÁLCULO -->
    <div class="tab-content" id="tab-items">
      <div class="hint">Cobertor de lona microperforada a medida, con ojales para pasar la soga. El precio por m² varía según la superficie total a cubrir (más de 15 m² o hasta 15 m²). Cargá el largo y ancho de la pileta.</div>
      <div class="row2">
        <div class="field"><label>Largo pileta (m)</label><input type="text" id="f-largo" inputmode="decimal"></div>
        <div class="field"><label>Ancho pileta (m)</label><input type="text" id="f-ancho" inputmode="decimal"></div>
      </div>
      <div class="field"><label>Adicional (m²)</label><input type="text" id="f-adicional-m2" inputmode="decimal"></div>
      <div style="font-size:10.5px;color:var(--muted);margin:-6px 0 8px;">Para cubrir más allá del espejo de agua (ej: 0.5 m de borde alrededor de toda la pileta). Se suma directo a los m² a cubrir.</div>
      <div class="field"><label>m² a cubrir (total)</label><input type="text" id="f-m2" inputmode="decimal" readonly style="background:var(--bg);font-weight:700;"></div>
      <div class="row2">
        <div class="field"><label>Precio /m² (≤15 m²)</label><input type="text" id="f-precio-menos15" inputmode="decimal"></div>
        <div class="field"><label>Precio /m² (&gt;15 m²)</label><input type="text" id="f-precio-mas15" inputmode="decimal"></div>
      </div>
      <div class="field"><label>Precio instalación (fijo)</label><input type="text" id="f-precio-instalacion" inputmode="decimal"></div>
      <div class="save-flash" id="precios-base-flash" style="margin-bottom:6px;"></div>
      <div style="font-size:10.5px;color:var(--muted);margin:-6px 0 10px;">Estos tres precios son la base compartida por todo el equipo (se guardan solos en la nube). No son por presupuesto.</div>
      <div class="field"><label>¿Qué mostrar en el presupuesto?</label>
        <select id="f-modo-precio" style="width:100%; padding:8px 9px; font-size:13px; border:1px solid var(--border); border-radius:6px;">
          <option value="sin">Solo SIN instalación</option>
          <option value="con">Solo CON instalación</option>
          <option value="ambos">Mostrar ambos</option>
        </select>
      </div>
      <div class="section-label" title="Cargos adicionales que se suman al TOTAL">Adicionales incluidos en el TOTAL</div>
      <div id="items-list"></div>
      <button class="btn-add" id="btn-add-item">+ Agregar ítem</button>
    </div>

    <!-- OPCIONALES -->
    <div class="tab-content" id="tab-opcionales">
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <button class="btn-secondary" id="btn-check-all" style="margin-top:0;">☑ Todos</button>
        <button class="btn-secondary" id="btn-uncheck-all" style="margin-top:0;">☐ Ninguno</button>
      </div>
      <div id="opt-list"></div>
      <button class="btn-add" id="btn-add-opt">+ Agregar opcional</button>
      <div class="save-flash" id="save-flash"></div>
    </div>

    <!-- FOTOS -->
    <div class="tab-content" id="tab-fotos">
      <div class="section-label" title="Fotos generales al final del documento. Para fotos de un ítem puntual, subilas en Opcionales">Fotos generales</div>
      <input type="file" id="foto-input" accept="image/*" multiple style="margin-bottom:10px; font-size:12px;">
      <div id="fotos-list"></div>
    </div>

    <!-- TEXTOS FIJOS -->
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
    </div>

    <button class="btn-primary" id="btn-save-quote">💾 Guardar presupuesto</button>
    <div class="save-flash" id="save-quote-flash"></div>
    <div class="action-row">
      <button class="btn-secondary" onclick="window.print()" style="margin-top:0;" title='Antes de imprimir: en "Más ajustes" desmarcá "Encabezados y pies" y tildá "Gráficos de fondo"'>🖨️ PDF</button>
      <button class="btn-secondary" id="btn-download-word" style="margin-top:0;">📄 Word</button>
      <button class="btn-secondary" id="btn-save-cloud" onclick="guardarPresupuestoNube()" style="margin-top:0;">☁️ Guardar en la nube</button>
      <a class="btn-secondary" href="/dashboard/historial?tipo=cobertores" style="margin-top:0;text-decoration:none;text-align:center;">📋 Historial</a>
    </div>
    <div class="save-flash" id="save-cloud-flash"></div>
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

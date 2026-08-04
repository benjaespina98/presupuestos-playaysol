const CALCULATOR_MARKUP = `
<div class="app">
  <!-- ===================== FORM PANEL ===================== -->
  <div class="form-panel">
    <h1>Cercos perimetrales</h1>


    <div class="accordion">

    <!-- DATOS -->
    <section class="acc-item">
    <button type="button" class="acc-head" data-acc="datos" aria-expanded="false">Datos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-datos">
      <div class="field"><label>Fecha</label><input type="text" id="f-fecha"></div>
      <div class="field"><label>Señor/Sra</label><input type="text" id="f-cliente" placeholder="Apellido, Nombre"></div>
      <div class="field"><label>Domicilio</label><input type="text" id="f-domicilio"></div>
      <div class="row2">
        <div class="field"><label>Localidad</label><input type="text" id="f-localidad"></div>
        <div class="field"><label>Teléfono</label><input type="text" id="f-tel" inputmode="tel"></div>
      </div>
      <div class="field"><label>Email</label><input type="text" id="f-email" inputmode="email"></div>
      <div class="field"><label>Detalle del recorrido a cercar</label>
        <textarea id="f-dimension" rows="4" placeholder="Ej: perímetro completo de la piscina, incluye tramo de acceso lateral."></textarea>
      </div>
      <div class="field"><label>Validez (días)</label><input type="text" id="f-validez" inputmode="decimal" class="input-corto"></div>
    </div>

    <!-- CÁLCULO -->
    </section>

    <section class="acc-item">
    <button type="button" class="acc-head" data-acc="items" aria-expanded="false">Cálculo<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-items">
      <div class="hint">Cargá los metros lineales a cercar. El valor sin instalación y con instalación se calculan solos.</div>
      <div class="field"><label>Metros lineales a cercar (ml)</label><input type="text" id="f-ml" inputmode="decimal" placeholder="Ej: 24"></div>
      <div class="row2">
        <div class="field"><label>Precio /ml sin instalación</label><input type="text" id="f-precio-sin" inputmode="decimal"></div>
        <div class="field"><label>Precio /ml con instalación</label><input type="text" id="f-precio-con" inputmode="decimal"></div>
      </div>
      <div class="save-flash" id="precios-base-flash"></div>
      <p class="note">Estos dos precios son la base compartida por todo el equipo (se guardan solos en la nube). No son por presupuesto.</p>
      <div class="field"><label>¿Qué mostrar en el presupuesto?</label>
        <select id="f-modo-precio">
          <option value="sin">Solo SIN instalación</option>
          <option value="con">Solo CON instalación</option>
          <option value="ambos">Mostrar ambos</option>
        </select>
      </div>
      <div class="section-label">Adicionales incluidos en el TOTAL</div>
      <div id="items-list"></div>
      <button class="btn-add" id="btn-add-item">+ Agregar ítem</button>
    </div>

    <!-- OPCIONALES -->
    </section>

    <section class="acc-item">
    <button type="button" class="acc-head" data-acc="opcionales" aria-expanded="false">Opcionales<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-opcionales">
      <div class="hint">Tildá <b>Incluir</b> en los opcionales que van en este presupuesto. Podés marcar varios.</div>
      <div class="btn-row">
        <button class="btn-secondary" id="btn-check-all">Incluir todos</button>
        <button class="btn-secondary" id="btn-uncheck-all">No incluir ninguno</button>
      </div>
      <div id="opt-list"></div>
      <button class="btn-add" id="btn-add-opt">+ Agregar opcional</button>
      <div class="save-flash" id="save-flash"></div>
    </div>

    <!-- FOTOS -->
    </section>

    <section class="acc-item">
    <button type="button" class="acc-head" data-acc="fotos" aria-expanded="false">Fotos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-fotos">
      <div class="section-label">Fotos generales</div>
      <p class="note">Van al final del documento. Las fotos de un ítem puntual se suben desde Opcionales.</p>
      <input type="file" id="foto-input" accept="image/*" multiple>
      <div id="fotos-list"></div>
    </div>

    <!-- TEXTOS FIJOS -->
    </section>

    <section class="acc-item">
    <button type="button" class="acc-head" data-acc="textos" aria-expanded="false">Textos fijos<span class="acc-caret" aria-hidden="true">▾</span></button>
    <div class="tab-content" id="tab-textos">
      <div class="field"><label>Estilo del encabezado</label>
        <select id="f-header-variant">
          <option value="teal">Encabezado teal</option>
          <option value="navy">Marca general (azul)</option>
        </select>
      </div>

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

      <button class="btn-secondary" type="button" id="btn-save-textos-todos">Guardar como predeterminado para todos</button>
      <p class="note">Deja el texto legal y el pie de arriba como predeterminados para todo el equipo.</p>
      <div class="save-flash" id="save-textos-flash"></div>
    </div>

    </section>

    </div><!-- /.accordion -->

    <div class="action-bar">
      <button class="btn-primary" id="btn-save-cloud" onclick="guardarPresupuestoNube()">Guardar en la nube</button>
      <div class="save-flash" id="save-cloud-flash"></div>
      <div class="action-row">
        <button class="btn-secondary" onclick="imprimirConNombre()">PDF</button>
        <button class="btn-secondary" id="btn-download-word">Word</button>
        <a class="btn-secondary" href="/dashboard/historial?tipo=cercos">Historial</a>
      </div>
      <p class="note action-note">Para el PDF, en «Más ajustes» del diálogo de impresión: desmarcá «Encabezados y pies» y tildá «Gráficos de fondo».</p>
      <button class="btn-ghost" id="btn-new-quote">Limpiar formulario</button>
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

export function buildCalculatorHtml(): string {
  return `
<div class="wrap" id="capture-area">

  <header class="brand">
    <h1>Plano de Piscina</h1>
    <p class="subtitle">Plano del borde perimetral y cálculo de m² a cotizar</p>
  </header>

  <div class="lay">

    <!-- ================= COLUMNA IZQUIERDA: CARGA DE DATOS ================= -->
    <div class="col-form">

      <section class="field-section">
        <h3>Presupuesto</h3>
        <div>
          <label for="nombre">Cliente o referencia</label>
          <input type="text" id="nombre" placeholder="Ej: Gómez, Martín">
        </div>
      </section>

      <section class="field-section">
        <h3>Medidas de la pileta</h3>
        <div class="row">
          <div>
            <label for="largo">Largo (m)</label>
            <input type="number" id="largo" value="0" step="0.01" inputmode="decimal">
          </div>
          <div>
            <label for="ancho">Ancho (m)</label>
            <input type="number" id="ancho" value="0" step="0.01" inputmode="decimal">
          </div>
        </div>
        <div class="subfield">
          <label for="incluido">Borde que ya viene incluido (m)</label>
          <input type="number" id="incluido" value="0.5" step="0.05" inputmode="decimal">
          <p class="helptext">Ancho de loseta perimetral que entra en el precio base, igual en los cuatro lados. Todo lo que exceda esta medida es lo que se cotiza aparte.</p>
        </div>
      </section>

      <section class="field-section">
        <h3>Ancho final del borde, lado por lado</h3>
        <p class="helptext helptext-lead">Cargá la medida <b>terminada</b> de cada lado, incluyendo el borde que ya viene incluido. Un lado que quede en la medida estándar lleva ese mismo valor.</p>
        <div class="row">
          <div><label for="solar">Solar (m)</label><input type="number" id="solar" value="0" step="0.05" inputmode="decimal"></div>
          <div><label for="opuesto">Opuesto al solar (m)</label><input type="number" id="opuesto" value="0" step="0.05" inputmode="decimal"></div>
          <div><label for="lateral1">Lateral 1 (m)</label><input type="number" id="lateral1" value="0" step="0.05" inputmode="decimal"></div>
          <div><label for="lateral2">Lateral 2 (m)</label><input type="number" id="lateral2" value="0" step="0.05" inputmode="decimal"></div>
        </div>
      </section>

      <!-- Antes esto eran TRES secciones separadas ("Solar húmedo y escalera",
           "Pileta e iluminación", "Revestimiento interior") con uno o dos campos
           cada una: mucho encabezado para muy poco contenido. -->
      <section class="field-section">
        <h3>Detalles de la pileta</h3>

        <div class="row">
          <div>
            <label for="tipoPileta">Tipo</label>
            <select id="tipoPileta" onchange="toggleSubfield('subLabios', this.value === 'fibra')">
              <option value="hormigon">Hormigón</option>
              <option value="fibra">Fibra</option>
            </select>
          </div>
          <div>
            <label for="revestimiento">Revestimiento interior</label>
            <select id="revestimiento" onchange="toggleSubfield('subRevestOtro', this.value === 'otro')">
              <option value="">Sin especificar</option>
              <option value="ceramicos">Cerámicos</option>
              <option value="travertino">Travertino</option>
              <option value="pintura">Pintura</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div class="subfield" id="subLabios" style="display:none;">
          <label for="labios">Ancho de labios (m)</label>
          <input type="number" id="labios" value="0.20" step="0.01" inputmode="decimal">
          <p class="helptext">Ya está dentro del largo × ancho de arriba. No cambia los m² a cotizar: solo dibuja el espejo de agua real dentro de la medida exterior.</p>
        </div>

        <div class="subfield" id="subRevestOtro" style="display:none;">
          <label for="revestimientoOtro">¿Cuál?</label>
          <input type="text" id="revestimientoOtro" placeholder="Ej: Liner, gresite...">
        </div>

        <div class="opciones">
          <div class="opcion">
            <div class="checkrow">
              <input type="checkbox" id="chkSolarHumedo" onchange="toggleSubfield('subSolarHumedo', this.checked)">
              <label for="chkSolarHumedo">Solar húmedo</label>
            </div>
            <div class="subfield" id="subSolarHumedo" style="display:none;">
              <label for="solarHumedoAncho">Ancho (m)</label>
              <input type="number" id="solarHumedoAncho" value="0" step="0.05" inputmode="decimal">
            </div>
          </div>

          <div class="opcion">
            <div class="checkrow">
              <input type="checkbox" id="chkEscalera" onchange="toggleSubfield('subEscalera', this.checked)">
              <label for="chkEscalera">Escalera</label>
            </div>
            <div class="subfield" id="subEscalera" style="display:none;">
              <label for="escaleraPos">Ubicación</label>
              <select id="escaleraPos">
                <option value="solar">Lado del solar</option>
                <option value="opuesto">Lado opuesto</option>
                <option value="lateral1">Lateral 1</option>
                <option value="lateral2">Lateral 2</option>
              </select>
            </div>
          </div>

          <div class="opcion">
            <div class="checkrow">
              <input type="checkbox" id="chkLuces" onchange="toggleSubfield('subLuces', this.checked)">
              <label for="chkLuces">Luces</label>
            </div>
            <div class="subfield" id="subLuces" style="display:none;">
              <label for="cantLuces">Cantidad</label>
              <input type="number" id="cantLuces" value="0" min="1" step="1" inputmode="numeric">
              <p class="helptext">Arrastralas en el plano para ubicarlas.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Colores y etiquetas son ajustes cosméticos del dibujo: iban expandidos
           en medio del formulario, compitiendo con las medidas. Ahora arrancan
           plegados y se abren solo si hacen falta. -->
      <details class="field-section field-section-fold">
        <summary>Apariencia del plano <span class="section-hint">colores y nombres de los lados</span></summary>
        <div class="fold-body">
          <div class="row">
            <div>
              <label for="colorAgua">Color del agua</label>
              <input type="color" id="colorAgua" value="#A6D1EC">
            </div>
            <div>
              <label for="colorLoseta">Color de la loseta</label>
              <input type="color" id="colorLoseta" value="#F7E6D3">
            </div>
          </div>
          <div class="row">
            <div><label for="lblSolar">Nombre del lado solar</label><input type="text" id="lblSolar" value="Solar"></div>
            <div><label for="lblOpuesto">Nombre del lado opuesto</label><input type="text" id="lblOpuesto" value="Opuesto"></div>
            <div><label for="lblLateral1">Nombre del lateral 1</label><input type="text" id="lblLateral1" value="Lateral 1"></div>
            <div><label for="lblLateral2">Nombre del lateral 2</label><input type="text" id="lblLateral2" value="Lateral 2"></div>
          </div>
        </div>
      </details>

      <section class="field-section field-section-muted">
        <h3>Materiales y precios <span class="section-hint">uso interno, no sale en la imagen del cliente</span></h3>
        <div class="material-header"><span>Material</span><span>Precio $/m²</span><span></span></div>
        <div id="materialsContainer"></div>
        <button type="button" class="add-material" onclick="addMaterial()">+ Agregar material</button>
        <div class="material-cost-grid" id="materialCostCards"></div>
      </section>

    </div>

    <!-- ================= COLUMNA DERECHA: RESULTADO =================
         El plano y los m² son la salida de la calculadora: antes estaban
         enterrados debajo de siete secciones de campos, así que había que
         scrollear para ver el efecto de cada medida que se cargaba. Acá quedan
         siempre a la vista (sticky en desktop) y se actualizan mientras tipeás. -->
    <aside class="col-out">
      <div class="out-sticky">
        <div class="plano-container">
          <svg id="svg" width="100%" viewBox="0 0 680 420"></svg>
        </div>

        <div class="cards">
          <div class="card">
            <div class="label">m² ya incluidos</div>
            <div class="value" id="m2inc">-</div>
          </div>
          <div class="card accent">
            <div class="label">m² extra a cotizar</div>
            <div class="value" id="m2extra">-</div>
          </div>
        </div>

        <div class="btns-wrap">
          <div class="btns">
            <button class="client" onclick="exportarCliente()">Imagen para el cliente</button>
            <button class="secondary" id="btnGuardarNube" onclick="guardarEnNubeClick()">Guardar en la nube</button>
          </div>
          <p class="helptext">La imagen sale a escala, con las medidas y sin precios: lista para mandar por chat.</p>
          <div class="helptext" id="cloudMsg"></div>
          <div class="btns btns-menores">
            <a class="secondary" href="/dashboard/historial?tipo=losetas">Historial</a>
            <button type="button" class="ghost" onclick="resetAll()">Limpiar formulario</button>
          </div>
        </div>
      </div>
    </aside>

  </div>
</div>

<div id="client-capture">
  <div class="chdr">
    <div>
      <div class="ctitle">Plano de Piscina</div>
      <div class="csub" id="clientRef"></div>
    </div>
    <img src="/logo-mark.png" alt="Playa y Sol">
  </div>
  <div class="cplano">
    <svg id="svgClient" width="100%" viewBox="0 0 1000 650"></svg>
  </div>
  <div class="cfooter">Playa y Sol S.A.S. — Corrientes 1210, Villa María</div>
</div>
`;
}

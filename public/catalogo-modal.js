/* ---------------------------------------------------------------------------
 * Modal compartido para el popup "actualizar catálogo para todos vs. solo
 * este presupuesto". Se carga como <script src> independiente en las 5
 * calculadoras (piscinas, cercos, cobertores, revestimientos, losetas) para
 * no duplicar el HTML/CSS del modal en cada -calc.js. No depende de React:
 * inyecta el markup directo en el DOM y devuelve una Promise con la decisión.
 * ------------------------------------------------------------------------- */
(function(){
  if (window.mostrarModalCatalogo) return; // ya cargado (otra instancia de este script)

  var STYLE_ID = 'catalogo-modal-styles';
  function ensureStyles(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.catalogo-modal-overlay{position:fixed;inset:0;background:rgba(27,58,92,0.45);' +
      'display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;}' +
      '.catalogo-modal{background:#fff;border-radius:12px;max-width:420px;width:100%;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.25);padding:24px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'position:relative;}' +
      '.catalogo-modal-close{position:absolute;top:10px;right:10px;width:28px;height:28px;' +
      'border:none;background:none;color:#5C7480;font-size:16px;line-height:1;cursor:pointer;' +
      'border-radius:6px;}' +
      '.catalogo-modal-close:hover{background:#F4F8F9;}' +
      '.catalogo-modal h2{margin:0 0 12px;font-size:16px;font-weight:700;color:#1B3A5C;' +
      'padding-right:24px;}' +
      '.catalogo-modal-mensaje{margin:0 0 20px;font-size:13.5px;line-height:1.5;color:#1C2B33;}' +
      '.catalogo-modal-acciones{display:flex;flex-direction:column;gap:10px;}' +
      '.catalogo-modal-btn{width:100%;border-radius:8px;padding:11px 14px;font-size:13.5px;' +
      'font-weight:700;cursor:pointer;text-align:center;border:1px solid transparent;' +
      'font-family:inherit;}' +
      '.catalogo-modal-btn-primario{background:#1B3A5C;color:#fff;}' +
      '.catalogo-modal-btn-primario:hover{background:#142c46;}' +
      '.catalogo-modal-btn-secundario{background:#fff;color:#1B3A5C;border-color:#1B3A5C;}' +
      '.catalogo-modal-btn-secundario:hover{background:#F4F8F9;}' +
      '.catalogo-modal-btn-cancelar{width:100%;background:none;border:none;color:#5C7480;' +
      'font-size:12.5px;cursor:pointer;padding:6px;text-align:center;font-family:inherit;}' +
      '.catalogo-modal-btn-cancelar:hover{text-decoration:underline;}' +
      '.catalogo-modal-aclaracion{display:block;margin-top:3px;font-size:11px;font-weight:400;' +
      'opacity:0.85;}';
    document.head.appendChild(style);
  }

  function escHtml(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /**
   * opts: {
   *   titulo: string,
   *   mensaje: string,
   *   botonPrimario: { texto: string, aclaracion?: string },
   *   botonSecundario: { texto: string, aclaracion?: string } | null  // null => solo "Cancelar" (caso losetas)
   * }
   * Devuelve Promise<'primario'|'secundario'|null>. null = cerrado/cancelado (equivalente
   * a "no hacer nada": el input queda con el valor tipeado, sin persistir en ningún lado).
   */
  window.mostrarModalCatalogo = function(opts){
    ensureStyles();
    return new Promise(function(resolve){
      var overlay = document.createElement('div');
      overlay.className = 'catalogo-modal-overlay';

      var secundarioHtml = opts.botonSecundario
        ? '<button type="button" class="catalogo-modal-btn catalogo-modal-btn-secundario" data-accion="secundario">' +
            escHtml(opts.botonSecundario.texto) +
            (opts.botonSecundario.aclaracion ? '<span class="catalogo-modal-aclaracion">' + escHtml(opts.botonSecundario.aclaracion) + '</span>' : '') +
          '</button>'
        : '<button type="button" class="catalogo-modal-btn-cancelar" data-accion="cancelar">Cancelar</button>';

      overlay.innerHTML =
        '<div class="catalogo-modal" role="dialog" aria-modal="true">' +
          '<button type="button" class="catalogo-modal-close" data-accion="cancelar" aria-label="Cerrar">✕</button>' +
          '<h2>' + escHtml(opts.titulo) + '</h2>' +
          '<p class="catalogo-modal-mensaje">' + escHtml(opts.mensaje) + '</p>' +
          '<div class="catalogo-modal-acciones">' +
            '<button type="button" class="catalogo-modal-btn catalogo-modal-btn-primario" data-accion="primario">' +
              escHtml(opts.botonPrimario.texto) +
              (opts.botonPrimario.aclaracion ? '<span class="catalogo-modal-aclaracion">' + escHtml(opts.botonPrimario.aclaracion) + '</span>' : '') +
            '</button>' +
            secundarioHtml +
          '</div>' +
        '</div>';

      function cerrar(resultado){
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        resolve(resultado);
      }
      function onKeydown(e){ if(e.key === 'Escape') cerrar(null); }

      overlay.addEventListener('click', function(e){
        if(e.target === overlay) cerrar(null);
      });
      Array.prototype.forEach.call(overlay.querySelectorAll('[data-accion]'), function(btn){
        btn.addEventListener('click', function(){
          var accion = btn.getAttribute('data-accion');
          cerrar(accion === 'primario' ? 'primario' : (accion === 'secundario' ? 'secundario' : null));
        });
      });

      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(overlay);
      overlay.querySelector('.catalogo-modal-btn-primario').focus();
    });
  };
})();

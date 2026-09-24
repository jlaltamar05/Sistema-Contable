// Utilidad compartida: renderiza plantillas de impresión con campos
// de fusión y abre la vista previa en una pestaña nueva para Ctrl+P.
//
// Campos de fusión soportados en la plantilla (contenido_html de un
// formato de impresión):
//   {{campo}}                    -> valor plano (ej. {{numero_pedido}})
//   {{objeto.campo}}              -> valor anidado (ej. {{cliente.nombre}})
//   {{#each detalle}} ... {{/each}}  -> repite el bloque por cada línea
//     del arreglo; dentro del bloque, {{campo}} se resuelve contra esa
//     línea primero, y si no lo tiene, contra el documento completo.
//
// El objeto de datos que se le pasa es lo que devuelve
// GET /pedidos/:id o GET /cotizaciones/:id, con dos alias agregados
// para que la plantilla pueda escribir el nombre singular natural:
//   datos.cliente -> datos.clientes
//   datos.moneda  -> datos.monedas

function resolverCampo(datos, ruta) {
  return ruta.split('.').reduce(function(valor, parte) {
    return (valor === null || valor === undefined) ? undefined : valor[parte];
  }, datos);
}

function renderizarPlantilla(html, datos) {
  if (!html) return '';

  // Primero los bloques de repetición (uno por línea del detalle)
  let resultado = html.replace(/\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g, function(_, ruta, bloque) {
    const arreglo = resolverCampo(datos, ruta);
    if (!Array.isArray(arreglo)) return '';
    return arreglo.map(function(item) {
      return renderizarPlantilla(bloque, Object.assign({}, datos, item));
    }).join('');
  });

  // Luego los campos sueltos que queden (fuera de cualquier #each)
  resultado = resultado.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function(_, ruta) {
    const valor = resolverCampo(datos, ruta);
    return (valor === undefined || valor === null) ? '' : String(valor);
  });

  return resultado;
}

function prepararDatosParaPlantilla(datos) {
  // Los reportes contables ya traen su tabla armada (tabla_html) y su
  // título — a diferencia de Ventas/Compras, aquí no hace falta
  // calcular montos de líneas ni descuentos, así que esta versión es
  // mucho más simple que la del Sistema Administrativo.
  return Object.assign({}, datos, {
    titulo_documento: datos.titulo_documento || '',
    numero_documento: datos.numero_documento || '',
    fecha_documento: datos.fecha_documento || '',
  });
}

let _formatosDisponiblesImpresion = [];
let _obtenerDatosDocumentoActual = null;
let _tipoDocumentoActual = null;

// tipoDocumento: 'cotizacion' | 'pedido' | 'factura' | 'orden_compra' | 'compra'
// obtenerDatosDocumento: función (sin argumentos) que devuelve (o resuelve
// una promesa con) el documento completo a imprimir.
async function abrirSelectorImpresion(tipoDocumento, obtenerDatosDocumento) {
  const modal = document.getElementById('modal-imprimir');
  if (!modal) return; // esta pantalla no incluyó el modal de impresión

  try {
    _formatosDisponiblesImpresion = await llamarApi('/formatos-impresion?tipo_documento=' + tipoDocumento + '&activo=true');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
    return;
  }

  if (!_formatosDisponiblesImpresion || _formatosDisponiblesImpresion.length === 0) {
    mostrarMensaje('No hay ningún formato de impresión activo configurado para este tipo de documento. Configúralo en Formatos de impresión.', 'error');
    return;
  }

  _obtenerDatosDocumentoActual = obtenerDatosDocumento;
  _tipoDocumentoActual = tipoDocumento;

  const select = document.getElementById('select-formato-imprimir');
  select.innerHTML = _formatosDisponiblesImpresion.map(function(f) {
    return '<option value="' + f.id + '">' + f.nombre + (f.predeterminado ? ' (predeterminado)' : '') +
      (f.cola_impresion ? ' — ' + f.cola_impresion : '') + '</option>';
  }).join('');

  const predeterminado = _formatosDisponiblesImpresion.find(function(f) { return f.predeterminado; });
  if (predeterminado) select.value = predeterminado.id;

  modal.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('modal-imprimir');
  if (!modal) return;

  const cerrar = function() { modal.style.display = 'none'; };
  document.getElementById('boton-cerrar-modal-imprimir').addEventListener('click', cerrar);
  document.getElementById('boton-cancelar-imprimir').addEventListener('click', cerrar);
  modal.addEventListener('click', function(evento) { if (evento.target === modal) cerrar(); });

  document.getElementById('boton-confirmar-imprimir').addEventListener('click', async function() {
    const id = document.getElementById('select-formato-imprimir').value;
    const formato = _formatosDisponiblesImpresion.find(function(f) { return f.id === id; });
    if (!formato || !_obtenerDatosDocumentoActual) return;

    try {
      const datos = await _obtenerDatosDocumentoActual();
      const html = renderizarPlantilla(formato.contenido_html, prepararDatosParaPlantilla(datos, _tipoDocumentoActual));

      const ventana = window.open('', '_blank');
      if (!ventana) {
        mostrarMensaje('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.', 'error');
        return;
      }
      ventana.document.write(html);
      ventana.document.close();

      if (formato.cola_impresion) {
        ventana.document.title = '[' + formato.cola_impresion + '] ' + (ventana.document.title || '');
        const banner = ventana.document.createElement('div');
        banner.textContent = 'Selecciona la impresora: ' + formato.cola_impresion;
        banner.setAttribute('style',
          'position:sticky;top:0;background:#fff4e3;color:#8a5a10;' +
          'padding:8px 14px;font:600 13px Arial,sans-serif;border-bottom:2px solid #d98c1f;z-index:9999;'
        );
        const estiloOculto = ventana.document.createElement('style');
        estiloOculto.textContent = '@media print { .aviso-cola-impresion { display: none !important; } }';
        banner.className = 'aviso-cola-impresion';
        ventana.document.head.appendChild(estiloOculto);
        ventana.document.body.insertBefore(banner, ventana.document.body.firstChild);
      }

      ventana.focus();
      cerrar();
    } catch (err) {
      mostrarMensaje(err.message, 'error');
    }
  });
});

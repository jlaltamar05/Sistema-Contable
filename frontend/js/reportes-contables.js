function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let tipoReporteActual = null;

document.getElementById('boton-generar-reporte').addEventListener('click', generarReporte);

async function generarReporte() {
  const tipo = document.getElementById('reporte-tipo').value;
  tipoReporteActual = tipo;
  const desde = document.getElementById('reporte-desde').value;
  const hasta = document.getElementById('reporte-hasta').value;
  const estado = document.getElementById('reporte-estado').value;

  const params = [];
  if (desde) params.push('desde=' + desde);
  if (hasta) params.push('hasta=' + hasta);
  if (estado) params.push('estado=' + estado);
  const query = params.length ? '?' + params.join('&') : '';

  try {
    if (tipo === 'libro-diario') {
      const r = await llamarApi('/reportes-contables/libro-diario' + query);
      dibujarLibroDiario(r);
    } else if (tipo === 'libro-mayor') {
      const r = await llamarApi('/reportes-contables/libro-mayor' + query);
      dibujarLibroMayor(r);
    } else if (tipo === 'balance-comprobacion') {
      const r = await llamarApi('/reportes-contables/balance-comprobacion' + query);
      dibujarBalanceComprobacion(r);
    } else if (tipo === 'estado-resultados') {
      const r = await llamarApi('/reportes-contables/estado-resultados' + query);
      dibujarEstadoResultados(r);
    } else if (tipo === 'balance-general') {
      const r = await llamarApi('/reportes-contables/balance-general' + query);
      dibujarBalanceGeneral(r);
    }
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function dibujarLibroMayor(r) {
  document.getElementById('resultado-titulo').textContent = 'Libro Mayor';

  let filas = '';
  if (r.cuentas.length === 0) {
    filas = '<tr><td colspan="6" class="estado-vacio">No hay movimientos con esos filtros.</td></tr>';
  } else {
    r.cuentas.forEach((c) => {
      filas += '<tr style="background:#eef1f7;"><td colspan="4"><b>' + escaparHtml(c.codigo + ' — ' + c.nombre) + '</b></td>' +
        '<td colspan="2" style="text-align:right;"><b>Saldo final: ' + formatearMonto(c.saldo_final) + '</b></td></tr>';
      c.movimientos.forEach((m) => {
        filas += '<tr><td>' + escaparHtml(m.numero_asiento) + '</td><td>' + formatearFecha(m.fecha) + '</td>' +
          '<td>' + escaparHtml(m.descripcion || '') + '</td>' +
          '<td style="text-align:right;">' + (m.debito > 0 ? formatearMonto(m.debito) : '') + '</td>' +
          '<td style="text-align:right;">' + (m.credito > 0 ? formatearMonto(m.credito) : '') + '</td>' +
          '<td style="text-align:right;">' + formatearMonto(m.saldo_acumulado) + '</td></tr>';
      });
    });
  }

  document.getElementById('tabla-reporte').innerHTML =
    '<thead><tr><th>Nº Asiento</th><th>Fecha</th><th>Descripción</th><th style="text-align:right;">Débito</th><th style="text-align:right;">Crédito</th><th style="text-align:right;">Saldo</th></tr></thead>' +
    '<tbody>' + filas + '</tbody>';

  document.getElementById('panel-resultado').style.display = 'block';
}


function dibujarLibroDiario(r) {
  document.getElementById('resultado-titulo').textContent = 'Libro Diario';

  let filas = '';
  r.asientos.forEach((a) => {
    filas += '<tr style="background:#eef1f7;"><td colspan="3"><b>' + escaparHtml(a.numero_asiento) + '</b> — ' + formatearFecha(a.fecha) +
      (a.descripcion ? ' — ' + escaparHtml(a.descripcion) : '') +
      ' <span class="etiqueta-estado ' + (a.estado === 'contabilizado' ? 'activo' : 'pendiente') + '" style="margin-left:8px;">' + (a.estado === 'contabilizado' ? 'Contabilizado' : 'Pendiente') + '</span></td>' +
      '<td style="text-align:right;"></td><td style="text-align:right;"></td></tr>';
    a.asientos_detalle.forEach((l) => {
      filas += '<tr><td></td><td>' + escaparHtml(l.cuentas_contables ? l.cuentas_contables.codigo + ' — ' + l.cuentas_contables.nombre : '') + '</td>' +
        '<td>' + escaparHtml(l.descripcion || '') + '</td>' +
        '<td style="text-align:right;">' + (Number(l.debito) > 0 ? formatearMonto(l.debito) : '') + '</td>' +
        '<td style="text-align:right;">' + (Number(l.credito) > 0 ? formatearMonto(l.credito) : '') + '</td></tr>';
    });
  });

  if (r.asientos.length === 0) filas = '<tr><td colspan="5" class="estado-vacio">No hay asientos con esos filtros.</td></tr>';

  document.getElementById('tabla-reporte').innerHTML =
    '<thead><tr><th></th><th>Cuenta</th><th>Descripción</th><th style="text-align:right;">Débito</th><th style="text-align:right;">Crédito</th></tr></thead>' +
    '<tbody>' + filas + '</tbody>' +
    '<tfoot><tr><td colspan="3"><b>TOTALES</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totales.debito) + '</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totales.credito) + '</b></td></tr></tfoot>';

  document.getElementById('panel-resultado').style.display = 'block';
}

const TIPOS_LABEL = { activo: 'Activo', pasivo: 'Pasivo', patrimonio: 'Patrimonio', ingreso: 'Ingreso', gasto: 'Gasto', costo: 'Costo' };

function dibujarBalanceComprobacion(r) {
  document.getElementById('resultado-titulo').textContent = 'Balance de Comprobación';

  const filas = r.cuentas.length === 0
    ? '<tr><td colspan="6" class="estado-vacio">No hay movimientos con esos filtros.</td></tr>'
    : r.cuentas.map((c) => (
        '<tr><td>' + escaparHtml(c.codigo) + '</td><td>' + escaparHtml(c.nombre) + '</td><td>' + (TIPOS_LABEL[c.tipo] || c.tipo) + '</td>' +
        '<td style="text-align:right;">' + formatearMonto(c.debito) + '</td><td style="text-align:right;">' + formatearMonto(c.credito) + '</td>' +
        '<td style="text-align:right;">' + formatearMonto(c.saldo) + '</td></tr>'
      )).join('');

  document.getElementById('tabla-reporte').innerHTML =
    '<thead><tr><th>Código</th><th>Cuenta</th><th>Tipo</th><th style="text-align:right;">Débito</th><th style="text-align:right;">Crédito</th><th style="text-align:right;">Saldo</th></tr></thead>' +
    '<tbody>' + filas + '</tbody>' +
    '<tfoot><tr><td colspan="3"><b>TOTALES</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totales.debito) + '</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totales.credito) + '</b></td><td></td></tr></tfoot>';

  document.getElementById('panel-resultado').style.display = 'block';
}

function dibujarEstadoResultados(r) {
  document.getElementById('resultado-titulo').textContent = 'Estado de Resultados';

  const filaIngresos = r.ingresos.map((f) => '<tr><td>' + escaparHtml(f.codigo) + '</td><td>' + escaparHtml(f.nombre) + '</td><td style="text-align:right;">' + formatearMonto(f.monto) + '</td></tr>').join('');
  const filaGastos = r.gastosYCostos.map((f) => '<tr><td>' + escaparHtml(f.codigo) + '</td><td>' + escaparHtml(f.nombre) + '</td><td style="text-align:right;">' + formatearMonto(f.monto) + '</td></tr>').join('');

  document.getElementById('tabla-reporte').innerHTML =
    '<thead><tr><th colspan="3" style="background:#0f3460;">INGRESOS</th></tr></thead>' +
    '<tbody>' + (filaIngresos || '<tr><td colspan="3" class="estado-vacio">Sin ingresos en el rango.</td></tr>') +
    '<tr><td colspan="2"><b>Total Ingresos</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totalIngresos) + '</b></td></tr>' +
    '<tr><td colspan="3" style="background:#0f3460; color:#fff;"><b>GASTOS Y COSTOS</b></td></tr>' +
    (filaGastos || '<tr><td colspan="3" class="estado-vacio">Sin gastos/costos en el rango.</td></tr>') +
    '<tr><td colspan="2"><b>Total Gastos y Costos</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totalGastosCostos) + '</b></td></tr>' +
    '</tbody>' +
    '<tfoot><tr><td colspan="2"><b>' + (r.utilidadNeta >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA') + '</b></td><td style="text-align:right;"><b>' + formatearMonto(Math.abs(r.utilidadNeta)) + '</b></td></tr></tfoot>';

  document.getElementById('panel-resultado').style.display = 'block';
}

function dibujarBalanceGeneral(r) {
  document.getElementById('resultado-titulo').textContent = 'Balance General (al ' + formatearFecha(r.hasta) + ')';

  const filaActivos = r.activos.map((f) => '<tr><td>' + escaparHtml(f.codigo) + '</td><td>' + escaparHtml(f.nombre) + '</td><td style="text-align:right;">' + formatearMonto(f.saldo) + '</td></tr>').join('');
  const filaPasivos = r.pasivos.map((f) => '<tr><td>' + escaparHtml(f.codigo) + '</td><td>' + escaparHtml(f.nombre) + '</td><td style="text-align:right;">' + formatearMonto(f.saldo) + '</td></tr>').join('');
  const filaPatrimonio = r.patrimonio.map((f) => '<tr><td>' + escaparHtml(f.codigo) + '</td><td>' + escaparHtml(f.nombre) + '</td><td style="text-align:right;">' + formatearMonto(f.saldo) + '</td></tr>').join('');

  document.getElementById('tabla-reporte').innerHTML =
    '<thead><tr><th colspan="3" style="background:#0f3460; color:#fff;">ACTIVOS</th></tr></thead>' +
    '<tbody>' + (filaActivos || '<tr><td colspan="3" class="estado-vacio">Sin activos.</td></tr>') +
    '<tr><td colspan="2"><b>Total Activos</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totalActivos) + '</b></td></tr>' +
    '<tr><td colspan="3" style="background:#0f3460; color:#fff;"><b>PASIVOS</b></td></tr>' +
    (filaPasivos || '<tr><td colspan="3" class="estado-vacio">Sin pasivos.</td></tr>') +
    '<tr><td colspan="2"><b>Total Pasivos</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totalPasivos) + '</b></td></tr>' +
    '<tr><td colspan="3" style="background:#0f3460; color:#fff;"><b>PATRIMONIO</b></td></tr>' +
    (filaPatrimonio || '<tr><td colspan="3" class="estado-vacio">Sin patrimonio.</td></tr>') +
    '<tr><td colspan="2"><b>Total Patrimonio</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totalPatrimonio) + '</b></td></tr>' +
    '</tbody>' +
    '<tfoot><tr><td colspan="2"><b>Pasivo + Patrimonio</b></td><td style="text-align:right;"><b>' + formatearMonto(r.totalPasivoMasPatrimonio) + '</b></td></tr>' +
    (Math.abs(r.totalActivos - r.totalPasivoMasPatrimonio) > 0.01
      ? '<tr><td colspan="3" style="color:#b42318; text-align:center;"><b>⚠ El balance no cuadra: Activos (' + formatearMonto(r.totalActivos) + ') ≠ Pasivo+Patrimonio (' + formatearMonto(r.totalPasivoMasPatrimonio) + ')</b></td></tr>'
      : '') +
    '</tfoot>';

  document.getElementById('panel-resultado').style.display = 'block';
}

// ---------- Imprimir, con el mismo motor de plantillas del Administrativo ----------

function obtenerDatosParaImprimir() {
  return {
    titulo_documento: document.getElementById('resultado-titulo').textContent,
    numero_documento: '',
    fecha_documento: new Date().toLocaleDateString('es-VE'),
    tabla_html: document.getElementById('tabla-reporte').innerHTML,
  };
}

document.getElementById('boton-imprimir-reporte').addEventListener('click', () => {
  if (!tipoReporteActual) return;
  abrirSelectorImpresion(tipoReporteActual.replace(/-/g, '_'), obtenerDatosParaImprimir);
});

// ---------- Exportar a CSV — toma lo que ya está dibujado en pantalla ----------
// (los 4 reportes tienen formas de tabla distintas; en vez de duplicar
// lógica para cada uno, se convierte directo la tabla ya renderizada.)

function celdaCSV(texto) {
  return '"' + String(texto || '').replace(/"/g, '""') + '"';
}

document.getElementById('boton-csv-reporte').addEventListener('click', () => {
  const tabla = document.getElementById('tabla-reporte');
  const filas = [...tabla.querySelectorAll('tr')];
  if (filas.length === 0) return;

  const lineas = filas.map((fila) =>
    [...fila.querySelectorAll('th, td')].map((celda) => celdaCSV(celda.textContent.trim())).join(';')
  );

  const nombreArchivo = (tipoReporteActual || 'reporte') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(enlace.href);
});

// Si se llega desde el menú con ?tipo=..., se preselecciona y se
// genera de una vez, sin que el usuario tenga que darle a "Generar".
(function preseleccionarDesdeUrl() {
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get('tipo');
  if (!tipo) return;
  const select = document.getElementById('reporte-tipo');
  if ([...select.options].some((o) => o.value === tipo)) {
    select.value = tipo;
    generarReporte();
  }
})();

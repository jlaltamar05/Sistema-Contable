function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

document.getElementById('boton-generar-reporte').addEventListener('click', generarReporte);

async function generarReporte() {
  const tipo = document.getElementById('reporte-tipo').value;
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
    } else {
      const r = await llamarApi('/reportes-contables/balance-comprobacion' + query);
      dibujarBalanceComprobacion(r);
    }
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
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

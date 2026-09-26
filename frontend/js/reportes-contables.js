// REPORTES CONTABLES — mismo estilo que los informes del Administrativo:
// filtros a la izquierda y el reporte en hojas tamaño carta (encabezado
// con logo, compañía, RIF, título, período, fecha de impresión y número
// de página), con Ajustar al ancho, Imprimir / PDF y Exportar a Excel.
//
// Cada reporte se arma como una lista de filas; luego se mide cada fila y
// se reparte en páginas para que la vista previa sea igual a lo impreso.

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const $ = (id) => document.getElementById(id);
const MM = 96 / 25.4;
const MARGEN = Math.round(12 * MM);
const HOJA = { vertical: { w: 816, h: 1056 }, horizontal: { w: 1056, h: 816 } };
const NOMBRES = {
  'libro-diario': 'Libro Diario',
  'libro-mayor': 'Libro Mayor',
  'balance-comprobacion': 'Balance de Comprobación',
  'estado-resultados': 'Estado de Resultados (Pérdidas y Ganancias)',
  'balance-general': 'Balance General',
};
const ESTATUS = { todos: 'Contabilizados y pendientes', contabilizado: 'Solo contabilizados', pendiente: 'Solo pendientes' };
const TIPOS_LABEL = { activo: 'Activo', pasivo: 'Pasivo', patrimonio: 'Patrimonio', ingreso: 'Ingreso', gasto: 'Gasto', costo: 'Costo' };

let reporteActual = null;   // { tipo, titulo, subtitulo, columnas, filas, orientacion }
let compania = null;

// ---------- Fechas ----------

function isoLocal(f) { return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0'); }
function fechaCorta(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || ''); }

function aplicarAtajo(atajo) {
  const hoy = new Date();
  let desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  let hasta = hoy;
  if (atajo === 'mes-anterior') { desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0); }
  if (atajo === 'anio') desde = new Date(hoy.getFullYear(), 0, 1);
  $('reporte-desde').value = isoLocal(desde);
  $('reporte-hasta').value = isoLocal(hasta);
}
$('atajos-fechas').addEventListener('click', (e) => { const b = e.target.closest('[data-atajo]'); if (b) aplicarAtajo(b.dataset.atajo); });

function ajustarFiltrosSegunTipo() {
  const esCorte = $('reporte-tipo').value === 'balance-general';
  $('campo-desde').style.display = esCorte ? 'none' : '';
  $('etiqueta-hasta').textContent = esCorte ? 'Al (fecha de corte)' : 'Hasta';
}
$('reporte-tipo').addEventListener('change', ajustarFiltrosSegunTipo);

// ---------- Filas ----------
// celda: { v: valor, t: 'texto' | 'monto' | 'fecha', span: n }

const txt = (v, span) => ({ v: v === null || v === undefined ? '' : v, t: 'texto', span });
const mon = (v, soloSiDistinto) => ({ v: (soloSiDistinto && !Number(v)) ? '' : Number(v) || 0, t: 'monto' });
const fec = (v) => ({ v, t: 'fecha' });
const fila = (clase, celdas) => ({ clase, celdas });

// Montos con separador de miles siempre (4.640,00), como en el Administrativo
const FMT_MONTO = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function montoTexto(v) { return FMT_MONTO.format(Number(v) || 0); }

function textoCelda(c) {
  if (c.v === '' || c.v === null || c.v === undefined) return '';
  if (c.t === 'monto') return montoTexto(c.v);
  if (c.t === 'fecha') return fechaCorta(c.v);
  return String(c.v);
}

// ---------- Armado de cada reporte ----------

const ARMAR = {
  'libro-diario'(r) {
    // El número, fecha, descripción y estatus van en la línea del asiento;
    // debajo, sus cuentas con débito y crédito, y el cuadre del asiento.
    const columnas = [
      { t: 'Cuenta', w: 44 }, { t: 'Descripción', w: 32 }, { t: 'Débito', w: 12, a: 'der' }, { t: 'Crédito', w: 12, a: 'der' },
    ];
    const filas = [];
    r.asientos.forEach((a) => {
      const estado = a.estado === 'contabilizado' ? 'Contabilizado' : 'Pendiente';
      filas.push(fila('grupo', [txt('Asiento ' + a.numero_asiento + '  ·  ' + fechaCorta(a.fecha) + (a.descripcion ? '  ·  ' + a.descripcion : '') + '  ·  ' + estado, 4)]));
      let d = 0; let c = 0;
      a.asientos_detalle.forEach((l) => {
        d += Number(l.debito) || 0; c += Number(l.credito) || 0;
        filas.push(fila('', [
          txt(l.cuentas_contables ? l.cuentas_contables.codigo + ' — ' + l.cuentas_contables.nombre : ''),
          txt(l.descripcion || ''), mon(l.debito, true), mon(l.credito, true),
        ]));
      });
      filas.push(fila('subtotal', [txt('', 2), mon(d), mon(c)]));
    });
    if (r.asientos.length === 0) filas.push(fila('vacio', [txt('No hay asientos con esos filtros.', 4)]));
    else filas.push(fila('total', [txt('TOTALES (' + r.asientos.length + ' asientos)', 2), mon(r.totales.debito), mon(r.totales.credito)]));
    return { columnas, filas };
  },

  'libro-mayor'(r) {
    const columnas = [
      { t: 'Asiento', w: 11 }, { t: 'Fecha', w: 10 }, { t: 'Descripción', w: 37 },
      { t: 'Débito', w: 14, a: 'der' }, { t: 'Crédito', w: 14, a: 'der' }, { t: 'Saldo', w: 14, a: 'der' },
    ];
    const filas = [];
    r.cuentas.forEach((cta) => {
      filas.push(fila('grupo', [txt(cta.codigo + ' — ' + cta.nombre, 6)]));
      let d = 0; let c = 0;
      cta.movimientos.forEach((m) => {
        d += Number(m.debito) || 0; c += Number(m.credito) || 0;
        filas.push(fila('', [txt(m.numero_asiento), fec(m.fecha), txt(m.descripcion || ''), mon(m.debito, true), mon(m.credito, true), mon(m.saldo_acumulado)]));
      });
      filas.push(fila('subtotal', [txt('Totales de la cuenta', 3), mon(d), mon(c), mon(cta.saldo_final)]));
    });
    if (r.cuentas.length === 0) filas.push(fila('vacio', [txt('No hay movimientos con esos filtros.', 6)]));
    return { columnas, filas };
  },

  'balance-comprobacion'(r) {
    const columnas = [
      { t: 'Código', w: 15 }, { t: 'Cuenta', w: 40 }, { t: 'Tipo', w: 10 },
      { t: 'Débito', w: 12, a: 'der' }, { t: 'Crédito', w: 12, a: 'der' }, { t: 'Saldo', w: 11, a: 'der' },
    ];
    const filas = r.cuentas.map((c) => fila('', [txt(c.codigo), txt(c.nombre), txt(TIPOS_LABEL[c.tipo] || c.tipo), mon(c.debito), mon(c.credito), mon(c.saldo)]));
    if (filas.length === 0) filas.push(fila('vacio', [txt('No hay movimientos con esos filtros.', 6)]));
    else {
      filas.push(fila('total', [txt('TOTALES', 3), mon(r.totales.debito), mon(r.totales.credito), txt('')]));
      if (Math.abs(r.totales.debito - r.totales.credito) > 0.01) {
        filas.push(fila('aviso', [txt('⚠ Débitos y créditos no cuadran: diferencia de ' + montoTexto(r.totales.debito - r.totales.credito), 6)]));
      }
    }
    return { columnas, filas };
  },

  'estado-resultados'(r) {
    const columnas = [{ t: 'Código', w: 18 }, { t: 'Cuenta', w: 57 }, { t: 'Monto', w: 25, a: 'der' }];
    const filas = [];
    filas.push(fila('seccion', [txt('INGRESOS', 3)]));
    r.ingresos.forEach((f) => filas.push(fila('', [txt(f.codigo), txt(f.nombre), mon(f.monto)])));
    if (r.ingresos.length === 0) filas.push(fila('vacio', [txt('Sin ingresos en el período.', 3)]));
    filas.push(fila('subtotal', [txt('Total ingresos', 2), mon(r.totalIngresos)]));
    filas.push(fila('seccion', [txt('COSTOS Y GASTOS', 3)]));
    r.gastosYCostos.forEach((f) => filas.push(fila('', [txt(f.codigo), txt(f.nombre), mon(f.monto)])));
    if (r.gastosYCostos.length === 0) filas.push(fila('vacio', [txt('Sin costos ni gastos en el período.', 3)]));
    filas.push(fila('subtotal', [txt('Total costos y gastos', 2), mon(r.totalGastosCostos)]));
    filas.push(fila('total', [txt(r.utilidadNeta >= 0 ? 'UTILIDAD NETA DEL PERÍODO' : 'PÉRDIDA NETA DEL PERÍODO', 2), mon(Math.abs(r.utilidadNeta))]));
    return { columnas, filas };
  },

  'balance-general'(r) {
    const columnas = [{ t: 'Código', w: 18 }, { t: 'Cuenta', w: 57 }, { t: 'Saldo', w: 25, a: 'der' }];
    const filas = [];
    const seccion = (titulo, lista, total, etiquetaTotal) => {
      filas.push(fila('seccion', [txt(titulo, 3)]));
      lista.forEach((f) => filas.push(fila('', [txt(f.codigo), txt(f.nombre), mon(f.saldo)])));
      if (lista.length === 0) filas.push(fila('vacio', [txt('Sin saldos.', 3)]));
      filas.push(fila('subtotal', [txt(etiquetaTotal, 2), mon(total)]));
    };
    seccion('ACTIVOS', r.activos, r.totalActivos, 'Total activos');
    seccion('PASIVOS', r.pasivos, r.totalPasivos, 'Total pasivos');
    seccion('PATRIMONIO', r.patrimonio, r.totalPatrimonio, 'Total patrimonio');
    filas.push(fila('total', [txt('TOTAL PASIVO + PATRIMONIO', 2), mon(r.totalPasivoMasPatrimonio)]));
    if (Math.abs(r.totalActivos - r.totalPasivoMasPatrimonio) > 0.01) {
      filas.push(fila('aviso', [txt('⚠ El balance no cuadra: Activos (' + montoTexto(r.totalActivos) + ') ≠ Pasivo + Patrimonio (' + montoTexto(r.totalPasivoMasPatrimonio) + ')', 3)]));
    }
    return { columnas, filas };
  },
};

// ---------- Generar ----------

async function cargarCompania() {
  if (compania) return compania;
  try { compania = await llamarApi('/companias/' + obtenerCompaniaActualId()); } catch (e) { compania = {}; }
  return compania || {};
}

async function generarReporte() {
  const tipo = $('reporte-tipo').value;
  const desde = $('reporte-desde').value;
  const hasta = $('reporte-hasta').value;
  const estado = $('reporte-estado').value;
  const esCorte = tipo === 'balance-general';

  if (!esCorte && desde && hasta && desde > hasta) {
    mostrarMensaje('La fecha "Desde" no puede ser mayor que "Hasta".', 'error');
    return;
  }

  const params = [];
  if (desde && !esCorte) params.push('desde=' + desde);
  if (hasta) params.push('hasta=' + hasta);
  if (estado) params.push('estado=' + estado);

  const boton = $('boton-generar-reporte');
  boton.disabled = true;
  boton.textContent = 'Generando…';
  $('visor-resumen').textContent = '';
  try {
    const [r] = await Promise.all([
      llamarApi('/reportes-contables/' + tipo + (params.length ? '?' + params.join('&') : '')),
      cargarCompania(),
    ]);
    const armado = ARMAR[tipo](r);
    const periodo = esCorte
      ? 'Al ' + fechaCorta(r.hasta || hasta)
      : 'Desde ' + (desde ? fechaCorta(desde) : 'el inicio') + ' hasta ' + (hasta ? fechaCorta(hasta) : 'hoy');
    reporteActual = {
      tipo,
      titulo: NOMBRES[tipo],
      subtitulo: periodo + ' · ' + ESTATUS[estado],
      columnas: armado.columnas,
      filas: armado.filas,
      orientacion: $('reporte-orientacion').value,
    };
    dibujarPaginas();
    history.replaceState(null, '', 'reportes-contables.html?tipo=' + tipo);
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Generar reporte';
  }
}
$('boton-generar-reporte').addEventListener('click', generarReporte);
$('reporte-orientacion').addEventListener('change', () => {
  if (!reporteActual) return;
  reporteActual.orientacion = $('reporte-orientacion').value;
  dibujarPaginas();
});

// ---------- Hojas ----------

function htmlColgroup(columnas) {
  return '<colgroup>' + columnas.map((c) => '<col style="width:' + c.w + '%">').join('') + '</colgroup>';
}
function htmlThead(columnas) {
  return '<thead><tr>' + columnas.map((c) => '<th class="' + (c.a || '') + '">' + escaparHtml(c.t) + '</th>').join('') + '</tr></thead>';
}
function htmlFila(f, columnas) {
  let i = 0;
  const celdas = f.celdas.map((c) => {
    const col = columnas[i] || {};
    const span = c.span || 1;
    i += span;
    const clase = c.t === 'monto' ? 'der' : (span === 1 ? (col.a || '') : '');
    return '<td' + (span > 1 ? ' colspan="' + span + '"' : '') + (clase ? ' class="' + clase + '"' : '') + '>' + escaparHtml(textoCelda(c)) + '</td>';
  }).join('');
  return '<tr class="' + f.clase + '">' + celdas + '</tr>';
}

function htmlEncabezadoCompleto(r, ahora) {
  const c = compania || {};
  return '<div class="enc-hoja">' +
      (c.logo_url ? '<img class="logo" src="' + escaparHtml(c.logo_url) + '" alt="" />' : '') +
      '<div class="cia"><div class="nombre">' + escaparHtml(c.nombre || '') + '</div><div class="rif">' + escaparHtml(c.documento || '') + '</div></div>' +
      '<div class="impreso">Impreso: ' + ahora + '</div>' +
    '</div>' +
    '<div class="titulo-hoja">' + escaparHtml(r.titulo) + '</div>' +
    '<div class="subtitulo-hoja">' + escaparHtml(r.subtitulo) + '</div>';
}
function htmlEncabezadoCorto(r) {
  const c = compania || {};
  return '<div class="enc-corto"><span><b>' + escaparHtml(c.nombre || '') + '</b> · ' + escaparHtml(r.titulo) + '</span><span>' + escaparHtml(r.subtitulo) + '</span></div>';
}

function dibujarPaginas() {
  const r = reporteActual;
  const hoja = HOJA[r.orientacion] || HOJA.vertical;
  const anchoUtil = hoja.w - 2 * MARGEN;
  const altoUtil = hoja.h - 2 * MARGEN;
  const altoPie = 22;
  const ahora = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  // 1) Medir: encabezados, títulos de columnas y cada fila, al ancho real de la hoja
  const medidor = document.createElement('div');
  medidor.className = 'pagina-informe medidor';
  medidor.style.width = anchoUtil + 'px';
  medidor.innerHTML =
    '<div id="m-enc">' + htmlEncabezadoCompleto(r, ahora) + '</div>' +
    '<div id="m-corto">' + htmlEncabezadoCorto(r) + '</div>' +
    '<table class="hoja">' + htmlColgroup(r.columnas) + htmlThead(r.columnas) + '<tbody>' + r.filas.map((f) => htmlFila(f, r.columnas)).join('') + '</tbody></table>';
  document.body.appendChild(medidor);
  const altoEnc = medidor.querySelector('#m-enc').offsetHeight;
  const altoCorto = medidor.querySelector('#m-corto').offsetHeight;
  const altoThead = medidor.querySelector('thead').offsetHeight;
  const altos = [...medidor.querySelectorAll('tbody tr')].map((tr) => tr.offsetHeight);
  medidor.remove();

  // 2) Repartir las filas en páginas (un título de grupo nunca queda solo al pie)
  const paginas = [];
  let actual = [];
  let usado = 0;
  let disponible = altoUtil - altoPie - altoEnc - altoThead;
  r.filas.forEach((f, i) => {
    const h = altos[i] || 18;
    const esTitulo = f.clase === 'grupo' || f.clase === 'seccion';
    const extra = esTitulo ? (altos[i + 1] || 0) : 0;
    if (actual.length > 0 && usado + h + extra > disponible) {
      paginas.push(actual);
      actual = [];
      usado = 0;
      disponible = altoUtil - altoPie - altoCorto - altoThead;
    }
    actual.push(f);
    usado += h;
  });
  paginas.push(actual);

  // 3) Dibujar
  const total = paginas.length;
  $('paginas-informe').innerHTML = paginas.map((filas, i) => (
    '<div class="pagina-informe" style="width:' + hoja.w + 'px;height:' + hoja.h + 'px;padding:' + MARGEN + 'px">' +
      '<div class="contenido-pagina">' +
        (i === 0 ? htmlEncabezadoCompleto(r, ahora) : htmlEncabezadoCorto(r)) +
        '<table class="hoja">' + htmlColgroup(r.columnas) + htmlThead(r.columnas) + '<tbody>' + filas.map((f) => htmlFila(f, r.columnas)).join('') + '</tbody></table>' +
        '<div class="pie-hoja"><span>' + escaparHtml(r.titulo) + '</span><span>Página ' + (i + 1) + ' de ' + total + '</span></div>' +
      '</div>' +
    '</div>'
  )).join('');

  $('visor-resumen').textContent = total + ' página(s)';
  aplicarZoom();
}

// ---------- Zoom, filtros plegables ----------

function aplicarZoom() {
  const contenedor = $('paginas-informe');
  if (!reporteActual) return;
  const valor = $('visor-zoom').value;
  let factor = Number(valor) || 1;
  if (valor === 'ajustar') {
    contenedor.style.zoom = 1;
    const hoja = HOJA[reporteActual.orientacion] || HOJA.vertical;
    factor = Math.min(1, (contenedor.clientWidth - 40) / hoja.w);
  }
  contenedor.style.zoom = factor;
}
$('visor-zoom').addEventListener('change', aplicarZoom);
window.addEventListener('resize', aplicarZoom);
$('boton-plegar-filtros').addEventListener('click', () => { $('visor-cuerpo').classList.add('sin-filtros'); aplicarZoom(); });
$('boton-mostrar-filtros').addEventListener('click', () => { $('visor-cuerpo').classList.remove('sin-filtros'); aplicarZoom(); });

// ---------- Imprimir / PDF ----------

$('boton-imprimir-reporte').addEventListener('click', () => {
  if (!reporteActual) { mostrarMensaje('Primero genera un reporte.', 'error'); return; }
  const hoja = HOJA[reporteActual.orientacion] || HOJA.vertical;
  let estilo = $('estilo-pagina-impresion');
  if (!estilo) { estilo = document.createElement('style'); estilo.id = 'estilo-pagina-impresion'; document.head.appendChild(estilo); }
  estilo.textContent = '@page { size: ' + (hoja.w / 96) + 'in ' + (hoja.h / 96) + 'in; margin: 0; }';
  window.print();
});

// ---------- Exportar a Excel (CSV con ; y decimales con coma) ----------

function celdaCSV(texto) {
  const t = texto === null || texto === undefined ? '' : String(texto);
  return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

$('boton-csv-reporte').addEventListener('click', () => {
  if (!reporteActual) { mostrarMensaje('Primero genera un reporte.', 'error'); return; }
  const r = reporteActual;
  const lineas = [celdaCSV(r.titulo), celdaCSV(r.subtitulo), '', r.columnas.map((c) => celdaCSV(c.t)).join(';')];
  r.filas.forEach((f) => {
    const valores = [];
    f.celdas.forEach((c) => {
      let v = c.v;
      if (c.t === 'monto' && v !== '') v = String(Math.round(Number(v) * 100) / 100).replace('.', ',');
      else if (c.t === 'fecha') v = fechaCorta(v);
      valores.push(celdaCSV(v));
      for (let k = 1; k < (c.span || 1); k++) valores.push('');
    });
    lineas.push(valores.join(';'));
  });
  const blob = new Blob(['\ufeff' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = r.tipo + '_' + isoLocal(new Date()) + '.csv';
  document.body.appendChild(enlace);
  enlace.click();
  setTimeout(() => { URL.revokeObjectURL(enlace.href); enlace.remove(); }, 1000);
});

// ---------- Inicio ----------
// Si se llega desde el menú con ?tipo=..., se preselecciona y se genera de una vez.

(function iniciar() {
  aplicarAtajo('mes');
  const tipo = new URLSearchParams(window.location.search).get('tipo');
  const select = $('reporte-tipo');
  if (tipo && [...select.options].some((o) => o.value === tipo)) select.value = tipo;
  ajustarFiltrosSegunTipo();
  if (tipo) generarReporte();
})();

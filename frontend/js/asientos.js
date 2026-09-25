function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let asientos = [];
let cuentasDisponibles = [];
let centrosDisponibles = [];
let contadorLinea = 0;

const ETIQUETAS_ORIGEN = {
  manual: 'Manual', ajuste: 'Ajuste contable', depreciacion: 'Depreciación',
  nomina: 'Nómina', provision: 'Provisión',
  apertura_ejercicio: 'Apertura de ejercicio', cierre_ejercicio: 'Cierre de ejercicio',
};

async function cargarCuentas() {
  try {
    cuentasDisponibles = (await llamarApi('/cuentas-contables')).filter((c) => c.acepta_movimiento && c.activa);
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
  try {
    centrosDisponibles = (await llamarApi('/centros-costo')).filter((c) => c.activo);
  } catch (err) {
    // silencioso — si no carga, la columna queda con "(ninguno)" nada más
  }
}

// ---------- Buscar / listar ----------

document.getElementById('boton-buscar-asientos').addEventListener('click', buscarAsientos);

async function buscarAsientos() {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;
  const estado = document.getElementById('filtro-estado').value;

  const params = [];
  if (desde) params.push('desde=' + desde);
  if (hasta) params.push('hasta=' + hasta);
  if (estado) params.push('estado=' + estado);

  try {
    asientos = await llamarApi('/asientos' + (params.length ? '?' + params.join('&') : ''));
    dibujarTabla();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function dibujarTabla() {
  const tbody = document.getElementById('tabla-asientos');
  if (asientos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="estado-vacio">No hay asientos con esos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = asientos.map((a) => (
    '<tr>' +
    '<td>' + escaparHtml(a.numero_asiento) + '</td>' +
    '<td>' + formatearFecha(a.fecha) + '</td>' +
    '<td>' + escaparHtml(a.descripcion || '') + '</td>' +
    '<td>' + escaparHtml(ETIQUETAS_ORIGEN[a.documento_origen_tipo] || a.documento_origen_tipo || 'Manual') + '</td>' +
    '<td><span class="etiqueta-estado ' + (a.estado === 'contabilizado' ? 'activo' : 'pendiente') + '">' + (a.estado === 'contabilizado' ? 'Contabilizado' : 'Pendiente') + '</span></td>' +
    '<td class="celda-acciones">' +
    '<button type="button" class="boton boton-secundario" data-accion="ver" data-id="' + a.id + '">Ver</button> ' +
    (a.estado === 'pendiente'
      ? '<button type="button" class="boton boton-primario" data-accion="contabilizar" data-id="' + a.id + '">Contabilizar</button> ' +
        '<button type="button" class="boton boton-peligro" data-accion="eliminar" data-id="' + a.id + '">Eliminar</button>'
      : '<button type="button" class="boton boton-secundario" data-accion="reversar" data-id="' + a.id + '">Reversar</button>') +
    '</td></tr>'
  )).join('');
}

document.getElementById('tabla-asientos').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const id = boton.dataset.id;

  if (boton.dataset.accion === 'ver') return verDetalle(id);

  if (boton.dataset.accion === 'contabilizar') {
    if (!confirm('¿Pasar este asiento a Contabilizado? Una vez contabilizado, ya no se edita — solo se reversa.')) return;
    try {
      await llamarApi('/asientos/' + id + '/contabilizar', { method: 'POST' });
      mostrarMensaje('Asiento contabilizado.', 'exito');
      buscarAsientos();
    } catch (err) { mostrarMensaje(err.message, 'error'); }
  }

  if (boton.dataset.accion === 'reversar') {
    if (!confirm('¿Reversar este asiento? Se creará un asiento nuevo que anula su efecto.')) return;
    try {
      await llamarApi('/asientos/' + id + '/reversar', { method: 'POST' });
      mostrarMensaje('Asiento reversado.', 'exito');
      buscarAsientos();
    } catch (err) { mostrarMensaje(err.message, 'error'); }
  }

  if (boton.dataset.accion === 'eliminar') {
    if (!confirm('¿Eliminar este asiento pendiente?')) return;
    try {
      await llamarApi('/asientos/' + id, { method: 'DELETE' });
      mostrarMensaje('Asiento eliminado.', 'exito');
      buscarAsientos();
    } catch (err) { mostrarMensaje(err.message, 'error'); }
  }
});

// ---------- Ver detalle ----------

async function verDetalle(id) {
  try {
    const a = await llamarApi('/asientos/' + id);
    document.getElementById('detalle-titulo').textContent = 'Asiento ' + a.numero_asiento;
    document.getElementById('detalle-info').textContent = formatearFecha(a.fecha) + ' · ' + (a.estado === 'contabilizado' ? 'Contabilizado' : 'Pendiente') + (a.descripcion ? ' · ' + a.descripcion : '');
    document.getElementById('tabla-detalle-lineas').innerHTML = a.asientos_detalle.map((l) => (
      '<tr><td>' + escaparHtml(l.cuentas_contables ? l.cuentas_contables.codigo + ' — ' + l.cuentas_contables.nombre : '') + '</td>' +
      '<td>' + escaparHtml(l.centros_costo ? l.centros_costo.codigo + ' — ' + l.centros_costo.nombre : '—') + '</td>' +
      '<td>' + escaparHtml(l.descripcion || '') + '</td>' +
      '<td style="text-align:right;">' + (Number(l.debito) > 0 ? formatearMonto(l.debito) : '') + '</td>' +
      '<td style="text-align:right;">' + (Number(l.credito) > 0 ? formatearMonto(l.credito) : '') + '</td></tr>'
    )).join('');
    document.getElementById('modal-detalle').style.display = 'block';
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}
document.getElementById('boton-cerrar-modal-detalle').addEventListener('click', () => {
  document.getElementById('modal-detalle').style.display = 'none';
});

// ---------- Nuevo asiento manual ----------

document.getElementById('boton-nuevo-asiento').addEventListener('click', async () => {
  document.getElementById('form-asiento').reset();
  document.getElementById('lineas-asiento').innerHTML = '';
  agregarLinea();
  agregarLinea();
  document.getElementById('modal-asiento').style.display = 'block';
  actualizarTotales();

  const previsto = document.getElementById('asiento-estado-previsto');
  previsto.textContent = '';
  try {
    const config = await llamarApi('/configuracion-contable');
    const ETIQUETAS_MODO = {
      automatico: 'Este asiento se creará ya como Contabilizado (modo automático).',
      manual: 'Este asiento se creará como Pendiente — hay que contabilizarlo aparte.',
      proceso: 'Este asiento se creará como Pendiente — se contabiliza por lote, en Proceso de Contabilización.',
    };
    previsto.textContent = ETIQUETAS_MODO[config.modo_contabilizacion] || '';
  } catch (err) {
    // silencioso — si falla, simplemente no se muestra el aviso
  }
});
document.getElementById('boton-cerrar-modal-asiento').addEventListener('click', () => {
  document.getElementById('modal-asiento').style.display = 'none';
});

function renumerarFilas() {
  document.querySelectorAll('#lineas-asiento tr').forEach((fila, i) => {
    const celdaNumero = fila.querySelector('.col-item');
    if (celdaNumero) celdaNumero.textContent = i + 1;
  });
}

function esUltimaFila(fila) {
  return fila === document.getElementById('lineas-asiento').lastElementChild;
}

function agregarLinea() {
  contadorLinea++;
  const idLinea = 'linea-' + contadorLinea;
  const opciones = '<option value="">Elige una cuenta...</option>' +
    cuentasDisponibles.map((c) => '<option value="' + c.id + '">' + escaparHtml(c.codigo + ' — ' + c.nombre) + '</option>').join('');
  const opcionesCentro = '<option value="">(ninguno)</option>' +
    centrosDisponibles.map((c) => '<option value="' + c.id + '">' + escaparHtml(c.codigo + ' — ' + c.nombre) + '</option>').join('');

  const fila = document.createElement('tr');
  fila.id = idLinea;
  fila.innerHTML =
    '<td class="col-item">' + (document.querySelectorAll('#lineas-asiento tr').length + 1) + '</td>' +
    '<td class="celda-editable"><select class="linea-cuenta">' + opciones + '</select></td>' +
    '<td class="celda-editable"><select class="linea-centro-costo">' + opcionesCentro + '</select></td>' +
    '<td class="celda-editable col-num"><input type="number" class="linea-debito col-num-input" step="0.01" min="0" value="0" /></td>' +
    '<td class="celda-editable col-num"><input type="number" class="linea-credito col-num-input" step="0.01" min="0" value="0" /></td>' +
    '<td><button type="button" class="boton-quitar-fila" data-quitar="' + idLinea + '">✕</button></td>';

  document.getElementById('lineas-asiento').appendChild(fila);
  fila.querySelector('.linea-debito').addEventListener('input', actualizarTotales);
  fila.querySelector('.linea-credito').addEventListener('input', actualizarTotales);

  // Igual que en Pedidos: al elegir cuenta en la última fila, se agrega
  // sola una fila nueva en blanco al final, para seguir capturando.
  fila.querySelector('.linea-cuenta').addEventListener('change', function() {
    if (this.value && esUltimaFila(fila)) agregarLinea();
  });

  return fila;
}
document.getElementById('boton-agregar-linea').addEventListener('click', agregarLinea);

document.getElementById('lineas-asiento').addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-quitar]');
  if (!boton) return;
  document.getElementById(boton.dataset.quitar).remove();
  renumerarFilas();
  actualizarTotales();
});

function actualizarTotales() {
  let debito = 0, credito = 0;
  document.querySelectorAll('.linea-debito').forEach((i) => { debito += Number(i.value) || 0; });
  document.querySelectorAll('.linea-credito').forEach((i) => { credito += Number(i.value) || 0; });

  document.getElementById('total-debito').textContent = debito.toFixed(2);
  document.getElementById('total-credito').textContent = credito.toFixed(2);

  const balance = document.getElementById('estado-balance');
  if (Math.abs(debito - credito) < 0.01 && debito > 0) {
    balance.textContent = '✓ Cuadrado';
    balance.className = '';
  } else {
    balance.textContent = '✕ No cuadra';
    balance.className = 'desbalanceado';
  }
}

document.getElementById('form-asiento').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const lineas = [...document.querySelectorAll('#lineas-asiento tr')].map((fila) => ({
    cuenta_contable_id: fila.querySelector('.linea-cuenta').value,
    centro_costo_id: fila.querySelector('.linea-centro-costo').value || null,
    debito: Number(fila.querySelector('.linea-debito').value) || 0,
    credito: Number(fila.querySelector('.linea-credito').value) || 0,
  })).filter((l) => l.debito > 0 || l.credito > 0);

  const cuerpo = {
    fecha: document.getElementById('asiento-fecha').value,
    descripcion: document.getElementById('asiento-descripcion').value.trim(),
    tipo_documento: document.getElementById('asiento-tipo-documento').value,
    lineas,
  };

  try {
    await llamarApi('/asientos', { method: 'POST', body: JSON.stringify(cuerpo) });
    mostrarMensaje('Asiento creado.', 'exito');
    document.getElementById('modal-asiento').style.display = 'none';
    buscarAsientos();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

cargarCuentas();
buscarAsientos();

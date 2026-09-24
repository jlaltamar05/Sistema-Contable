// Lógica del CONSTRUCTOR DE INFORMES: catálogo de fuentes/columnas,
// crear/editar/eliminar informes personalizados, ejecutarlos y
// mostrar el resultado (reutiliza el mismo formato que los informes
// básicos, así que imprimir/exportar CSV funciona igual).

// NOTA: escaparHtml no vive en utilidades.js — cada módulo la trae
// consigo (igual que ya hacen compras.js, facturas.js, etc.).
function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const listaGuardados = document.getElementById('lista-guardados');
const panelEditor = document.getElementById('panel-editor');
const panelResultado = document.getElementById('panel-resultado');
const tablaInforme = document.getElementById('tabla-informe');
const selectFuente = document.getElementById('editor-fuente');
const contenedorColumnas = document.getElementById('editor-columnas');
const selectOrdenPor = document.getElementById('editor-orden-por');

let metadatos = [];
let guardados = [];
let editandoId = null;
let ultimoResultado = null;

// ---------- Carga inicial ----------

async function cargarTodo() {
  try {
    [metadatos, guardados] = await Promise.all([
      llamarApi('/informes-personalizados/metadatos'),
      llamarApi('/informes-personalizados'),
    ]);
  } catch (err) {
    mostrarMensaje(err.message, 'error');
    return;
  }

  selectFuente.innerHTML = metadatos.map((f) => '<option value="' + f.fuente + '">' + escaparHtml(f.titulo) + '</option>').join('');
  dibujarGuardados();
  dibujarColumnasDisponibles();
}

function dibujarGuardados() {
  if (guardados.length === 0) {
    listaGuardados.innerHTML = '<p style="color: var(--texto-suave); font-size: 13px;">Todavía no has creado ningún informe personalizado.</p>';
    return;
  }
  listaGuardados.innerHTML = guardados.map((g) => {
    const fuenteInfo = metadatos.find((f) => f.fuente === g.fuente);
    return '<div class="fila-guardado">' +
      '<div><span class="nombre">' + escaparHtml(g.nombre) + '</span><span class="fuente">' + escaparHtml(fuenteInfo ? fuenteInfo.titulo : g.fuente) + '</span></div>' +
      '<div class="acciones">' +
      '<button type="button" class="boton boton-primario" data-accion="ejecutar" data-id="' + g.id + '">Ejecutar</button>' +
      '<button type="button" class="boton boton-secundario" data-accion="editar" data-id="' + g.id + '">Editar</button>' +
      '<button type="button" class="boton boton-secundario" data-accion="eliminar" data-id="' + g.id + '">Eliminar</button>' +
      '</div></div>';
  }).join('');
}

listaGuardados.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const id = boton.dataset.id;
  if (boton.dataset.accion === 'ejecutar') ejecutarInforme(id);
  if (boton.dataset.accion === 'editar') abrirEditor(guardados.find((g) => g.id === id));
  if (boton.dataset.accion === 'eliminar') eliminarInforme(id);
});

// ---------- Editor: columnas disponibles según la fuente elegida ----------

function dibujarColumnasDisponibles(columnasMarcadas) {
  const fuenteInfo = metadatos.find((f) => f.fuente === selectFuente.value) || metadatos[0];
  if (!fuenteInfo) return;

  contenedorColumnas.innerHTML = fuenteInfo.columnas.map((c) => (
    '<label><input type="checkbox" value="' + c.clave + '" ' + (columnasMarcadas && columnasMarcadas.includes(c.clave) ? 'checked' : '') + ' /> ' + escaparHtml(c.titulo) + '</label>'
  )).join('');

  actualizarSelectOrden();
}

selectFuente.addEventListener('change', () => dibujarColumnasDisponibles());
contenedorColumnas.addEventListener('change', actualizarSelectOrden);

function actualizarSelectOrden() {
  const marcadas = [...contenedorColumnas.querySelectorAll('input:checked')].map((i) => i.value);
  const fuenteInfo = metadatos.find((f) => f.fuente === selectFuente.value);
  const valorActual = selectOrdenPor.value;

  selectOrdenPor.innerHTML = '<option value="">(sin orden particular)</option>' +
    marcadas.map((clave) => {
      const col = fuenteInfo.columnas.find((c) => c.clave === clave);
      return '<option value="' + clave + '">' + escaparHtml(col ? col.titulo : clave) + '</option>';
    }).join('');

  if (marcadas.includes(valorActual)) selectOrdenPor.value = valorActual;
}

// ---------- Abrir / cerrar el editor ----------

document.getElementById('boton-nuevo').addEventListener('click', () => abrirEditor(null));
document.getElementById('boton-cancelar-editor').addEventListener('click', cerrarEditor);

function abrirEditor(informe) {
  editandoId = informe ? informe.id : null;
  document.getElementById('titulo-editor').textContent = informe ? 'Editar informe personalizado' : 'Nuevo informe personalizado';
  document.getElementById('editor-nombre').value = informe ? informe.nombre : '';
  selectFuente.value = informe ? informe.fuente : (metadatos[0] ? metadatos[0].fuente : '');

  dibujarColumnasDisponibles(informe ? informe.columnas : []);

  if (informe && informe.orden_por) {
    selectOrdenPor.value = informe.orden_por;
    document.getElementById('editor-orden-direccion').value = informe.orden_direccion || 'asc';
  } else {
    document.getElementById('editor-orden-direccion').value = 'asc';
  }

  panelResultado.style.display = 'none';
  panelEditor.style.display = 'block';
  panelEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cerrarEditor() {
  editandoId = null;
  panelEditor.style.display = 'none';
}

// ---------- Guardar ----------

document.getElementById('boton-guardar-informe').addEventListener('click', guardarInforme);

async function guardarInforme() {
  const nombre = document.getElementById('editor-nombre').value.trim();
  const fuente = selectFuente.value;
  const columnas = [...contenedorColumnas.querySelectorAll('input:checked')].map((i) => i.value);
  const orden_por = selectOrdenPor.value || null;
  const orden_direccion = document.getElementById('editor-orden-direccion').value;

  if (!nombre) { mostrarMensaje('Ponle un nombre al informe.', 'error'); return; }
  if (columnas.length === 0) { mostrarMensaje('Elige al menos una columna.', 'error'); return; }

  const cuerpo = { nombre, fuente, columnas, orden_por, orden_direccion };
  const boton = document.getElementById('boton-guardar-informe');
  boton.disabled = true;

  try {
    if (editandoId) {
      await llamarApi('/informes-personalizados/' + editandoId, { method: 'PUT', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Informe actualizado.', 'exito');
    } else {
      await llamarApi('/informes-personalizados', { method: 'POST', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Informe creado.', 'exito');
    }
    guardados = await llamarApi('/informes-personalizados');
    dibujarGuardados();
    cerrarEditor();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  } finally {
    boton.disabled = false;
  }
}

// ---------- Eliminar ----------

async function eliminarInforme(id) {
  const informe = guardados.find((g) => g.id === id);
  if (!informe) return;
  if (!confirm('¿Eliminar el informe "' + informe.nombre + '"? Esta acción no se puede deshacer.')) return;

  try {
    await llamarApi('/informes-personalizados/' + id, { method: 'DELETE' });
    guardados = guardados.filter((g) => g.id !== id);
    dibujarGuardados();
    mostrarMensaje('Informe eliminado.', 'exito');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

// ---------- Ejecutar y mostrar resultado ----------

async function ejecutarInforme(id) {
  try {
    ultimoResultado = await llamarApi('/informes-personalizados/' + id + '/ejecutar');
    dibujarResultado();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function textoCelda(columna, valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (columna.tipo === 'fecha') return formatearFecha(valor);
  if (columna.tipo === 'monto') return formatearMonto(valor);
  return String(valor);
}

const esNumerica = (columna) => columna.tipo === 'monto';

function dibujarResultado() {
  const r = ultimoResultado;

  document.getElementById('resultado-titulo').textContent = r.titulo;
  document.getElementById('resultado-subtitulo').textContent = r.subtitulo;

  const encabezado = '<thead><tr>' + r.columnas.map((c) => '<th' + (esNumerica(c) ? ' class="num"' : '') + '>' + escaparHtml(c.titulo) + '</th>').join('') + '</tr></thead>';

  const cuerpo = r.filas.length === 0
    ? '<tbody><tr><td colspan="' + r.columnas.length + '" style="text-align: center; color: var(--texto-suave); padding: 24px;">No hay datos.</td></tr></tbody>'
    : '<tbody>' + r.filas.map((fila) => '<tr>' + r.columnas.map((c) => (
        '<td' + (esNumerica(c) ? ' class="num"' : '') + '>' + escaparHtml(textoCelda(c, fila[c.clave])) + '</td>'
      )).join('') + '</tr>').join('') + '</tbody>';

  tablaInforme.innerHTML = encabezado + cuerpo;
  document.getElementById('resultado-conteo').innerHTML = 'Total de Registro(s): <strong>' + r.filas.length + '</strong>';
  panelEditor.style.display = 'none';
  panelResultado.style.display = 'block';
  panelResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Imprimir ----------

document.getElementById('boton-imprimir').addEventListener('click', () => {
  if (!ultimoResultado) return;
  const ventana = window.open('', '_blank');
  if (!ventana) {
    mostrarMensaje('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.', 'error');
    return;
  }

  const estilos = 'body{font-family:Arial,sans-serif;font-size:11px;color:#1c2b4a;margin:18px;}' +
    'h1{font-size:16px;margin:0 0 2px;} .sub{color:#5b6b8c;margin-bottom:10px;}' +
    'table{width:100%;border-collapse:collapse;} th{background:#1c2b4a;color:#fff;text-align:left;padding:5px 6px;font-size:10px;text-transform:uppercase;}' +
    'td{padding:4px 6px;border-bottom:1px solid #dde3ef;} .num{text-align:right;white-space:nowrap;} @page{size:landscape;margin:12mm;}';

  const r = ultimoResultado;
  const filasHtml = document.getElementById('tabla-informe').innerHTML;
  ventana.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escaparHtml(r.titulo) + '</title><style>' + estilos + '</style></head><body>' +
    '<h1>' + escaparHtml(r.titulo) + '</h1><div class="sub">' + escaparHtml(r.subtitulo) + '</div>' +
    '<table>' + filasHtml + '</table>' +
    '<div style="margin-top:10px;color:#5b6b8c;font-size:10px;">Generado el ' + new Date().toLocaleString('es-VE') + ' · ' + r.filas.length + ' registro(s)</div>' +
    '</body></html>');
  ventana.document.close();
  ventana.focus();
  ventana.print();
});

// ---------- Exportar a CSV ----------

function valorCSV(columna, valor) {
  if (valor === null || valor === undefined) return '';
  if (columna.tipo === 'monto') return String(Number(valor)).replace('.', ',');
  return String(valor);
}

function celdaCSV(texto) {
  return '"' + String(texto).replace(/"/g, '""') + '"';
}

document.getElementById('boton-csv').addEventListener('click', () => {
  if (!ultimoResultado) return;
  const r = ultimoResultado;

  const lineas = [r.columnas.map((c) => celdaCSV(c.titulo)).join(';')];
  r.filas.forEach((fila) => lineas.push(r.columnas.map((c) => celdaCSV(valorCSV(c, fila[c.clave]))).join(';')));

  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'informe_personalizado.csv';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(enlace.href);
});

cargarTodo();

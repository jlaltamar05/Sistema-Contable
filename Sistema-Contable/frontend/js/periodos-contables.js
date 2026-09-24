function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const NOMBRES_MES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const usuarioActual = obtenerUsuarioSesion();
const puedeReabrir = usuarioActual && ['administrador', 'jefe_contabilidad'].includes(usuarioActual.rol);

let periodos = [];

async function cargarPeriodos() {
  try {
    periodos = await llamarApi('/periodos-contables');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
    return;
  }
  dibujarTabla();
}

function dibujarTabla() {
  const tbody = document.getElementById('tabla-periodos');
  if (periodos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="estado-vacio">Todavía no se ha cerrado ningún período.</td></tr>';
    return;
  }
  tbody.innerHTML = periodos.map((p) => (
    '<tr>' +
    '<td>' + p.anio + '</td>' +
    '<td>' + NOMBRES_MES[p.mes] + '</td>' +
    '<td><span class="etiqueta-estado ' + (p.estado === 'cerrado' ? 'inactivo' : 'activo') + '">' + (p.estado === 'cerrado' ? 'Cerrado' : 'Abierto') + '</span></td>' +
    '<td>' + (p.cerrado_en ? new Date(p.cerrado_en).toLocaleString('es-VE') : '—') + '</td>' +
    '<td>' + (p.reabierto_en ? new Date(p.reabierto_en).toLocaleString('es-VE') : '—') + '</td>' +
    '<td class="celda-acciones">' +
    (p.estado === 'cerrado' && puedeReabrir ? '<button type="button" class="boton boton-secundario" data-accion="reabrir" data-anio="' + p.anio + '" data-mes="' + p.mes + '">Reabrir</button>' : '') +
    '</td></tr>'
  )).join('');
}

document.getElementById('tabla-periodos').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion="reabrir"]');
  if (!boton) return;
  const anio = boton.dataset.anio, mes = boton.dataset.mes;
  if (!confirm('¿Reabrir ' + NOMBRES_MES[mes] + ' ' + anio + '? Mientras esté reabierto, el administrativo queda bloqueado para ese mes.')) return;

  try {
    await llamarApi('/periodos-contables/reabrir', { method: 'POST', body: JSON.stringify({ anio: Number(anio), mes: Number(mes) }) });
    mostrarMensaje('Período reabierto.', 'exito');
    cargarPeriodos();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

document.getElementById('boton-cerrar-periodo').addEventListener('click', async () => {
  const anio = Number(document.getElementById('cerrar-anio').value);
  const mes = Number(document.getElementById('cerrar-mes').value);
  if (!anio) { mostrarMensaje('Indica el año.', 'error'); return; }
  if (!confirm('¿Cerrar ' + NOMBRES_MES[mes] + ' ' + anio + '? Ningún documento con fecha de ese mes se podrá crear, editar ni anular.')) return;

  try {
    await llamarApi('/periodos-contables/cerrar', { method: 'POST', body: JSON.stringify({ anio, mes }) });
    mostrarMensaje('Período cerrado.', 'exito');
    cargarPeriodos();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

const hoy = new Date();
document.getElementById('cerrar-anio').value = hoy.getFullYear();
document.getElementById('cerrar-mes').value = hoy.getMonth() + 1;

cargarPeriodos();

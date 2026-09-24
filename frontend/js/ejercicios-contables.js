function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const usuarioActualEjercicios = obtenerUsuarioSesion();
const puedeCerrarEjercicio = usuarioActualEjercicios && ['administrador', 'jefe_contabilidad'].includes(usuarioActualEjercicios.rol);

let ejercicios = [];

async function cargarEjercicios() {
  try {
    ejercicios = await llamarApi('/ejercicios-contables');
    dibujarTabla();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function dibujarTabla() {
  const tbody = document.getElementById('tabla-ejercicios');
  if (ejercicios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="estado-vacio">Todavía no se ha abierto ningún ejercicio.</td></tr>';
    return;
  }
  tbody.innerHTML = ejercicios.map((e) => (
    '<tr>' +
    '<td>' + e.anio + '</td>' +
    '<td>' + formatearFecha(e.fecha_inicio) + '</td>' +
    '<td>' + formatearFecha(e.fecha_fin) + '</td>' +
    '<td><span class="etiqueta-estado ' + (e.estado === 'cerrado' ? 'inactivo' : 'activo') + '">' + (e.estado === 'cerrado' ? 'Cerrado' : 'Abierto') + '</span></td>' +
    '<td>' + (e.cerrado_en ? new Date(e.cerrado_en).toLocaleString('es-VE') : '—') + '</td>' +
    '<td class="celda-acciones">' +
    (e.estado === 'abierto' && puedeCerrarEjercicio ? '<button type="button" class="boton boton-peligro" data-accion="cerrar" data-id="' + e.id + '" data-anio="' + e.anio + '">Cerrar ejercicio</button>' : '') +
    '</td></tr>'
  )).join('');
}

document.getElementById('tabla-ejercicios').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion="cerrar"]');
  if (!boton) return;

  if (!confirm('¿Cerrar el ejercicio ' + boton.dataset.anio + '? Esto deja en cero las cuentas de Ingreso/Gasto/Costo y traslada la utilidad o pérdida neta a la cuenta de Patrimonio configurada. No se puede deshacer directamente — solo con un ajuste manual después.')) return;

  try {
    const r = await llamarApi('/ejercicios-contables/' + boton.dataset.id + '/cerrar', { method: 'POST' });
    mostrarMensaje('Ejercicio cerrado. Utilidad/pérdida neta trasladada: ' + formatearMonto(r.utilidad_neta), 'exito');
    cargarEjercicios();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

document.getElementById('boton-abrir-ejercicio').addEventListener('click', async () => {
  const anio = Number(document.getElementById('ejercicio-anio').value);
  const fecha_inicio = document.getElementById('ejercicio-inicio').value;
  const fecha_fin = document.getElementById('ejercicio-fin').value;

  if (!anio || !fecha_inicio || !fecha_fin) {
    mostrarMensaje('Completa año, fecha de inicio y fecha de fin.', 'error');
    return;
  }

  try {
    await llamarApi('/ejercicios-contables', { method: 'POST', body: JSON.stringify({ anio, fecha_inicio, fecha_fin }) });
    mostrarMensaje('Ejercicio ' + anio + ' abierto.', 'exito');
    document.getElementById('ejercicio-anio').value = '';
    document.getElementById('ejercicio-inicio').value = '';
    document.getElementById('ejercicio-fin').value = '';
    cargarEjercicios();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

const anioActual = new Date().getFullYear();
document.getElementById('ejercicio-anio').value = anioActual;
document.getElementById('ejercicio-inicio').value = anioActual + '-01-01';
document.getElementById('ejercicio-fin').value = anioActual + '-12-31';

cargarEjercicios();

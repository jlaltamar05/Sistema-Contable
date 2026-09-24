function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let centros = [];
let editandoId = null;

async function cargarCentros() {
  try {
    centros = await llamarApi('/centros-costo');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
    return;
  }
  dibujarTabla();
}

function dibujarTabla() {
  const tbody = document.getElementById('tabla-cc');
  if (centros.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="estado-vacio">No hay centros de costo registrados todavía.</td></tr>';
    return;
  }
  tbody.innerHTML = centros.map((c) => (
    '<tr>' +
    '<td>' + escaparHtml(c.codigo) + '</td>' +
    '<td>' + escaparHtml(c.nombre) + '</td>' +
    '<td><span class="etiqueta-estado ' + (c.activo ? 'activo' : 'inactivo') + '">' + (c.activo ? 'Activo' : 'Inactivo') + '</span></td>' +
    '<td class="celda-acciones">' +
    '<button type="button" class="boton boton-secundario" data-accion="editar" data-id="' + c.id + '">Editor</button> ' +
    '<button type="button" class="boton boton-peligro" data-accion="eliminar" data-id="' + c.id + '">Eliminar</button>' +
    '</td></tr>'
  )).join('');
}

document.getElementById('tabla-cc').addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const centro = centros.find((c) => c.id === boton.dataset.id);
  if (!centro) return;
  if (boton.dataset.accion === 'editar') iniciarEdicion(centro);
  if (boton.dataset.accion === 'eliminar') eliminarCentro(centro);
});

function iniciarEdicion(centro) {
  editandoId = centro.id;
  document.getElementById('titulo-formulario').textContent = 'Editar centro de costo';
  document.getElementById('cc-codigo').value = centro.codigo;
  document.getElementById('cc-nombre').value = centro.nombre;
  document.getElementById('cc-activo').checked = centro.activo;
  document.getElementById('campo-activo').style.display = 'block';
  document.getElementById('boton-cancelar-cc').style.display = 'inline-block';
  document.getElementById('boton-guardar-cc').textContent = 'Actualizar';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  editandoId = null;
  document.getElementById('titulo-formulario').textContent = 'Nuevo centro de costo';
  document.getElementById('formulario-cc').reset();
  document.getElementById('campo-activo').style.display = 'none';
  document.getElementById('boton-cancelar-cc').style.display = 'none';
  document.getElementById('boton-guardar-cc').textContent = 'Guardar';
}
document.getElementById('boton-cancelar-cc').addEventListener('click', cancelarEdicion);

document.getElementById('formulario-cc').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cuerpo = {
    codigo: document.getElementById('cc-codigo').value.trim(),
    nombre: document.getElementById('cc-nombre').value.trim(),
  };
  if (editandoId) cuerpo.activo = document.getElementById('cc-activo').checked;

  try {
    if (editandoId) {
      await llamarApi('/centros-costo/' + editandoId, { method: 'PUT', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Centro de costo actualizado.', 'exito');
    } else {
      await llamarApi('/centros-costo', { method: 'POST', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Centro de costo creado.', 'exito');
    }
    cancelarEdicion();
    await cargarCentros();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

async function eliminarCentro(centro) {
  if (!confirm('¿Eliminar el centro de costo "' + centro.codigo + ' — ' + centro.nombre + '"?')) return;
  try {
    await llamarApi('/centros-costo/' + centro.id, { method: 'DELETE' });
    mostrarMensaje('Centro de costo eliminado.', 'exito');
    await cargarCentros();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

cargarCentros();

// Lógica del módulo de FORMATOS DE IMPRESIÓN — Contabilidad.
// Versión simplificada de la del Administrativo: aquí solo hay un
// módulo ("contabilidad"), así que no hace falta el select en
// cascada — directo la lista de los 4 tipos de reporte.

const ETIQUETAS_TIPO = {
  libro_diario: 'Libro Diario',
  libro_mayor: 'Libro Mayor',
  balance_comprobacion: 'Balance de Comprobación',
  estado_resultados: 'Pérdidas y Ganancias',
  balance_general: 'Balance General',
};

const form = document.getElementById('form-formato');
const gridFormatos = document.getElementById('grid-formatos');
const conteoFormatos = document.getElementById('conteo-formatos');
const botonCancelar = document.getElementById('boton-cancelar');
const tituloFormulario = document.getElementById('titulo-formulario');
const botonGuardar = document.getElementById('boton-guardar');
const selectTipo = document.getElementById('formato-tipo');

const modalFormato = document.getElementById('modal-formato');
const botonNuevoFormato = document.getElementById('boton-nuevo-formato');
const botonCerrarModalFormato = document.getElementById('boton-cerrar-modal-formato');

function abrirModalFormato() { modalFormato.style.display = 'block'; }
function cerrarModalFormato() { modalFormato.style.display = 'none'; salirModoEdicion(); }

botonNuevoFormato.addEventListener('click', function() { salirModoEdicion(); abrirModalFormato(); });
botonCerrarModalFormato.addEventListener('click', cerrarModalFormato);
botonCancelar.addEventListener('click', cerrarModalFormato);
modalFormato.addEventListener('click', function(evento) { if (evento.target === modalFormato) cerrarModalFormato(); });
document.addEventListener('keydown', function(evento) {
  if (evento.key === 'Escape' && modalFormato.style.display === 'block') cerrarModalFormato();
});

let todosLosFormatosCache = [];

async function cargarFormatos() {
  try {
    todosLosFormatosCache = await llamarApi('/formatos-impresion');
    dibujarGrid();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
    gridFormatos.innerHTML = '<p class="estado-vacio">No se pudo cargar la lista.</p>';
  }
}

function dibujarGrid() {
  if (!todosLosFormatosCache || todosLosFormatosCache.length === 0) {
    gridFormatos.innerHTML = '<p class="estado-vacio">Aún no hay formatos registrados.</p>';
    conteoFormatos.innerHTML = '';
    return;
  }

  conteoFormatos.innerHTML = 'Total de Registro(s): <strong>' + todosLosFormatosCache.length + '</strong>';

  gridFormatos.innerHTML = todosLosFormatosCache.map(function(formato) {
    return '<div class="fila-articulo">' +
      '<div class="col-etiqueta">' + (ETIQUETAS_TIPO[formato.tipo_documento] || formato.tipo_documento) + '</div>' +
      '<div class="nombre-fila">' + formato.nombre + '</div>' +
      '<div class="col-etiqueta">' + (formato.cola_impresion || '—') + '</div>' +
      '<span class="etiqueta-estado ' + (formato.predeterminado ? 'activo' : 'inactivo') + '" style="flex-shrink: 0;">' + (formato.predeterminado ? 'Sí' : 'No') + '</span>' +
      '<span class="etiqueta-estado ' + (formato.activo ? 'activo' : 'inactivo') + '" style="flex-shrink: 0;">' + (formato.activo ? 'Sí' : 'No') + '</span>' +
      '<div class="celda-acciones" style="flex-shrink: 0;">' +
        '<button class="boton boton-secundario" data-accion="editar" data-id="' + formato.id + '">Editar</button>' +
        '<button class="boton boton-peligro" data-accion="eliminar" data-id="' + formato.id + '">Eliminar</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function entrarModoEdicion(formato) {
  document.getElementById('formato-id').value = formato.id;
  selectTipo.value = formato.tipo_documento;
  document.getElementById('formato-nombre').value = formato.nombre;
  document.getElementById('formato-cola').value = formato.cola_impresion || '';
  document.getElementById('formato-contenido').value = formato.contenido_html || '';
  document.getElementById('formato-predeterminado').checked = !!formato.predeterminado;
  document.getElementById('formato-activo').checked = formato.activo !== false;

  tituloFormulario.textContent = 'Editar formato';
  botonGuardar.textContent = 'Guardar cambios';
}

function salirModoEdicion() {
  form.reset();
  document.getElementById('formato-id').value = '';
  document.getElementById('formato-activo').checked = true;
  tituloFormulario.textContent = 'Nuevo formato';
  botonGuardar.textContent = 'Guardar';
}

form.addEventListener('submit', async function(evento) {
  evento.preventDefault();

  const id = document.getElementById('formato-id').value;
  const cuerpo = {
    tipo_documento: selectTipo.value,
    nombre: document.getElementById('formato-nombre').value.trim(),
    cola_impresion: document.getElementById('formato-cola').value.trim() || null,
    contenido_html: document.getElementById('formato-contenido').value,
    predeterminado: document.getElementById('formato-predeterminado').checked,
    activo: document.getElementById('formato-activo').checked,
  };

  try {
    if (id) {
      await llamarApi('/formatos-impresion/' + id, { method: 'PUT', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Formato actualizado correctamente.', 'exito');
    } else {
      await llamarApi('/formatos-impresion', { method: 'POST', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Formato creado correctamente.', 'exito');
    }
    cerrarModalFormato();
    cargarFormatos();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

gridFormatos.addEventListener('click', async function(evento) {
  const boton = evento.target.closest('button');
  if (!boton) return;

  const id = boton.dataset.id;
  const accion = boton.dataset.accion;

  if (accion === 'editar') {
    const formato = todosLosFormatosCache.find(function(f) { return f.id === id; });
    if (formato) {
      entrarModoEdicion(formato);
      abrirModalFormato();
    }
  }

  if (accion === 'eliminar') {
    const confirmar = confirm('¿Eliminar este formato? Esta acción no se puede deshacer.');
    if (!confirmar) return;

    try {
      await llamarApi('/formatos-impresion/' + id, { method: 'DELETE' });
      mostrarMensaje('Formato eliminado.', 'exito');
      cargarFormatos();
    } catch (err) {
      mostrarMensaje(err.message, 'error');
    }
  }
});

cargarFormatos();

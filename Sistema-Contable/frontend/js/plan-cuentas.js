function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const TIPOS_LABEL = { activo: 'Activo', pasivo: 'Pasivo', patrimonio: 'Patrimonio', ingreso: 'Ingreso', gasto: 'Gasto', costo: 'Costo' };

let cuentas = [];
let editandoId = null;

async function cargarCuentas() {
  try {
    cuentas = await llamarApi('/cuentas-contables');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
    return;
  }
  dibujarSelectPadre();
  dibujarTabla();
}

function dibujarSelectPadre() {
  const select = document.getElementById('cuenta-padre');
  const valorActual = select.value;
  select.innerHTML = '<option value="">(ninguna — cuenta de primer nivel)</option>' +
    cuentas.filter((c) => c.id !== editandoId).map((c) => '<option value="' + c.id + '">' + escaparHtml(c.codigo + ' — ' + c.nombre) + '</option>').join('');
  select.value = valorActual;
}

function dibujarTabla() {
  const tbody = document.getElementById('tabla-cuentas');
  if (cuentas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="estado-vacio">No hay cuentas registradas todavía.</td></tr>';
    return;
  }
  tbody.innerHTML = cuentas.map((c) => (
    '<tr>' +
    '<td>' + escaparHtml(c.codigo) + '</td>' +
    '<td>' + escaparHtml(c.nombre) + '</td>' +
    '<td>' + (TIPOS_LABEL[c.tipo] || c.tipo) + '</td>' +
    '<td>' + (c.cuenta_padre ? escaparHtml(c.cuenta_padre.codigo + ' — ' + c.cuenta_padre.nombre) : '—') + '</td>' +
    '<td>' + (c.acepta_movimiento ? 'Sí' : 'No') + '</td>' +
    '<td><span class="etiqueta-estado ' + (c.activa ? 'activo' : 'inactivo') + '">' + (c.activa ? 'Activa' : 'Inactiva') + '</span></td>' +
    '<td class="celda-acciones">' +
    '<button type="button" class="boton boton-secundario" data-accion="editar" data-id="' + c.id + '">Editor</button> ' +
    '<button type="button" class="boton boton-peligro" data-accion="eliminar" data-id="' + c.id + '">Eliminar</button>' +
    '</td></tr>'
  )).join('');
}

document.getElementById('tabla-cuentas').addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const cuenta = cuentas.find((c) => c.id === boton.dataset.id);
  if (!cuenta) return;
  if (boton.dataset.accion === 'editar') iniciarEdicion(cuenta);
  if (boton.dataset.accion === 'eliminar') eliminarCuenta(cuenta);
});

function iniciarEdicion(cuenta) {
  editandoId = cuenta.id;
  document.getElementById('titulo-formulario').textContent = 'Editar cuenta';
  document.getElementById('cuenta-codigo').value = cuenta.codigo;
  document.getElementById('cuenta-nombre').value = cuenta.nombre;
  document.getElementById('cuenta-tipo').value = cuenta.tipo;
  document.getElementById('cuenta-acepta-movimiento').checked = cuenta.acepta_movimiento;
  document.getElementById('cuenta-activa').checked = cuenta.activa;
  document.getElementById('campo-activa').style.display = 'block';
  document.getElementById('boton-cancelar-cuenta').style.display = 'inline-block';
  document.getElementById('boton-guardar-cuenta').textContent = 'Actualizar';
  dibujarSelectPadre();
  document.getElementById('cuenta-padre').value = cuenta.cuenta_padre_id || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  editandoId = null;
  document.getElementById('titulo-formulario').textContent = 'Nueva cuenta';
  document.getElementById('formulario-cuenta').reset();
  document.getElementById('cuenta-acepta-movimiento').checked = true;
  document.getElementById('campo-activa').style.display = 'none';
  document.getElementById('boton-cancelar-cuenta').style.display = 'none';
  document.getElementById('boton-guardar-cuenta').textContent = 'Guardar';
  dibujarSelectPadre();
}
document.getElementById('boton-cancelar-cuenta').addEventListener('click', cancelarEdicion);

document.getElementById('formulario-cuenta').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const cuerpo = {
    codigo: document.getElementById('cuenta-codigo').value.trim(),
    nombre: document.getElementById('cuenta-nombre').value.trim(),
    tipo: document.getElementById('cuenta-tipo').value,
    cuenta_padre_id: document.getElementById('cuenta-padre').value || null,
    acepta_movimiento: document.getElementById('cuenta-acepta-movimiento').checked,
  };
  if (editandoId) cuerpo.activa = document.getElementById('cuenta-activa').checked;

  try {
    if (editandoId) {
      await llamarApi('/cuentas-contables/' + editandoId, { method: 'PUT', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Cuenta actualizada.', 'exito');
    } else {
      await llamarApi('/cuentas-contables', { method: 'POST', body: JSON.stringify(cuerpo) });
      mostrarMensaje('Cuenta creada.', 'exito');
    }
    cancelarEdicion();
    await cargarCuentas();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

async function eliminarCuenta(cuenta) {
  if (!confirm('¿Eliminar la cuenta "' + cuenta.codigo + ' — ' + cuenta.nombre + '"?')) return;
  try {
    await llamarApi('/cuentas-contables/' + cuenta.id, { method: 'DELETE' });
    mostrarMensaje('Cuenta eliminada.', 'exito');
    await cargarCuentas();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

cargarCuentas();

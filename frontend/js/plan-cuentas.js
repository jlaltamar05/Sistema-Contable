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

// ---------- Exportar a CSV ----------

function celdaCSV(texto) {
  return '"' + String(texto === null || texto === undefined ? '' : texto).replace(/"/g, '""') + '"';
}

document.getElementById('boton-exportar-cuentas').addEventListener('click', () => {
  const encabezado = ['codigo', 'nombre', 'tipo', 'cuenta_padre_codigo', 'acepta_movimiento', 'activa'];
  const lineas = [encabezado.join(';')];

  cuentas.forEach((c) => {
    lineas.push([
      celdaCSV(c.codigo),
      celdaCSV(c.nombre),
      celdaCSV(c.tipo),
      celdaCSV(c.cuenta_padre ? c.cuenta_padre.codigo : ''),
      celdaCSV(c.acepta_movimiento),
      celdaCSV(c.activa),
    ].join(';'));
  });

  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'plan_de_cuentas.csv';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(enlace.href);
});

// ---------- Importar desde CSV ----------
// Formato esperado (mismo que exporta el botón de arriba):
// codigo;nombre;tipo;cuenta_padre_codigo;acepta_movimiento;activa

document.getElementById('boton-importar-cuentas').addEventListener('click', () => {
  document.getElementById('input-importar-cuentas').click();
});

document.getElementById('input-importar-cuentas').addEventListener('change', async (evento) => {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  try {
    const texto = await archivo.text();
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lineas.length < 2) {
      mostrarMensaje('El archivo no tiene filas para importar.', 'error');
      return;
    }

    const filas = lineas.slice(1).map((linea) => {
      // separador ; y celdas entre comillas dobles (mismo formato que se exporta)
      const partes = linea.split(';').map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      return {
        codigo: partes[0],
        nombre: partes[1],
        tipo: partes[2],
        cuenta_padre_codigo: partes[3],
        acepta_movimiento: partes[4],
        activa: partes[5],
      };
    });

    const resultado = await llamarApi('/cuentas-contables/importar', { method: 'POST', body: JSON.stringify({ filas }) });

    let mensaje = resultado.creadas + ' cuenta(s) creada(s), ' + resultado.actualizadas + ' actualizada(s).';
    if (resultado.errores.length > 0) mensaje += ' ' + resultado.errores.length + ' fila(s) con problemas (revisa la consola).';
    mostrarMensaje(mensaje, resultado.errores.length > 0 ? 'error' : 'exito');
    if (resultado.errores.length > 0) console.warn('Errores al importar el Plan de Cuentas:', resultado.errores);

    await cargarCuentas();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  } finally {
    evento.target.value = '';
  }
});

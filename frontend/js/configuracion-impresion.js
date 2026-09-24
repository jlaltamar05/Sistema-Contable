function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const NOMBRES_TIPO = {
  libro_diario: 'Libro Diario',
  balance_comprobacion: 'Balance de Comprobación',
  estado_resultados: 'Estado de Resultados',
  balance_general: 'Balance General',
};

async function cargarPreferencias() {
  try {
    const preferencias = await llamarApi('/preferencias-impresion');
    dibujarTabla(preferencias);
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function dibujarTabla(preferencias) {
  document.getElementById('tabla-preferencias').innerHTML = preferencias.map((p) => (
    '<tr data-tipo="' + p.tipo_reporte + '">' +
    '<td>' + (NOMBRES_TIPO[p.tipo_reporte] || p.tipo_reporte) + '</td>' +
    '<td><select class="pref-orientacion" style="padding:6px;">' +
      '<option value="horizontal"' + (p.orientacion === 'horizontal' ? ' selected' : '') + '>Horizontal</option>' +
      '<option value="vertical"' + (p.orientacion === 'vertical' ? ' selected' : '') + '>Vertical</option>' +
    '</select></td>' +
    '<td><input type="checkbox" class="pref-logo" ' + (p.incluir_logo ? 'checked' : '') + ' style="width:auto;" /></td>' +
    '<td><button type="button" class="boton boton-secundario" data-guardar="' + p.tipo_reporte + '">Guardar</button></td>' +
    '</tr>'
  )).join('');
}

document.getElementById('tabla-preferencias').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-guardar]');
  if (!boton) return;

  const fila = boton.closest('tr');
  const cuerpo = {
    tipo_reporte: fila.dataset.tipo,
    orientacion: fila.querySelector('.pref-orientacion').value,
    incluir_logo: fila.querySelector('.pref-logo').checked,
  };

  try {
    await llamarApi('/preferencias-impresion', { method: 'PUT', body: JSON.stringify(cuerpo) });
    mostrarMensaje('Preferencia guardada.', 'exito');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

cargarPreferencias();

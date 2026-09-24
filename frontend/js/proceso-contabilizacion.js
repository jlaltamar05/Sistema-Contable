document.getElementById('boton-proceso-contabilizar').addEventListener('click', async () => {
  const desde = document.getElementById('proceso-desde').value;
  const hasta = document.getElementById('proceso-hasta').value;
  if (!desde || !hasta) { mostrarMensaje('Indica el rango de fechas del proceso.', 'error'); return; }
  if (!confirm('¿Contabilizar todos los asientos pendientes entre ' + desde + ' y ' + hasta + '?')) return;

  try {
    const r = await llamarApi('/asientos/proceso/contabilizar', { method: 'POST', body: JSON.stringify({ desde, hasta }) });
    mostrarMensaje(r.procesados + ' asiento(s) contabilizado(s).', 'exito');
    consultarEstatusProceso();
  } catch (err) { mostrarMensaje(err.message, 'error'); }
});

document.getElementById('boton-proceso-desprocesar').addEventListener('click', async () => {
  const desde = document.getElementById('proceso-desde').value;
  const hasta = document.getElementById('proceso-hasta').value;
  if (!desde || !hasta) { mostrarMensaje('Indica el rango de fechas del proceso.', 'error'); return; }
  if (!confirm('¿Devolver a Pendiente todos los asientos contabilizados entre ' + desde + ' y ' + hasta + '? (Los reversos no se ven afectados)')) return;

  try {
    const r = await llamarApi('/asientos/proceso/desprocesar', { method: 'POST', body: JSON.stringify({ desde, hasta }) });
    mostrarMensaje(r.desprocesados + ' asiento(s) devuelto(s) a Pendiente.', 'exito');
    consultarEstatusProceso();
  } catch (err) { mostrarMensaje(err.message, 'error'); }
});

async function consultarEstatusProceso() {
  const desde = document.getElementById('proceso-desde').value;
  const hasta = document.getElementById('proceso-hasta').value;
  const params = [];
  if (desde) params.push('desde=' + desde);
  if (hasta) params.push('hasta=' + hasta);

  try {
    const r = await llamarApi('/asientos/proceso/estatus' + (params.length ? '?' + params.join('&') : ''));
    document.getElementById('proceso-estatus').textContent = r.pendientes + ' pendiente(s) · ' + r.contabilizados + ' contabilizado(s) · ' + r.total + ' en total, en este rango.';
  } catch (err) { /* silencioso */ }
}
document.getElementById('proceso-desde').addEventListener('change', consultarEstatusProceso);
document.getElementById('proceso-hasta').addEventListener('change', consultarEstatusProceso);

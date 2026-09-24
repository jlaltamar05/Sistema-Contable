// Utilidad: verifica que el período contable (mes/año) de una fecha de
// documento esté abierto, antes de permitir crear/editar/eliminar ese
// documento administrativo. Si el período no tiene fila registrada
// todavía, se asume abierto (nunca se ha cerrado ese mes).
//
// Ningún controlador la llama todavía — queda lista para cuando se
// conecte la integración a Factura/Compra/Cobro/Pago/NC.

const supabase = require('../db/supabaseClient');

async function verificarPeriodoAbierto(companiaId, fechaDocumento) {
  const fecha = new Date(fechaDocumento);
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth() + 1;

  const { data } = await supabase
    .from('periodos_contables')
    .select('estado')
    .eq('compania_id', companiaId)
    .eq('anio', anio)
    .eq('mes', mes)
    .maybeSingle();

  if (data && data.estado === 'cerrado') {
    const error = new Error('El período ' + String(mes).padStart(2, '0') + '/' + anio + ' está cerrado. No se pueden crear ni modificar documentos con esa fecha.');
    error.codigo = 409;
    throw error;
  }
}

module.exports = { verificarPeriodoAbierto };

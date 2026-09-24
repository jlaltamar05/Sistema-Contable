// Motor de asientos contables — pieza central de la integración.
// Cualquier documento administrativo (Factura, Compra, Cobro, Pago,
// Nota de Crédito) usará crearAsiento() para registrar su movimiento
// contable. Por ahora ningún controlador lo llama todavía — se deja
// listo aquí, a la espera de conectarlo documento por documento.

const supabase = require('../db/supabaseClient');
const { generarNumeroAutomatico } = require('./numeracion');

// Crea un asiento balanceado (encabezado + líneas). Lanza error si no
// cuadra (débitos != créditos) o si tiene menos de 2 líneas.
//
// lineas: [{ cuenta_contable_id, debito, credito, descripcion? }]
async function crearAsiento(companiaId, {
  fecha, descripcion, documentoOrigenTipo, documentoOrigenId, lineas, creadoPor, estadoInicial,
}) {
  if (!lineas || lineas.length < 2) {
    throw new Error('Un asiento necesita al menos 2 líneas.');
  }

  const totalDebito = lineas.reduce((s, l) => s + (Number(l.debito) || 0), 0);
  const totalCredito = lineas.reduce((s, l) => s + (Number(l.credito) || 0), 0);
  if (Math.abs(totalDebito - totalCredito) > 0.01) {
    throw new Error('El asiento no cuadra: débitos (' + totalDebito.toFixed(2) + ') distintos de créditos (' + totalCredito.toFixed(2) + ').');
  }

  const numeroAsiento = await generarNumeroAutomatico('prefijo_asiento', 'contador_asiento', companiaId);

  let modo = 'manual';
  const { data: config } = await supabase
    .from('configuracion_contable')
    .select('modo_contabilizacion')
    .eq('compania_id', companiaId)
    .maybeSingle();
  if (config) modo = config.modo_contabilizacion;

  const estado = estadoInicial || (modo === 'automatico' ? 'contabilizado' : 'pendiente');
  const ahora = new Date().toISOString();

  const { data: encabezado, error: errorEnc } = await supabase
    .from('asientos_contables')
    .insert([{
      compania_id: companiaId,
      numero_asiento: numeroAsiento,
      fecha,
      descripcion: descripcion || null,
      documento_origen_tipo: documentoOrigenTipo || null,
      documento_origen_id: documentoOrigenId || null,
      estado,
      creado_por: creadoPor || null,
      contabilizado_por: estado === 'contabilizado' ? (creadoPor || null) : null,
      contabilizado_en: estado === 'contabilizado' ? ahora : null,
    }])
    .select()
    .single();

  if (errorEnc) throw new Error('No se pudo crear el asiento: ' + errorEnc.message);

  const filas = lineas.map((l) => ({
    asiento_id: encabezado.id,
    cuenta_contable_id: l.cuenta_contable_id,
    centro_costo_id: l.centro_costo_id || null,
    debito: Number(l.debito) || 0,
    credito: Number(l.credito) || 0,
    descripcion: l.descripcion || null,
  }));

  const { error: errorDet } = await supabase.from('asientos_detalle').insert(filas);
  if (errorDet) {
    // Revertir el encabezado huérfano si las líneas fallaron.
    await supabase.from('asientos_contables').delete().eq('id', encabezado.id);
    throw new Error('No se pudo crear el detalle del asiento: ' + errorDet.message);
  }

  return encabezado;
}

// Crea el reverso de un asiento ya contabilizado (invierte débito y
// crédito de cada línea). El reverso nace directo como "contabilizado",
// para anular el efecto original de inmediato.
async function reversarAsiento(companiaId, asientoId, creadoPor) {
  const { data: original, error } = await supabase
    .from('asientos_contables')
    .select('*, asientos_detalle(*)')
    .eq('id', asientoId)
    .eq('compania_id', companiaId)
    .single();

  if (error || !original) throw new Error('Asiento original no encontrado.');
  if (original.estado !== 'contabilizado') throw new Error('Solo se puede reversar un asiento ya contabilizado.');

  const lineasReverso = original.asientos_detalle.map((l) => ({
    cuenta_contable_id: l.cuenta_contable_id,
    centro_costo_id: l.centro_costo_id,
    debito: Number(l.credito) || 0,
    credito: Number(l.debito) || 0,
    descripcion: l.descripcion,
  }));

  return crearAsiento(companiaId, {
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: 'Reverso del asiento ' + original.numero_asiento + (original.descripcion ? ' — ' + original.descripcion : ''),
    documentoOrigenTipo: original.documento_origen_tipo,
    documentoOrigenId: original.documento_origen_id,
    lineas: lineasReverso,
    creadoPor,
    estadoInicial: 'contabilizado',
  });
}

// Elimina un asiento — solo si sigue "pendiente" (uno ya contabilizado
// nunca se borra directo: hay que reversarlo).
async function eliminarAsientoPendiente(companiaId, asientoId) {
  const { data: asiento } = await supabase
    .from('asientos_contables')
    .select('estado')
    .eq('id', asientoId)
    .eq('compania_id', companiaId)
    .single();

  if (!asiento) return;
  if (asiento.estado !== 'pendiente') {
    throw new Error('No se puede eliminar un asiento ya contabilizado; hay que reversarlo.');
  }
  await supabase.from('asientos_contables').delete().eq('id', asientoId);
}

module.exports = { crearAsiento, reversarAsiento, eliminarAsientoPendiente };

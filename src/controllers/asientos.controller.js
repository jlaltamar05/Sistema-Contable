// Controlador de ASIENTOS CONTABLES.
//
// GET    /asientos                    -> lista (filtros: desde, hasta, estado, tipo)
// GET    /asientos/:id                -> uno con su detalle
// POST   /asientos                    -> crear un asiento manual
// POST   /asientos/:id/contabilizar   -> pasa UNO de pendiente a contabilizado
// POST   /asientos/:id/reversar       -> reversa uno ya contabilizado
// DELETE /asientos/:id                -> elimina uno (solo si sigue pendiente)
// POST   /asientos/proceso/contabilizar -> EN LOTE, por rango de fechas
// POST   /asientos/proceso/desprocesar  -> EN LOTE (inverso), por rango de fechas
// GET    /asientos/proceso/estatus      -> cuántos pendientes/contabilizados hay en un rango

const supabase = require('../db/supabaseClient');
const motor = require('../utils/motorAsientos');

async function listar(req, res) {
  const { desde, hasta, estado, tipo } = req.query;

  let consulta = supabase
    .from('asientos_contables')
    .select('*')
    .eq('compania_id', req.companiaId)
    .order('fecha', { ascending: false })
    .order('numero_asiento', { ascending: false });

  if (desde) consulta = consulta.gte('fecha', desde);
  if (hasta) consulta = consulta.lte('fecha', hasta);
  if (estado && estado !== 'todos') consulta = consulta.eq('estado', estado);
  if (tipo) consulta = consulta.eq('documento_origen_tipo', tipo);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function obtener(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('asientos_contables')
    .select('*, asientos_detalle ( *, cuentas_contables ( codigo, nombre ) )')
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .single();

  if (error) return res.status(404).json({ error: 'Asiento no encontrado' });
  res.json(data);
}

async function crearManual(req, res) {
  const { fecha, descripcion, lineas, tipo_documento } = req.body;
  if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria.' });

  try {
    const asiento = await motor.crearAsiento(req.companiaId, {
      fecha, descripcion, lineas, creadoPor: req.usuario.usuario_id,
      documentoOrigenTipo: tipo_documento || 'manual',
    });
    res.status(201).json(asiento);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function contabilizarUno(req, res) {
  const { id } = req.params;

  const { data: asiento } = await supabase.from('asientos_contables').select('estado').eq('id', id).eq('compania_id', req.companiaId).single();
  if (!asiento) return res.status(404).json({ error: 'Asiento no encontrado' });
  if (asiento.estado === 'contabilizado') return res.status(409).json({ error: 'Este asiento ya está contabilizado.' });

  const { data, error } = await supabase
    .from('asientos_contables')
    .update({ estado: 'contabilizado', contabilizado_por: req.usuario.usuario_id, contabilizado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function reversarUno(req, res) {
  const { id } = req.params;
  try {
    const reverso = await motor.reversarAsiento(req.companiaId, id, req.usuario.usuario_id);
    res.status(201).json(reverso);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarPendiente(req, res) {
  const { id } = req.params;
  try {
    await motor.eliminarAsientoPendiente(req.companiaId, id);
    res.status(204).send();
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
}

// ---------- Proceso en lote ----------

async function procesoContabilizar(req, res) {
  const { desde, hasta } = req.body;
  if (!desde || !hasta) return res.status(400).json({ error: 'Indica el rango de fechas (desde y hasta).' });

  const { data, error } = await supabase
    .from('asientos_contables')
    .update({ estado: 'contabilizado', contabilizado_por: req.usuario.usuario_id, contabilizado_en: new Date().toISOString() })
    .eq('compania_id', req.companiaId)
    .eq('estado', 'pendiente')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ procesados: data.length });
}

async function procesoDesprocesar(req, res) {
  const { desde, hasta } = req.body;
  if (!desde || !hasta) return res.status(400).json({ error: 'Indica el rango de fechas (desde y hasta).' });

  const { data, error } = await supabase
    .from('asientos_contables')
    .update({ estado: 'pendiente', contabilizado_por: null, contabilizado_en: null })
    .eq('compania_id', req.companiaId)
    .eq('estado', 'contabilizado')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .is('asiento_reverso_de_id', null) // un reverso no se "despróceso": queda fijo
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ desprocesados: data.length });
}

async function procesoEstatus(req, res) {
  const { desde, hasta } = req.query;

  let consulta = supabase.from('asientos_contables').select('estado').eq('compania_id', req.companiaId);
  if (desde) consulta = consulta.gte('fecha', desde);
  if (hasta) consulta = consulta.lte('fecha', hasta);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const pendientes = data.filter((a) => a.estado === 'pendiente').length;
  const contabilizados = data.filter((a) => a.estado === 'contabilizado').length;
  res.json({ pendientes, contabilizados, total: data.length });
}

module.exports = {
  listar, obtener, crearManual, contabilizarUno, reversarUno, eliminarPendiente,
  procesoContabilizar, procesoDesprocesar, procesoEstatus,
};

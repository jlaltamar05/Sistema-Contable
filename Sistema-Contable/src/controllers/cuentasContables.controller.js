// Controlador del PLAN DE CUENTAS (por compañía).

const supabase = require('../db/supabaseClient');

async function listar(req, res) {
  const { data, error } = await supabase
    .from('cuentas_contables')
    .select('*, cuenta_padre:cuenta_padre_id ( codigo, nombre )')
    .eq('compania_id', req.companiaId)
    .order('codigo', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function crear(req, res) {
  const { codigo, nombre, tipo, cuenta_padre_id, acepta_movimiento } = req.body;

  if (!codigo || !nombre || !tipo) {
    return res.status(400).json({ error: 'código, nombre y tipo son obligatorios' });
  }

  const { data, error } = await supabase
    .from('cuentas_contables')
    .insert([{
      compania_id: req.companiaId,
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      tipo,
      cuenta_padre_id: cuenta_padre_id || null,
      acepta_movimiento: acepta_movimiento !== false,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese código.' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { codigo, nombre, tipo, cuenta_padre_id, acepta_movimiento, activa } = req.body;

  const { data, error } = await supabase
    .from('cuentas_contables')
    .update({ codigo, nombre, tipo, cuenta_padre_id: cuenta_padre_id || null, acepta_movimiento, activa })
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese código.' });
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
}

async function eliminar(req, res) {
  const { id } = req.params;

  const { count } = await supabase
    .from('asientos_detalle')
    .select('id', { count: 'exact', head: true })
    .eq('cuenta_contable_id', id);

  if (count && count > 0) {
    return res.status(409).json({ error: 'Esta cuenta ya tiene movimientos contables; no se puede eliminar.' });
  }

  const { error } = await supabase
    .from('cuentas_contables')
    .delete()
    .eq('id', id)
    .eq('compania_id', req.companiaId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };

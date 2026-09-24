// Controlador de CENTROS DE COSTO (por compañía).
// Todavía no se usan en el motor de asientos (queda para una
// segunda vuelta), pero el maestro ya queda listo desde ahora.

const supabase = require('../db/supabaseClient');

async function listar(req, res) {
  const { data, error } = await supabase
    .from('centros_costo')
    .select('*')
    .eq('compania_id', req.companiaId)
    .order('codigo', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function crear(req, res) {
  const { codigo, nombre } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: 'código y nombre son obligatorios' });

  const { data, error } = await supabase
    .from('centros_costo')
    .insert([{ compania_id: req.companiaId, codigo: codigo.trim(), nombre: nombre.trim() }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un centro de costo con ese código.' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { codigo, nombre, activo } = req.body;

  const { data, error } = await supabase
    .from('centros_costo')
    .update({ codigo, nombre, activo })
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un centro de costo con ese código.' });
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
}

async function eliminar(req, res) {
  const { id } = req.params;
  const { error } = await supabase.from('centros_costo').delete().eq('id', id).eq('compania_id', req.companiaId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };

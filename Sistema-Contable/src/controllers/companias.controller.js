// Controlador de COMPAÑÍAS — SOLO LECTURA en este sistema.
// Crear/editar/eliminar compañías sigue siendo exclusivo del Sistema
// Administrativo; aquí solo se necesita listarlas para el selector de
// "compañía actual" en la barra lateral.

const supabase = require('../db/supabaseClient');

async function listarCompanias(req, res) {
  let query = supabase.from('companias').select('id, nombre, logo_url').order('nombre');

  if (req.usuario.rol !== 'administrador') {
    query = query.eq('id', req.usuario.compania_id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function obtenerCompania(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase.from('companias').select('id, nombre, logo_url').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Compañía no encontrada' });
  res.json(data);
}

module.exports = { listarCompanias, obtenerCompania };

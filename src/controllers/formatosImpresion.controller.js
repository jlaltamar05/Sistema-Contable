// Controlador de FORMATOS DE IMPRESIÓN — Contabilidad.
// Reutiliza la MISMA tabla "formatos_impresion" que ya usa el Sistema
// Administrativo (comparten base de datos) — aquí solo se trabaja
// con modulo = 'contabilidad', para no tocar los formatos de
// Ventas/Compras/etc. que administra el otro sistema.

const supabase = require('../db/supabaseClient');

const MODULO = 'contabilidad';

async function listarFormatos(req, res) {
  const { tipo_documento, activo } = req.query;

  let query = supabase
    .from('formatos_impresion')
    .select('*')
    .eq('compania_id', req.companiaId)
    .eq('modulo', MODULO)
    .order('tipo_documento').order('nombre');

  if (tipo_documento) query = query.eq('tipo_documento', tipo_documento);
  if (activo !== undefined) query = query.eq('activo', activo === 'true');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function obtenerFormato(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('formatos_impresion')
    .select('*')
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .eq('modulo', MODULO)
    .single();

  if (error) return res.status(404).json({ error: 'Formato no encontrado' });
  res.json(data);
}

async function quitarPredeterminadoDeOtros(tipoDocumento, companiaId, exceptoId) {
  let query = supabase
    .from('formatos_impresion')
    .update({ predeterminado: false })
    .eq('tipo_documento', tipoDocumento)
    .eq('compania_id', companiaId)
    .eq('modulo', MODULO)
    .eq('predeterminado', true);

  if (exceptoId) query = query.neq('id', exceptoId);
  await query;
}

async function crearFormato(req, res) {
  const { tipo_documento, nombre, contenido_html, cola_impresion, predeterminado, activo } = req.body;

  if (!tipo_documento || !nombre) {
    return res.status(400).json({ error: 'tipo_documento y nombre son obligatorios' });
  }

  if (predeterminado) await quitarPredeterminadoDeOtros(tipo_documento, req.companiaId, null);

  const { data, error } = await supabase
    .from('formatos_impresion')
    .insert([{
      modulo: MODULO,
      tipo_documento,
      nombre,
      contenido_html: contenido_html || null,
      cola_impresion: cola_impresion || null,
      predeterminado: !!predeterminado,
      activo: activo !== false,
      compania_id: req.companiaId,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function actualizarFormato(req, res) {
  const { id } = req.params;
  const { tipo_documento, nombre, contenido_html, cola_impresion, predeterminado, activo } = req.body;

  if (predeterminado) await quitarPredeterminadoDeOtros(tipo_documento, req.companiaId, id);

  const { data, error } = await supabase
    .from('formatos_impresion')
    .update({ tipo_documento, nombre, contenido_html, cola_impresion, predeterminado, activo })
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .eq('modulo', MODULO)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function eliminarFormato(req, res) {
  const { id } = req.params;
  const { error } = await supabase
    .from('formatos_impresion')
    .delete()
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .eq('modulo', MODULO);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
}

module.exports = { listarFormatos, obtenerFormato, crearFormato, actualizarFormato, eliminarFormato };

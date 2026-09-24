// Preferencias de impresión: qué orientación y si incluir el logo,
// por cada tipo de reporte contable.

const supabase = require('../db/supabaseClient');

const TIPOS = ['libro_diario', 'balance_comprobacion', 'estado_resultados', 'balance_general'];

async function listar(req, res) {
  const { data, error } = await supabase
    .from('preferencias_impresion')
    .select('*')
    .eq('compania_id', req.companiaId);

  if (error) return res.status(500).json({ error: error.message });

  // Devuelve las 4, con valores por defecto si alguna no se ha configurado todavía.
  const porTipo = Object.fromEntries((data || []).map((p) => [p.tipo_reporte, p]));
  const resultado = TIPOS.map((tipo) => porTipo[tipo] || {
    compania_id: req.companiaId, tipo_reporte: tipo, orientacion: 'horizontal', incluir_logo: true,
  });

  res.json(resultado);
}

async function guardar(req, res) {
  const { tipo_reporte, orientacion, incluir_logo } = req.body;

  if (!TIPOS.includes(tipo_reporte)) return res.status(400).json({ error: 'Tipo de reporte no válido.' });
  if (!['vertical', 'horizontal'].includes(orientacion)) return res.status(400).json({ error: 'Orientación no válida.' });

  const { data, error } = await supabase
    .from('preferencias_impresion')
    .upsert([{
      compania_id: req.companiaId,
      tipo_reporte,
      orientacion,
      incluir_logo: !!incluir_logo,
    }], { onConflict: 'compania_id,tipo_reporte' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

module.exports = { listar, guardar };

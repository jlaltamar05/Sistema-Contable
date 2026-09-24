// Controlador de PERÍODOS CONTABLES (cierre / reapertura mensual).

const supabase = require('../db/supabaseClient');

async function listar(req, res) {
  const { data, error } = await supabase
    .from('periodos_contables')
    .select('*')
    .eq('compania_id', req.companiaId)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function cerrar(req, res) {
  const { anio, mes } = req.body;
  if (!anio || !mes) return res.status(400).json({ error: 'Indica año y mes.' });

  const { data, error } = await supabase
    .from('periodos_contables')
    .upsert([{
      compania_id: req.companiaId,
      anio, mes,
      estado: 'cerrado',
      cerrado_por: req.usuario.usuario_id,
      cerrado_en: new Date().toISOString(),
      reabierto_por: null,
      reabierto_en: null,
    }], { onConflict: 'compania_id,anio,mes' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// Solo 'administrador' o 'jefe_contabilidad' pueden reabrir — el
// middleware exigirRolContable ya filtra esto antes de llegar aquí.
async function reabrir(req, res) {
  const { anio, mes } = req.body;
  if (!anio || !mes) return res.status(400).json({ error: 'Indica año y mes.' });

  const { data, error } = await supabase
    .from('periodos_contables')
    .update({
      estado: 'abierto',
      reabierto_por: req.usuario.usuario_id,
      reabierto_en: new Date().toISOString(),
    })
    .eq('compania_id', req.companiaId)
    .eq('anio', anio)
    .eq('mes', mes)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

module.exports = { listar, cerrar, reabrir };

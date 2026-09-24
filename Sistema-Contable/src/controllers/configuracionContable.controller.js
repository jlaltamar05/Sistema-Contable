// Controlador de CONFIGURACIÓN CONTABLE (una fila por compañía):
// modo de contabilización y cuentas por defecto.

const supabase = require('../db/supabaseClient');

async function obtener(req, res) {
  const { data, error } = await supabase
    .from('configuracion_contable')
    .select('*')
    .eq('compania_id', req.companiaId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  // Si nunca se ha configurado, se devuelve el valor por defecto sin
  // insertar nada todavía (se crea recién cuando guarden algo).
  res.json(data || {
    compania_id: req.companiaId,
    modo_contabilizacion: 'manual',
    cuenta_cxc_defecto_id: null,
    cuenta_cxp_defecto_id: null,
    cuenta_iva_ventas_defecto_id: null,
    cuenta_iva_compras_defecto_id: null,
    cuenta_inventario_defecto_id: null,
    cuenta_costo_defecto_id: null,
    cuenta_ingreso_defecto_id: null,
    cuenta_banco_defecto_id: null,
  });
}

async function guardar(req, res) {
  const {
    modo_contabilizacion, cuenta_cxc_defecto_id, cuenta_cxp_defecto_id,
    cuenta_iva_ventas_defecto_id, cuenta_iva_compras_defecto_id,
    cuenta_inventario_defecto_id, cuenta_costo_defecto_id,
    cuenta_ingreso_defecto_id, cuenta_banco_defecto_id,
  } = req.body;

  if (!['automatico', 'manual', 'proceso'].includes(modo_contabilizacion)) {
    return res.status(400).json({ error: 'Modo de contabilización no válido.' });
  }

  const { data, error } = await supabase
    .from('configuracion_contable')
    .upsert([{
      compania_id: req.companiaId,
      modo_contabilizacion,
      cuenta_cxc_defecto_id: cuenta_cxc_defecto_id || null,
      cuenta_cxp_defecto_id: cuenta_cxp_defecto_id || null,
      cuenta_iva_ventas_defecto_id: cuenta_iva_ventas_defecto_id || null,
      cuenta_iva_compras_defecto_id: cuenta_iva_compras_defecto_id || null,
      cuenta_inventario_defecto_id: cuenta_inventario_defecto_id || null,
      cuenta_costo_defecto_id: cuenta_costo_defecto_id || null,
      cuenta_ingreso_defecto_id: cuenta_ingreso_defecto_id || null,
      cuenta_banco_defecto_id: cuenta_banco_defecto_id || null,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'compania_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

module.exports = { obtener, guardar };

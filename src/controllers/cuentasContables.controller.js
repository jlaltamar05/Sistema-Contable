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

// POST /cuentas-contables/importar — carga masiva desde un CSV ya
// parseado en el frontend. Cada fila: { codigo, nombre, tipo,
// acepta_movimiento, activa, cuenta_padre_codigo }.
// Va en dos pasadas porque una cuenta puede referenciar como padre a
// otra que viene MÁS ABAJO en el mismo archivo (o que ya existía):
//   1) crea/actualiza todas las cuentas por su código (sin el padre).
//   2) ahora que todas existen, resuelve cuenta_padre_codigo -> id.
async function importar(req, res) {
  const filas = req.body.filas;
  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: 'No hay filas para importar.' });
  }

  const errores = [];
  let creadas = 0;
  let actualizadas = 0;

  // Pasada 1: upsert por (compania_id, codigo).
  for (const fila of filas) {
    const codigo = (fila.codigo || '').trim();
    const nombre = (fila.nombre || '').trim();
    const tipo = (fila.tipo || '').trim().toLowerCase();

    if (!codigo || !nombre || !['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'].includes(tipo)) {
      errores.push('Fila inválida (código: "' + codigo + '"): faltan datos o el tipo no es válido.');
      continue;
    }

    const { data: existente } = await supabase
      .from('cuentas_contables')
      .select('id')
      .eq('compania_id', req.companiaId)
      .eq('codigo', codigo)
      .maybeSingle();

    const valores = {
      nombre,
      tipo,
      acepta_movimiento: fila.acepta_movimiento === false || fila.acepta_movimiento === 'false' || fila.acepta_movimiento === '0' ? false : true,
      activa: fila.activa === false || fila.activa === 'false' || fila.activa === '0' ? false : true,
    };

    if (existente) {
      await supabase.from('cuentas_contables').update(valores).eq('id', existente.id);
      actualizadas++;
    } else {
      await supabase.from('cuentas_contables').insert([{ ...valores, compania_id: req.companiaId, codigo }]);
      creadas++;
    }
  }

  // Pasada 2: resolver cuenta_padre_codigo -> cuenta_padre_id, ahora
  // que ya existen todas las cuentas del archivo.
  const { data: todas } = await supabase.from('cuentas_contables').select('id, codigo').eq('compania_id', req.companiaId);
  const idPorCodigo = Object.fromEntries((todas || []).map((c) => [c.codigo, c.id]));

  for (const fila of filas) {
    const codigo = (fila.codigo || '').trim();
    const codigoPadre = (fila.cuenta_padre_codigo || '').trim();
    if (!codigo || !codigoPadre) continue;

    if (!idPorCodigo[codigoPadre]) {
      errores.push('La cuenta ' + codigo + ' referencia un padre "' + codigoPadre + '" que no existe.');
      continue;
    }
    await supabase.from('cuentas_contables').update({ cuenta_padre_id: idPorCodigo[codigoPadre] }).eq('id', idPorCodigo[codigo]);
  }

  res.json({ creadas, actualizadas, errores });
}

module.exports = { listar, crear, actualizar, eliminar, importar };

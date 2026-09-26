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
//
// Se guarda en TANDAS (no cuenta por cuenta), así 500+ cuentas tardan
// segundos en vez de minutos:
//   1) upsert de todas las cuentas por (compania_id, codigo), sin el padre.
//   2) con todas ya creadas, se resuelve cuenta_padre_codigo -> id y se
//      guarda también en tandas.
// Si un código viene repetido en el archivo, vale la última fila.
const TAMANO_TANDA = 500;
const TIPOS_CUENTA = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'];
const esFalso = (v) => v === false || v === 'false' || v === '0' || v === 'no' || v === 'No';

async function importar(req, res) {
  const filas = req.body.filas;
  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: 'No hay filas para importar.' });
  }

  const errores = [];
  const porCodigo = new Map();

  filas.forEach((fila, i) => {
    const codigo = (fila.codigo || '').trim();
    const nombre = (fila.nombre || '').trim();
    const tipo = (fila.tipo || '').trim().toLowerCase();
    if (!codigo || !nombre || !TIPOS_CUENTA.includes(tipo)) {
      errores.push('Fila ' + (i + 2) + ' (código "' + codigo + '"): faltan datos o el tipo no es válido.');
      return;
    }
    porCodigo.set(codigo, {
      compania_id: req.companiaId,
      codigo,
      nombre,
      tipo,
      acepta_movimiento: !esFalso(fila.acepta_movimiento),
      activa: !esFalso(fila.activa),
      _padre: (fila.cuenta_padre_codigo || '').trim(),
    });
  });

  const validas = [...porCodigo.values()];
  if (validas.length === 0) return res.status(400).json({ error: 'Ninguna fila es válida.', errores });

  // Cuáles ya existían (para decir cuántas se crearon y cuántas se actualizaron)
  const { data: previas, error: errorPrevias } = await supabase
    .from('cuentas_contables').select('codigo').eq('compania_id', req.companiaId);
  if (errorPrevias) return res.status(500).json({ error: errorPrevias.message });
  const existentes = new Set((previas || []).map((c) => c.codigo));

  // Pasada 1: crear / actualizar en tandas (sin tocar el padre)
  const idPorCodigo = {};
  for (let i = 0; i < validas.length; i += TAMANO_TANDA) {
    const tanda = validas.slice(i, i + TAMANO_TANDA).map(({ _padre, ...resto }) => resto);
    const { data, error } = await supabase
      .from('cuentas_contables')
      .upsert(tanda, { onConflict: 'compania_id,codigo' })
      .select('id, codigo');
    if (error) return res.status(500).json({ error: 'Error guardando las cuentas: ' + error.message, errores });
    (data || []).forEach((c) => { idPorCodigo[c.codigo] = c.id; });
  }

  // Incluye cuentas que ya existían y que el archivo usa como padre
  const { data: todas } = await supabase.from('cuentas_contables').select('id, codigo').eq('compania_id', req.companiaId);
  (todas || []).forEach((c) => { if (!idPorCodigo[c.codigo]) idPorCodigo[c.codigo] = c.id; });

  // Pasada 2: enlazar cada cuenta con su padre, también en tandas
  const conPadre = [];
  validas.forEach((c) => {
    if (!c._padre) return;
    if (!idPorCodigo[c._padre]) {
      errores.push('La cuenta ' + c.codigo + ' referencia un padre "' + c._padre + '" que no existe.');
      return;
    }
    const { _padre, ...resto } = c;
    conPadre.push({ ...resto, id: idPorCodigo[c.codigo], cuenta_padre_id: idPorCodigo[_padre] });
  });
  for (let i = 0; i < conPadre.length; i += TAMANO_TANDA) {
    const { error } = await supabase
      .from('cuentas_contables')
      .upsert(conPadre.slice(i, i + TAMANO_TANDA), { onConflict: 'id' });
    if (error) return res.status(500).json({ error: 'Las cuentas se guardaron, pero falló el enlace con sus cuentas padre: ' + error.message, errores });
  }

  const creadas = validas.filter((c) => !existentes.has(c.codigo)).length;
  res.json({ creadas, actualizadas: validas.length - creadas, errores });
}

// POST /cuentas-contables/vaciar — borra TODO el plan de cuentas de la
// compañía actual para volver a cargarlo (por ejemplo, desde un CSV).
// Protecciones:
//   - hay que mandar { confirmacion: 'BORRAR' }
//   - si alguna cuenta ya tiene asientos contables, NO se borra nada
//     (se perdería la contabilidad registrada).
// Las cuentas asignadas a clientes, proveedores, artículos, cuentas
// bancarias y configuración contable quedan en blanco (on delete set null).
async function vaciar(req, res) {
  if (!req.body || req.body.confirmacion !== 'BORRAR') {
    return res.status(400).json({ error: 'Para vaciar el plan de cuentas escribe BORRAR como confirmación.' });
  }

  const { data: cuentas, error: errorCuentas } = await supabase
    .from('cuentas_contables')
    .select('id')
    .eq('compania_id', req.companiaId);
  if (errorCuentas) return res.status(500).json({ error: errorCuentas.message });
  if (!cuentas || cuentas.length === 0) return res.json({ eliminadas: 0 });

  const ids = cuentas.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { count, error } = await supabase
      .from('asientos_detalle')
      .select('id', { count: 'exact', head: true })
      .in('cuenta_contable_id', ids.slice(i, i + 200));
    if (error) return res.status(500).json({ error: error.message });
    if (count && count > 0) {
      return res.status(409).json({ error: 'No se puede vaciar: hay cuentas con asientos contables registrados. Elimina o anula esos asientos primero.' });
    }
  }

  // Primero se sueltan los vínculos padre-hijo y luego se borra todo
  const { error: errorPadres } = await supabase
    .from('cuentas_contables')
    .update({ cuenta_padre_id: null })
    .eq('compania_id', req.companiaId);
  if (errorPadres) return res.status(500).json({ error: errorPadres.message });

  const { error: errorBorrar } = await supabase
    .from('cuentas_contables')
    .delete()
    .eq('compania_id', req.companiaId);
  if (errorBorrar) return res.status(500).json({ error: errorBorrar.message });

  res.json({ eliminadas: ids.length });
}

module.exports = { listar, crear, actualizar, eliminar, importar, vaciar };

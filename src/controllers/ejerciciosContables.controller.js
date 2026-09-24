// Controlador de EJERCICIOS CONTABLES (el año fiscal completo).
//
// GET  /ejercicios-contables            -> listar
// POST /ejercicios-contables            -> abrir uno nuevo (genera saldos
//                                           iniciales si hay un ejercicio
//                                           anterior ya cerrado)
// POST /ejercicios-contables/:id/cerrar -> cerrarlo (traslada utilidad/
//                                           pérdida a la cuenta de Patrimonio
//                                           configurada, y deja las cuentas
//                                           de Ingreso/Gasto/Costo en cero)

const supabase = require('../db/supabaseClient');
const motor = require('../utils/motorAsientos');

async function listar(req, res) {
  const { data, error } = await supabase
    .from('ejercicios_contables')
    .select('*')
    .eq('compania_id', req.companiaId)
    .order('anio', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// Saldo de cada cuenta de Activo/Pasivo/Patrimonio, acumulado hasta
// una fecha de corte (para el asiento de apertura del año siguiente).
async function saldosBalanceHasta(companiaId, fechaCorte) {
  const { data, error } = await supabase
    .from('asientos_contables')
    .select('fecha, asientos_detalle ( debito, credito, cuenta_contable_id, cuentas_contables ( codigo, nombre, tipo, acepta_movimiento ) )')
    .eq('compania_id', companiaId)
    .eq('estado', 'contabilizado')
    .lte('fecha', fechaCorte);
  if (error) throw new Error(error.message);

  const porCuenta = {};
  data.forEach((asiento) => {
    asiento.asientos_detalle.forEach((linea) => {
      const cuenta = linea.cuentas_contables;
      if (!cuenta || !['activo', 'pasivo', 'patrimonio'].includes(cuenta.tipo)) return;
      if (!porCuenta[linea.cuenta_contable_id]) porCuenta[linea.cuenta_contable_id] = { cuenta, saldo: 0 };
      porCuenta[linea.cuenta_contable_id].saldo += Number(linea.debito) - Number(linea.credito);
    });
  });

  return Object.entries(porCuenta)
    .map(([id, v]) => ({ cuenta_contable_id: id, cuenta: v.cuenta, saldo: Math.round(v.saldo * 100) / 100 }))
    .filter((f) => Math.abs(f.saldo) > 0.005);
}

// Saldo de cada cuenta de Ingreso/Gasto/Costo, dentro del rango del
// ejercicio (para el asiento de cierre).
async function saldosResultadosEnRango(companiaId, desde, hasta) {
  const { data, error } = await supabase
    .from('asientos_contables')
    .select('fecha, asientos_detalle ( debito, credito, cuenta_contable_id, cuentas_contables ( codigo, nombre, tipo ) )')
    .eq('compania_id', companiaId)
    .eq('estado', 'contabilizado')
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw new Error(error.message);

  const porCuenta = {};
  data.forEach((asiento) => {
    asiento.asientos_detalle.forEach((linea) => {
      const cuenta = linea.cuentas_contables;
      if (!cuenta || !['ingreso', 'gasto', 'costo'].includes(cuenta.tipo)) return;
      if (!porCuenta[linea.cuenta_contable_id]) porCuenta[linea.cuenta_contable_id] = { cuenta, saldoDebito: 0, saldoCredito: 0 };
      porCuenta[linea.cuenta_contable_id].saldoDebito += Number(linea.debito);
      porCuenta[linea.cuenta_contable_id].saldoCredito += Number(linea.credito);
    });
  });

  return Object.entries(porCuenta)
    .map(([id, v]) => ({
      cuenta_contable_id: id,
      cuenta: v.cuenta,
      saldo: v.cuenta.tipo === 'ingreso'
        ? Math.round((v.saldoCredito - v.saldoDebito) * 100) / 100
        : Math.round((v.saldoDebito - v.saldoCredito) * 100) / 100,
    }))
    .filter((f) => Math.abs(f.saldo) > 0.005);
}

// POST /ejercicios-contables — abrir uno nuevo.
async function abrirEjercicio(req, res) {
  const { anio, fecha_inicio, fecha_fin } = req.body;
  if (!anio || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'anio, fecha_inicio y fecha_fin son obligatorios.' });
  }

  const { data: existente } = await supabase
    .from('ejercicios_contables')
    .select('id')
    .eq('compania_id', req.companiaId)
    .eq('anio', anio)
    .maybeSingle();
  if (existente) return res.status(409).json({ error: 'Ya existe un ejercicio para ese año.' });

  const { data: anterior } = await supabase
    .from('ejercicios_contables')
    .select('id, estado, fecha_fin')
    .eq('compania_id', req.companiaId)
    .eq('anio', anio - 1)
    .maybeSingle();

  let asientoAperturaId = null;

  if (anterior && anterior.estado === 'cerrado') {
    let saldos;
    try {
      saldos = await saldosBalanceHasta(req.companiaId, anterior.fecha_fin);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    if (saldos.length > 0) {
      const lineas = saldos.map((s) => ({
        cuenta_contable_id: s.cuenta_contable_id,
        debito: s.cuenta.tipo === 'activo' ? Math.max(s.saldo, 0) : Math.max(-s.saldo, 0),
        credito: s.cuenta.tipo === 'activo' ? Math.max(-s.saldo, 0) : Math.max(s.saldo, 0),
      }));

      try {
        const asiento = await motor.crearAsiento(req.companiaId, {
          fecha: fecha_inicio,
          descripcion: 'Apertura del ejercicio ' + anio + ' — saldos iniciales',
          documentoOrigenTipo: 'apertura_ejercicio',
          creadoPor: req.usuario.usuario_id,
          lineas,
          estadoInicial: 'contabilizado',
        });
        asientoAperturaId = asiento.id;
      } catch (err) {
        return res.status(500).json({ error: 'No se pudo generar el asiento de apertura: ' + err.message });
      }
    }
  }

  const { data, error } = await supabase
    .from('ejercicios_contables')
    .insert([{
      compania_id: req.companiaId,
      anio, fecha_inicio, fecha_fin,
      asiento_apertura_id: asientoAperturaId,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

// POST /ejercicios-contables/:id/cerrar
async function cerrarEjercicio(req, res) {
  const { id } = req.params;

  const { data: ejercicio } = await supabase.from('ejercicios_contables').select('*').eq('id', id).eq('compania_id', req.companiaId).single();
  if (!ejercicio) return res.status(404).json({ error: 'Ejercicio no encontrado.' });
  if (ejercicio.estado === 'cerrado') return res.status(409).json({ error: 'Este ejercicio ya está cerrado.' });

  const { data: config } = await supabase
    .from('configuracion_contable')
    .select('cuenta_utilidad_ejercicio_id')
    .eq('compania_id', req.companiaId)
    .maybeSingle();
  if (!config || !config.cuenta_utilidad_ejercicio_id) {
    return res.status(400).json({ error: 'Antes de cerrar, configura la cuenta de utilidad del ejercicio en Configuración Contable.' });
  }

  let saldos;
  try {
    saldos = await saldosResultadosEnRango(req.companiaId, ejercicio.fecha_inicio, ejercicio.fecha_fin);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (saldos.length === 0) {
    return res.status(400).json({ error: 'No hay movimientos de Ingreso/Gasto/Costo contabilizados en este ejercicio — no hay nada que cerrar.' });
  }

  const lineas = saldos.map((s) => ({
    cuenta_contable_id: s.cuenta_contable_id,
    debito: s.cuenta.tipo === 'ingreso' ? s.saldo : 0,
    credito: s.cuenta.tipo !== 'ingreso' ? s.saldo : 0,
  }));

  const totalIngresos = saldos.filter((s) => s.cuenta.tipo === 'ingreso').reduce((sum, s) => sum + s.saldo, 0);
  const totalGastosCostos = saldos.filter((s) => s.cuenta.tipo !== 'ingreso').reduce((sum, s) => sum + s.saldo, 0);
  const utilidadNeta = Math.round((totalIngresos - totalGastosCostos) * 100) / 100;

  if (Math.abs(utilidadNeta) > 0.005) {
    lineas.push({
      cuenta_contable_id: config.cuenta_utilidad_ejercicio_id,
      debito: utilidadNeta < 0 ? Math.abs(utilidadNeta) : 0,
      credito: utilidadNeta > 0 ? utilidadNeta : 0,
    });
  }

  let asientoCierre;
  try {
    asientoCierre = await motor.crearAsiento(req.companiaId, {
      fecha: ejercicio.fecha_fin,
      descripcion: 'Cierre del ejercicio ' + ejercicio.anio + ' — utilidad/pérdida neta: ' + utilidadNeta,
      documentoOrigenTipo: 'cierre_ejercicio',
      creadoPor: req.usuario.usuario_id,
      lineas,
      estadoInicial: 'contabilizado',
    });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo generar el asiento de cierre: ' + err.message });
  }

  const { data, error } = await supabase
    .from('ejercicios_contables')
    .update({
      estado: 'cerrado',
      asiento_cierre_id: asientoCierre.id,
      cerrado_por: req.usuario.usuario_id,
      cerrado_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, utilidad_neta: utilidadNeta });
}

module.exports = { listar, abrirEjercicio, cerrarEjercicio };

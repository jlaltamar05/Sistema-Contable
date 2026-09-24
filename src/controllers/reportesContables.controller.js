// Reportes contables. TODOS llevan el filtro de estatus del asiento
// (pendiente / contabilizado / todos), como quedó acordado.
//
// GET /reportes-contables/libro-diario?desde=&hasta=&estado=
// GET /reportes-contables/balance-comprobacion?desde=&hasta=&estado=

const supabase = require('../db/supabaseClient');

function aplicarFiltrosComunes(consulta, q) {
  if (q.desde) consulta = consulta.gte('fecha', q.desde);
  if (q.hasta) consulta = consulta.lte('fecha', q.hasta);
  if (q.estado && q.estado !== 'todos') consulta = consulta.eq('estado', q.estado);
  return consulta;
}

async function libroDiario(req, res) {
  let consulta = supabase
    .from('asientos_contables')
    .select('id, numero_asiento, fecha, descripcion, estado, asientos_detalle ( debito, credito, descripcion, cuentas_contables ( codigo, nombre ) )')
    .eq('compania_id', req.companiaId)
    .order('fecha', { ascending: true })
    .order('numero_asiento', { ascending: true });

  consulta = aplicarFiltrosComunes(consulta, req.query);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const totalDebito = data.reduce((s, a) => s + a.asientos_detalle.reduce((s2, l) => s2 + Number(l.debito), 0), 0);
  const totalCredito = data.reduce((s, a) => s + a.asientos_detalle.reduce((s2, l) => s2 + Number(l.credito), 0), 0);

  res.json({ asientos: data, totales: { debito: totalDebito, credito: totalCredito } });
}

async function balanceComprobacion(req, res) {
  let consulta = supabase
    .from('asientos_contables')
    .select('estado, fecha, asientos_detalle ( debito, credito, cuenta_contable_id, cuentas_contables ( codigo, nombre, tipo ) )')
    .eq('compania_id', req.companiaId);

  consulta = aplicarFiltrosComunes(consulta, req.query);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const porCuenta = {};
  data.forEach((asiento) => {
    asiento.asientos_detalle.forEach((linea) => {
      const cuenta = linea.cuentas_contables;
      if (!cuenta) return;
      if (!porCuenta[linea.cuenta_contable_id]) {
        porCuenta[linea.cuenta_contable_id] = { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, debito: 0, credito: 0 };
      }
      porCuenta[linea.cuenta_contable_id].debito += Number(linea.debito);
      porCuenta[linea.cuenta_contable_id].credito += Number(linea.credito);
    });
  });

  const filas = Object.values(porCuenta)
    .map((c) => ({ ...c, saldo: Math.round((c.debito - c.credito) * 100) / 100 }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totales = filas.reduce((acc, f) => ({ debito: acc.debito + f.debito, credito: acc.credito + f.credito }), { debito: 0, credito: 0 });

  res.json({ cuentas: filas, totales });
}

async function estadoResultados(req, res) {
  let consulta = supabase
    .from('asientos_contables')
    .select('estado, asientos_detalle ( debito, credito, cuentas_contables ( codigo, nombre, tipo ) )')
    .eq('compania_id', req.companiaId);

  consulta = aplicarFiltrosComunes(consulta, req.query);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const porCuenta = {};
  data.forEach((asiento) => {
    asiento.asientos_detalle.forEach((linea) => {
      const cuenta = linea.cuentas_contables;
      if (!cuenta || !['ingreso', 'gasto', 'costo'].includes(cuenta.tipo)) return;
      if (!porCuenta[cuenta.codigo]) porCuenta[cuenta.codigo] = { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, monto: 0 };
      // Ingreso es de naturaleza acreedora (crédito suma); gasto/costo es deudora (débito suma).
      if (cuenta.tipo === 'ingreso') porCuenta[cuenta.codigo].monto += Number(linea.credito) - Number(linea.debito);
      else porCuenta[cuenta.codigo].monto += Number(linea.debito) - Number(linea.credito);
    });
  });

  const filas = Object.values(porCuenta).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const ingresos = filas.filter((f) => f.tipo === 'ingreso');
  const gastosYCostos = filas.filter((f) => f.tipo !== 'ingreso');
  const totalIngresos = ingresos.reduce((s, f) => s + f.monto, 0);
  const totalGastosCostos = gastosYCostos.reduce((s, f) => s + f.monto, 0);

  res.json({
    ingresos, gastosYCostos,
    totalIngresos, totalGastosCostos,
    utilidadNeta: Math.round((totalIngresos - totalGastosCostos) * 100) / 100,
  });
}

// Balance General es una FOTO a una fecha de corte (no un rango): toma
// todo el movimiento desde el inicio hasta "hasta". Si no se manda
// "hasta", se usa hoy.
async function balanceGeneral(req, res) {
  const hasta = req.query.hasta || new Date().toISOString().slice(0, 10);
  const estado = req.query.estado;

  let consulta = supabase
    .from('asientos_contables')
    .select('estado, fecha, asientos_detalle ( debito, credito, cuentas_contables ( codigo, nombre, tipo ) )')
    .eq('compania_id', req.companiaId)
    .lte('fecha', hasta);

  if (estado && estado !== 'todos') consulta = consulta.eq('estado', estado);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const porCuenta = {};
  data.forEach((asiento) => {
    asiento.asientos_detalle.forEach((linea) => {
      const cuenta = linea.cuentas_contables;
      if (!cuenta || !['activo', 'pasivo', 'patrimonio'].includes(cuenta.tipo)) return;
      if (!porCuenta[cuenta.codigo]) porCuenta[cuenta.codigo] = { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, saldo: 0 };
      // Activo es deudor (débito suma); pasivo/patrimonio es acreedor (crédito suma).
      if (cuenta.tipo === 'activo') porCuenta[cuenta.codigo].saldo += Number(linea.debito) - Number(linea.credito);
      else porCuenta[cuenta.codigo].saldo += Number(linea.credito) - Number(linea.debito);
    });
  });

  const filas = Object.values(porCuenta).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const activos = filas.filter((f) => f.tipo === 'activo');
  const pasivos = filas.filter((f) => f.tipo === 'pasivo');
  const patrimonio = filas.filter((f) => f.tipo === 'patrimonio');
  const totalActivos = activos.reduce((s, f) => s + f.saldo, 0);
  const totalPasivos = pasivos.reduce((s, f) => s + f.saldo, 0);
  const totalPatrimonio = patrimonio.reduce((s, f) => s + f.saldo, 0);

  res.json({
    hasta, activos, pasivos, patrimonio,
    totalActivos, totalPasivos, totalPatrimonio,
    totalPasivoMasPatrimonio: Math.round((totalPasivos + totalPatrimonio) * 100) / 100,
  });
}

async function libroMayor(req, res) {
  let consulta = supabase
    .from('asientos_detalle')
    .select('debito, credito, descripcion, cuentas_contables ( id, codigo, nombre ), asientos_contables!inner ( numero_asiento, fecha, estado, compania_id )')
    .eq('asientos_contables.compania_id', req.companiaId);

  if (req.query.desde) consulta = consulta.gte('asientos_contables.fecha', req.query.desde);
  if (req.query.hasta) consulta = consulta.lte('asientos_contables.fecha', req.query.hasta);
  if (req.query.estado && req.query.estado !== 'todos') consulta = consulta.eq('asientos_contables.estado', req.query.estado);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const porCuenta = {};
  data.forEach((linea) => {
    const cuenta = linea.cuentas_contables;
    const asiento = linea.asientos_contables;
    if (!cuenta || !asiento) return;
    if (!porCuenta[cuenta.id]) porCuenta[cuenta.id] = { codigo: cuenta.codigo, nombre: cuenta.nombre, movimientos: [] };
    porCuenta[cuenta.id].movimientos.push({
      numero_asiento: asiento.numero_asiento,
      fecha: asiento.fecha,
      estado: asiento.estado,
      descripcion: linea.descripcion,
      debito: Number(linea.debito),
      credito: Number(linea.credito),
    });
  });

  const cuentas = Object.values(porCuenta)
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((c) => {
      let saldo = 0;
      const movimientos = c.movimientos
        .sort((a, b) => (a.fecha + a.numero_asiento).localeCompare(b.fecha + b.numero_asiento))
        .map((m) => {
          saldo = Math.round((saldo + m.debito - m.credito) * 100) / 100;
          return { ...m, saldo_acumulado: saldo };
        });
      return { codigo: c.codigo, nombre: c.nombre, movimientos, saldo_final: saldo };
    });

  res.json({ cuentas });
}

module.exports = { libroDiario, balanceComprobacion, estadoResultados, balanceGeneral, libroMayor };

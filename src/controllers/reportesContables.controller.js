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

module.exports = { libroDiario, balanceComprobacion };

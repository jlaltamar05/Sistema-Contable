// Constructor de Informes — versión Contabilidad. Mismo patrón que el
// del Sistema Administrativo: fuentes y columnas fijas (nunca tabla u
// columna arbitraria), por seguridad.
//
// Por ahora dos fuentes: Plan de Cuentas (tabla plana, simple) y
// Asientos a nivel de encabezado (sin desglosar líneas todavía — el
// detalle línea por línea con su cuenta queda para una versión
// futura, porque requiere unir tres tablas de forma segura).

const supabase = require('../db/supabaseClient');

const FUENTES = {
  cuentas_contables: {
    titulo: 'Plan de Cuentas',
    tabla: 'cuentas_contables',
    columnas: {
      codigo: { titulo: 'Código', tipo: 'texto' },
      nombre: { titulo: 'Nombre', tipo: 'texto' },
      tipo: { titulo: 'Tipo', tipo: 'texto' },
      acepta_movimiento: { titulo: 'Acepta movimiento', tipo: 'texto' },
      activa: { titulo: 'Activa', tipo: 'texto' },
    },
  },
  asientos: {
    titulo: 'Asientos (encabezado)',
    tabla: 'asientos_contables',
    fechaFiltro: 'fecha',
    columnas: {
      numero_asiento: { titulo: 'Nro asiento', tipo: 'texto' },
      fecha: { titulo: 'Fecha', tipo: 'fecha' },
      descripcion: { titulo: 'Descripción', tipo: 'texto' },
      estado: { titulo: 'Estado', tipo: 'texto' },
      documento_origen_tipo: { titulo: 'Origen', tipo: 'texto' },
    },
  },
  asientos_detalle: {
    titulo: 'Asientos (detalle por línea, con su cuenta)',
    // Esta fuente cruza tres tablas (detalle + encabezado + cuenta),
    // así que no usa el camino genérico de las demás — ejecutar()
    // la trata como caso especial más abajo.
    esUnion: true,
    fechaFiltro: 'fecha',
    columnas: {
      numero_asiento: { titulo: 'Nro asiento', tipo: 'texto' },
      fecha: { titulo: 'Fecha', tipo: 'fecha' },
      estado: { titulo: 'Estado', tipo: 'texto' },
      cuenta_codigo: { titulo: 'Código cuenta', tipo: 'texto' },
      cuenta_nombre: { titulo: 'Cuenta', tipo: 'texto' },
      cuenta_tipo: { titulo: 'Tipo cuenta', tipo: 'texto' },
      descripcion: { titulo: 'Descripción línea', tipo: 'texto' },
      debito: { titulo: 'Débito', tipo: 'monto' },
      credito: { titulo: 'Crédito', tipo: 'monto' },
    },
  },
};

function columnasValidas(fuente, columnas) {
  const disponibles = Object.keys(FUENTES[fuente].columnas);
  return (columnas || []).filter((c) => disponibles.includes(c));
}

async function metadatos(req, res) {
  const resultado = Object.entries(FUENTES).map(([clave, f]) => ({
    fuente: clave,
    titulo: f.titulo,
    tieneFecha: !!f.fechaFiltro,
    columnas: Object.entries(f.columnas).map(([clave2, c]) => ({ clave: clave2, titulo: c.titulo, tipo: c.tipo })),
  }));
  res.json(resultado);
}

async function listar(req, res) {
  const { data, error } = await supabase
    .from('informes_contables_definidos')
    .select('*')
    .eq('compania_id', req.companiaId)
    .order('nombre', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function crear(req, res) {
  const { nombre, fuente, columnas, orden_por, orden_direccion } = req.body;

  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!FUENTES[fuente]) return res.status(400).json({ error: 'Fuente de datos no válida' });

  const columnasFiltradas = columnasValidas(fuente, columnas);
  if (columnasFiltradas.length === 0) return res.status(400).json({ error: 'Elige al menos una columna' });

  const ordenValido = columnasFiltradas.includes(orden_por) ? orden_por : null;

  const { data, error } = await supabase
    .from('informes_contables_definidos')
    .insert([{
      compania_id: req.companiaId,
      nombre: nombre.trim(),
      fuente,
      columnas: columnasFiltradas,
      orden_por: ordenValido,
      orden_direccion: orden_direccion === 'desc' ? 'desc' : 'asc',
      creado_por: req.usuario ? req.usuario.usuario_id : null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, fuente, columnas, orden_por, orden_direccion } = req.body;

  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!FUENTES[fuente]) return res.status(400).json({ error: 'Fuente de datos no válida' });

  const columnasFiltradas = columnasValidas(fuente, columnas);
  if (columnasFiltradas.length === 0) return res.status(400).json({ error: 'Elige al menos una columna' });

  const ordenValido = columnasFiltradas.includes(orden_por) ? orden_por : null;

  const { data, error } = await supabase
    .from('informes_contables_definidos')
    .update({
      nombre: nombre.trim(),
      fuente,
      columnas: columnasFiltradas,
      orden_por: ordenValido,
      orden_direccion: orden_direccion === 'desc' ? 'desc' : 'asc',
    })
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function eliminar(req, res) {
  const { id } = req.params;
  const { error } = await supabase
    .from('informes_contables_definidos')
    .delete()
    .eq('id', id)
    .eq('compania_id', req.companiaId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
}

async function ejecutar(req, res) {
  const { id } = req.params;

  const { data: definicion, error: errorDef } = await supabase
    .from('informes_contables_definidos')
    .select('*')
    .eq('id', id)
    .eq('compania_id', req.companiaId)
    .single();

  if (errorDef || !definicion) return res.status(404).json({ error: 'Informe no encontrado' });

  const fuenteCfg = FUENTES[definicion.fuente];
  if (!fuenteCfg) return res.status(400).json({ error: 'La fuente de este informe ya no está disponible' });

  const columnas = columnasValidas(definicion.fuente, definicion.columnas);

  // ---- Fuente especial: cruza detalle + encabezado + cuenta ----
  if (fuenteCfg.esUnion) {
    let consulta = supabase
      .from('asientos_detalle')
      .select('debito, credito, descripcion, asientos_contables!inner ( numero_asiento, fecha, estado, compania_id ), cuentas_contables ( codigo, nombre, tipo )')
      .eq('asientos_contables.compania_id', req.companiaId);

    if (req.query.desde) consulta = consulta.gte('asientos_contables.fecha', req.query.desde);
    if (req.query.hasta) consulta = consulta.lte('asientos_contables.fecha', req.query.hasta);

    const { data, error } = await consulta.limit(1000);
    if (error) return res.status(500).json({ error: error.message });

    let filas = data.map((linea) => ({
      numero_asiento: linea.asientos_contables ? linea.asientos_contables.numero_asiento : null,
      fecha: linea.asientos_contables ? linea.asientos_contables.fecha : null,
      estado: linea.asientos_contables ? linea.asientos_contables.estado : null,
      cuenta_codigo: linea.cuentas_contables ? linea.cuentas_contables.codigo : null,
      cuenta_nombre: linea.cuentas_contables ? linea.cuentas_contables.nombre : null,
      cuenta_tipo: linea.cuentas_contables ? linea.cuentas_contables.tipo : null,
      descripcion: linea.descripcion,
      debito: linea.debito,
      credito: linea.credito,
    }));

    if (definicion.orden_por && columnas.includes(definicion.orden_por)) {
      const campo = definicion.orden_por;
      const signo = definicion.orden_direccion === 'desc' ? -1 : 1;
      filas.sort((a, b) => (a[campo] > b[campo] ? signo : a[campo] < b[campo] ? -signo : 0));
    }

    // Se recorta a solo las columnas elegidas, después de haber armado la fila completa.
    filas = filas.map((f) => Object.fromEntries(columnas.map((c) => [c, f[c]])));

    return res.json({
      codigo: 'personalizado_' + definicion.id,
      titulo: definicion.nombre,
      subtitulo: fuenteCfg.titulo + (filas.length >= 1000 ? ' · mostrando las primeras 1000 filas' : ''),
      generado: new Date().toISOString(),
      columnas: columnas.map((c) => ({ clave: c, titulo: fuenteCfg.columnas[c].titulo, tipo: fuenteCfg.columnas[c].tipo })),
      filas,
      totales: null,
      resumen: [],
    });
  }

  // ---- Fuentes normales: una sola tabla plana ----
  let consulta = supabase
    .from(fuenteCfg.tabla)
    .select(columnas.join(','))
    .eq('compania_id', req.companiaId);

  if (fuenteCfg.fechaFiltro && req.query.desde) consulta = consulta.gte(fuenteCfg.fechaFiltro, req.query.desde);
  if (fuenteCfg.fechaFiltro && req.query.hasta) consulta = consulta.lte(fuenteCfg.fechaFiltro, req.query.hasta);

  if (definicion.orden_por && columnas.includes(definicion.orden_por)) {
    consulta = consulta.order(definicion.orden_por, { ascending: definicion.orden_direccion !== 'desc' });
  }

  const { data, error } = await consulta.limit(1000);
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    codigo: 'personalizado_' + definicion.id,
    titulo: definicion.nombre,
    subtitulo: fuenteCfg.titulo + (data.length >= 1000 ? ' · mostrando las primeras 1000 filas' : ''),
    generado: new Date().toISOString(),
    columnas: columnas.map((c) => ({ clave: c, titulo: fuenteCfg.columnas[c].titulo, tipo: fuenteCfg.columnas[c].tipo })),
    filas: data,
    totales: null,
    resumen: [],
  });
}

module.exports = { metadatos, listar, crear, actualizar, eliminar, ejecutar };

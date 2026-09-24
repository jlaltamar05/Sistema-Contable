// Utilidad compartida: genera el siguiente número de documento
// (Cotización, Pedido, Factura, Orden de Compra, Compra, Despacho,
// Recepción, Nota de Crédito, Cobro, Cliente, Proveedor...), usando el
// prefijo y el contador guardados en Configuración general.
// Cada llamada incrementa el contador correspondiente.
//
// CADA COMPAÑÍA TIENE SU PROPIO prefijo Y contador (filas de
// configuracion_general con su compania_id). Para eso hay que pasar el
// tercer parámetro: generarNumeroAutomatico('prefijo_x', 'contador_x', req.companiaId).
// Si se llama SIN companiaId (por ejemplo un controlador que aún no se
// actualizó, como Contratos) se conserva el comportamiento anterior,
// que no separa por compañía.
//
// El contador guarda el ÚLTIMO número usado; el próximo es contador + 1.
// El número final es prefijo + contador con 4 dígitos (PED-0005).

const supabase = require('../db/supabaseClient');

const DIGITOS = 4;

// Módulo (pestaña de Configuración) al que pertenece cada documento;
// solo se usa al crear una fila nueva de contador o de prefijo.
const MODULO_POR_DOCUMENTO = {
  factura: 'ventas',
  pedido: 'ventas',
  cotizacion: 'ventas',
  nota_credito: 'ventas',
  cliente: 'ventas',
  vendedor: 'ventas',
  cobro: 'ventas',
  orden_compra: 'compras',
  compra: 'compras',
  proveedor: 'compras',
  despacho: 'inventario',
  recepcion: 'inventario',
  transferencia: 'inventario',
  orden_servicio: 'taller',
  cita: 'taller',
  asiento: 'contabilidad',
};

function moduloDe(clave) {
  const documento = String(clave).replace(/^(prefijo|contador)_/, '');
  return MODULO_POR_DOCUMENTO[documento] || 'general';
}

function formatearNumero(prefijo, numero) {
  return (prefijo || '') + String(numero).padStart(DIGITOS, '0');
}

// ---------- Por compañía ----------

async function leerFila(companiaId, clave) {
  const { data, error } = await supabase
    .from('configuracion_general')
    .select('id, valor')
    .eq('compania_id', companiaId)
    .eq('clave', clave)
    .limit(1);

  if (error) throw new Error('No se pudo leer ' + clave + ': ' + error.message);
  return data && data.length > 0 ? data[0] : null;
}

function enteroDe(valor) {
  return parseInt(valor, 10) || 0;
}

async function leerPrefijo(companiaId, clavePrefijo) {
  const fila = await leerFila(companiaId, clavePrefijo);
  return fila && fila.valor ? String(fila.valor).trim() : '';
}

// Guarda un valor (crea la fila si no existe). Usado por la pantalla
// de Configuración para el prefijo y el próximo número.
async function guardarValor(companiaId, clave, valor, descripcion) {
  const fila = await leerFila(companiaId, clave);

  if (fila) {
    const { error } = await supabase
      .from('configuracion_general')
      .update({ valor: String(valor) })
      .eq('id', fila.id);
    if (error) throw new Error('No se pudo guardar ' + clave + ': ' + error.message);
    return;
  }

  const { error } = await supabase
    .from('configuracion_general')
    .insert([{
      compania_id: companiaId,
      clave,
      valor: String(valor),
      modulo: moduloDe(clave),
      descripcion: descripcion || null,
    }]);
  if (error) throw new Error('No se pudo crear ' + clave + ': ' + error.message);
}

// Incrementa el contador de la compañía de forma segura: si dos
// personas guardan al mismo tiempo, la segunda reintenta y recibe el
// número siguiente (nunca el mismo).
async function siguienteContador(companiaId, claveContador) {
  for (let intento = 0; intento < 10; intento++) {
    const fila = await leerFila(companiaId, claveContador);

    if (!fila) {
      const { error } = await supabase
        .from('configuracion_general')
        .insert([{
          compania_id: companiaId,
          clave: claveContador,
          valor: '1',
          modulo: moduloDe(claveContador),
          descripcion: 'Contador automático (último número usado)',
        }]);
      if (!error) return 1;
      if (error.code === '23505') continue; // otro usuario la creó primero: reintentar
      throw new Error('No se pudo crear ' + claveContador + ': ' + error.message);
    }

    const siguiente = enteroDe(fila.valor) + 1;
    let consulta = supabase
      .from('configuracion_general')
      .update({ valor: String(siguiente) })
      .eq('id', fila.id);
    consulta = fila.valor === null || fila.valor === undefined
      ? consulta.is('valor', null)
      : consulta.eq('valor', fila.valor);

    const { data, error } = await consulta.select('id');
    if (error) throw new Error('No se pudo actualizar ' + claveContador + ': ' + error.message);
    if (data && data.length > 0) return siguiente;
    // Nadie coincidió: otro usuario cambió el contador en ese instante. Reintentar.
  }

  throw new Error('No se pudo reservar el número de ' + claveContador + ' (demasiada concurrencia).');
}

// Número que se asignaría ahora, SIN consumirlo (para mostrarlo en pantalla).
async function vistaPreviaNumero(companiaId, clavePrefijo, claveContador) {
  const prefijo = await leerPrefijo(companiaId, clavePrefijo);
  const fila = await leerFila(companiaId, claveContador);
  const actual = fila ? enteroDe(fila.valor) : 0;
  return {
    prefijo,
    proximo: actual + 1,
    numero: formatearNumero(prefijo, actual + 1),
  };
}

// ---------- Comportamiento anterior (sin compañía) ----------

async function generarNumeroSinCompania(clavePrefijo, claveContador) {
  const { data: prefijoRow } = await supabase
    .from('configuracion_general')
    .select('valor')
    .eq('clave', clavePrefijo)
    .single();

  const { data: contadorRow } = await supabase
    .from('configuracion_general')
    .select('valor')
    .eq('clave', claveContador)
    .single();

  const prefijo = prefijoRow && prefijoRow.valor ? prefijoRow.valor : '';
  const actual = contadorRow ? (parseInt(contadorRow.valor, 10) || 0) : 0;
  const siguiente = actual + 1;

  if (contadorRow) {
    await supabase
      .from('configuracion_general')
      .update({ valor: String(siguiente) })
      .eq('clave', claveContador);
  } else {
    await supabase
      .from('configuracion_general')
      .insert([{ clave: claveContador, valor: String(siguiente), descripcion: 'Contador automático (no editar manualmente)' }]);
  }

  return formatearNumero(prefijo, siguiente);
}

async function generarNumeroAutomatico(clavePrefijo, claveContador, companiaId) {
  if (!companiaId) return generarNumeroSinCompania(clavePrefijo, claveContador);

  const prefijo = await leerPrefijo(companiaId, clavePrefijo);
  const numero = await siguienteContador(companiaId, claveContador);
  return formatearNumero(prefijo, numero);
}

module.exports = {
  generarNumeroAutomatico,
  vistaPreviaNumero,
  formatearNumero,
  leerFila,
  guardarValor,
  enteroDe,
};

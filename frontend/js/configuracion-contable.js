function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CUENTAS_DEFECTO = [
  { clave: 'cuenta_cxc_defecto_id', etiqueta: 'CxC por defecto (Clientes)' },
  { clave: 'cuenta_cxp_defecto_id', etiqueta: 'CxP por defecto (Proveedores)' },
  { clave: 'cuenta_iva_ventas_defecto_id', etiqueta: 'IVA Ventas' },
  { clave: 'cuenta_iva_compras_defecto_id', etiqueta: 'IVA Compras' },
  { clave: 'cuenta_inventario_defecto_id', etiqueta: 'Inventario por defecto' },
  { clave: 'cuenta_costo_defecto_id', etiqueta: 'Costo de Venta por defecto' },
  { clave: 'cuenta_ingreso_defecto_id', etiqueta: 'Ingreso por Venta por defecto' },
  { clave: 'cuenta_banco_defecto_id', etiqueta: 'Banco / Caja por defecto' },
  { clave: 'cuenta_utilidad_ejercicio_id', etiqueta: 'Utilidad del ejercicio (Patrimonio) — usada al cerrar el año' },
];

let cuentasDisponibles = [];

async function cargarTodo() {
  try {
    const [config, cuentas] = await Promise.all([
      llamarApi('/configuracion-contable'),
      llamarApi('/cuentas-contables'),
    ]);
    cuentasDisponibles = cuentas.filter((c) => c.acepta_movimiento && c.activa);
    dibujarSelects();
    aplicarValores(config);
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function dibujarSelects() {
  const contenedor = document.getElementById('contenedor-cuentas-defecto');
  const opciones = '<option value="">(sin definir)</option>' +
    cuentasDisponibles.map((c) => '<option value="' + c.id + '">' + escaparHtml(c.codigo + ' — ' + c.nombre) + '</option>').join('');

  contenedor.innerHTML = CUENTAS_DEFECTO.map((c) => (
    '<div class="campo"><label for="config-' + c.clave + '">' + escaparHtml(c.etiqueta) + '</label>' +
    '<select id="config-' + c.clave + '">' + opciones + '</select></div>'
  )).join('');
}

function aplicarValores(config) {
  document.getElementById('config-modo').value = config.modo_contabilizacion || 'manual';
  CUENTAS_DEFECTO.forEach((c) => {
    const select = document.getElementById('config-' + c.clave);
    if (select) select.value = config[c.clave] || '';
  });
}

document.getElementById('boton-guardar-config').addEventListener('click', async () => {
  const cuerpo = { modo_contabilizacion: document.getElementById('config-modo').value };
  CUENTAS_DEFECTO.forEach((c) => {
    cuerpo[c.clave] = document.getElementById('config-' + c.clave).value || null;
  });

  try {
    await llamarApi('/configuracion-contable', { method: 'PUT', body: JSON.stringify(cuerpo) });
    mostrarMensaje('Configuración contable guardada.', 'exito');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

cargarTodo();

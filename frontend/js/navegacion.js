// Dibuja la barra lateral de navegación del Sistema Contable.
// Versión simplificada de la del Administrativo: sin categorías
// anidadas, solo los módulos contables (todos los que pueden entrar
// aquí ya tienen acceso a todos ellos — el login ya filtró por rol).

const MODULOS_NAV = [
  { id: 'plan-cuentas', nombre: 'Plan de Cuentas', href: 'plan-cuentas.html' },
  { id: 'centros-costo', nombre: 'Centros de Costo', href: 'centros-costo.html' },
  { id: 'asientos', nombre: 'Asientos Contables', href: 'asientos.html' },
  { id: 'periodos-contables', nombre: 'Períodos Contables', href: 'periodos-contables.html' },
  { id: 'reportes-contables', nombre: 'Reportes Contables', href: 'reportes-contables.html' },
  { id: 'configuracion-contable', nombre: 'Configuración Contable', href: 'configuracion-contable.html' },
];

async function dibujarBarraLateral() {
  exigirSesionEnPagina();

  const contenedor = document.getElementById('barra-lateral');
  if (!contenedor) return;

  const usuarioActual = obtenerUsuarioSesion();
  const esAdministrador = usuarioActual && usuarioActual.rol === 'administrador';
  const moduloActivo = document.body.dataset.modulo;

  const itemsHtml = MODULOS_NAV.map((m) => (
    '<li><a href="' + m.href + '" class="' + (m.id === moduloActivo ? 'activo' : '') + '">' + m.nombre + '</a></li>'
  )).join('');

  const bloqueCompania = esAdministrador
    ? '<div style="margin-bottom: 14px;">' +
      '<label style="display: block; font-size: 11px; color: #9fabc4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Compañía actual</label>' +
      '<select id="selector-compania-actual" style="width: 100%; padding: 8px; border-radius: var(--radio); border: 1px solid var(--azul-noche-suave); background: var(--azul-noche-suave); color: white; font-size: 13px;">' +
      '<option value="">Cargando...</option></select></div>'
    : '';

  const bloqueUsuario = usuarioActual
    ? '<div style="margin-bottom: 14px; padding: 8px 10px; background: var(--azul-noche-suave); border-radius: var(--radio, 6px);">' +
      '<div style="font-size: 10px; color: #9fabc4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Conectado como</div>' +
      '<div style="color: white; font-size: 13px; font-weight: 600;">' + usuarioActual.nombre + ' (' + usuarioActual.rol + ')</div></div>'
    : '';

  contenedor.innerHTML =
    '<div class="marca">' +
    '<img id="logo-compania" alt="Logo de la compañía" style="display: none; max-width: 100%; max-height: 42px; margin-bottom: 6px; border-radius: 4px;" />' +
    'Sistema Contable<span>Independiente del Sistema Administrativo</span></div>' +
    bloqueUsuario + bloqueCompania +
    '<ul class="menu-raiz">' + itemsHtml + '</ul>' +
    '<div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--azul-noche-suave);">' +
    '<button type="button" id="boton-cerrar-sesion" class="boton boton-secundario" style="width: 100%;">Cerrar sesión</button></div>';

  document.getElementById('boton-cerrar-sesion').addEventListener('click', cerrarSesion);

  if (esAdministrador) {
    await cargarSelectorDeCompanias();
  } else if (usuarioActual) {
    establecerCompaniaActualId(usuarioActual.compania_id);
    try {
      const compania = await llamarApi('/companias/' + usuarioActual.compania_id);
      mostrarLogoCompania(compania);
    } catch (err) {
      // sin logo disponible — no rompe nada
    }
  }
}

function mostrarLogoCompania(compania) {
  const img = document.getElementById('logo-compania');
  if (!img) return;
  if (compania && compania.logo_url) {
    img.src = compania.logo_url;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }
}

async function cargarSelectorDeCompanias() {
  const selector = document.getElementById('selector-compania-actual');
  if (!selector) return;

  try {
    const companias = await llamarApi('/companias');

    if (!companias || companias.length === 0) {
      selector.innerHTML = '<option value="">Sin compañías disponibles</option>';
      return;
    }

    selector.innerHTML = companias.map((c) => '<option value="' + c.id + '">' + c.nombre + '</option>').join('');

    let actual = obtenerCompaniaActualId();
    if (!actual || !companias.some((c) => c.id === actual)) {
      actual = companias[0].id;
      establecerCompaniaActualId(actual);
    }
    selector.value = actual;
    mostrarLogoCompania(companias.find((c) => c.id === actual));

    selector.addEventListener('change', () => {
      establecerCompaniaActualId(selector.value);
      window.location.reload();
    });
  } catch (err) {
    selector.innerHTML = '<option value="">No se pudo cargar</option>';
  }
}

document.addEventListener('DOMContentLoaded', dibujarBarraLateral);

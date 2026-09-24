// Funciones auxiliares compartidas por todos los módulos.

// Muestra un mensaje de éxito o error en la caja de mensajes de la página.
// tipo: 'exito' o 'error'
function mostrarMensaje(texto, tipo) {
  const caja = document.getElementById('caja-mensaje');
  if (!caja) return;
  caja.textContent = texto;
  caja.className = `mensaje visible ${tipo}`;

  // El mensaje de éxito desaparece solo después de unos segundos
  if (tipo === 'exito') {
    setTimeout(() => {
      caja.className = 'mensaje';
    }, 4000);
  }
}

// Formatea una fecha ISO (2026-09-13) a formato legible (13/09/2026)
function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  const [anio, mes, dia] = fechaISO.split('T')[0].split('-');
  return `${dia}/${mes}/${anio}`;
}

// Formatea un número como moneda simple
function formatearMonto(monto) {
  if (monto === null || monto === undefined) return '—';
  return Number(monto).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Envuelve fetch() para manejar errores de red y de la API de forma uniforme.
// Lanza un Error con el mensaje que venga del backend, o uno genérico.
// Clave usada para recordar en este navegador cuál es la "compañía
// actual" (se manda como header en cada petición al backend).
const CLAVE_COMPANIA_ACTUAL = 'compania_actual_id';
const CLAVE_TOKEN_SESION = 'token_sesion';
const CLAVE_USUARIO_SESION = 'usuario_sesion';

function obtenerCompaniaActualId() {
  return localStorage.getItem(CLAVE_COMPANIA_ACTUAL) || '';
}

function establecerCompaniaActualId(id) {
  localStorage.setItem(CLAVE_COMPANIA_ACTUAL, id);
}

function guardarSesion(token, usuario) {
  localStorage.setItem(CLAVE_TOKEN_SESION, token);
  localStorage.setItem(CLAVE_USUARIO_SESION, JSON.stringify(usuario));
}

function obtenerToken() {
  return localStorage.getItem(CLAVE_TOKEN_SESION) || '';
}

function obtenerUsuarioSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_USUARIO_SESION));
  } catch (err) {
    return null;
  }
}

function cerrarSesion() {
  localStorage.removeItem(CLAVE_TOKEN_SESION);
  localStorage.removeItem(CLAVE_USUARIO_SESION);
  window.location.href = 'login.html';
}

// Si no hay sesión guardada, manda directo a la pantalla de login.
// Cada página (menos login.html) debe llamar esto apenas carga.
function exigirSesionEnPagina() {
  if (!obtenerToken()) {
    window.location.href = 'login.html';
  }
}

async function llamarApi(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-compania-id': obtenerCompaniaActualId(),
        'Authorization': 'Bearer ' + obtenerToken(),
      },
      ...opciones,
    });
  } catch (err) {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo "npm run dev"?');
  }

  if (respuesta.status === 401) {
    cerrarSesion(); // la sesión venció o no es válida: manda a login
    throw new Error('Tu sesión venció. Inicia sesión de nuevo.');
  }

  // 204 No Content (ej. DELETE exitoso) no trae cuerpo que parsear
  if (respuesta.status === 204) return null;

  const datos = await respuesta.json().catch(() => null);

  if (respuesta.status === 403 && datos && datos.codigo === 'LICENCIA_VENCIDA') {
    mostrarBloqueoLicenciaVencida(datos.error);
    throw new Error(datos.error);
  }

  if (!respuesta.ok) {
    const mensaje = datos && datos.error ? datos.error : `Error ${respuesta.status}`;
    throw new Error(mensaje);
  }

  return datos;
}

// Cubre toda la pantalla con un aviso fijo cuando la licencia demo de
// la compañía actual venció. Solo el administrador general puede
// seguir usando el sistema en ese estado (el backend ya lo deja
// pasar; para cualquier otro usuario, esta pantalla no se puede
// cerrar salvo cerrando sesión).
function mostrarBloqueoLicenciaVencida(mensaje) {
  if (document.getElementById('bloqueo-licencia-vencida')) return; // ya está mostrado

  const capa = document.createElement('div');
  capa.id = 'bloqueo-licencia-vencida';
  capa.style.cssText = 'position:fixed; inset:0; background:rgba(22,35,61,0.92); z-index:99999; display:flex; align-items:center; justify-content:center; padding:24px;';
  capa.innerHTML =
    '<div style="background:#fff; border-radius:8px; max-width:420px; padding:28px; text-align:center;">' +
    '<h2 style="margin-top:0;">Licencia vencida</h2>' +
    '<p style="color:#5b6b8c;">' + mensaje + '</p>' +
    '<button type="button" id="boton-cerrar-sesion-licencia" class="boton boton-secundario">Cerrar sesión</button>' +
    '</div>';
  document.body.appendChild(capa);
  document.getElementById('boton-cerrar-sesion-licencia').addEventListener('click', cerrarSesion);
}

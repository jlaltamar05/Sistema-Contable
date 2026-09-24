// Middleware: exige que la petición traiga un token de sesión válido
// (header Authorization: Bearer <token>). Si es válido, deja los datos
// del usuario disponibles en req.usuario para los demás middlewares y
// controladores.
//
// De paso, registra la "última actividad" del usuario (para que
// aparezca en Usuarios Conectados, en el Sistema de Licenciamiento)
// — sin frenar la petición ni escribir en la base de datos en cada
// llamada: solo si ya pasó al menos 1 minuto desde el último registro.

const { verificarToken } = require('../utils/tokenUtil');
const supabase = require('../db/supabaseClient');

const ULTIMA_ESCRITURA_POR_USUARIO = new Map();
const INTERVALO_MINIMO_MS = 60 * 1000;

function registrarActividad(usuarioId) {
  const ahora = Date.now();
  const ultima = ULTIMA_ESCRITURA_POR_USUARIO.get(usuarioId) || 0;
  if (ahora - ultima < INTERVALO_MINIMO_MS) return;

  ULTIMA_ESCRITURA_POR_USUARIO.set(usuarioId, ahora);
  supabase
    .from('usuarios')
    .update({ ultima_actividad: new Date().toISOString() })
    .eq('id', usuarioId)
    .then(() => {}, () => {});
}

function exigirSesion(req, res, next) {
  const encabezado = req.header('authorization') || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  const datos = token ? verificarToken(token) : null;

  if (!datos) {
    return res.status(401).json({ error: 'Sesión no válida o vencida. Vuelve a iniciar sesión.' });
  }

  req.usuario = datos;
  if (datos.usuario_id) registrarActividad(datos.usuario_id);
  next();
}

module.exports = exigirSesion;

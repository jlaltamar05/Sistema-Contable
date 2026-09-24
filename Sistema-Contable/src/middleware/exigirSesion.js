// Middleware: exige que la petición traiga un token de sesión válido
// (header Authorization: Bearer <token>). Si es válido, deja los datos
// del usuario disponibles en req.usuario para los demás middlewares y
// controladores.

const { verificarToken } = require('../utils/tokenUtil');

function exigirSesion(req, res, next) {
  const encabezado = req.header('authorization') || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  const datos = token ? verificarToken(token) : null;

  if (!datos) {
    return res.status(401).json({ error: 'Sesión no válida o vencida. Vuelve a iniciar sesión.' });
  }

  req.usuario = datos;
  next();
}

module.exports = exigirSesion;

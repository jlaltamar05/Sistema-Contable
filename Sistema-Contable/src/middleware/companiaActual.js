// Middleware: determina la compañía "actual" de esta petición.
// - Administradores: pueden trabajar en cualquier compañía; se usa la
//   que mande el frontend en el header x-compania-id.
// - Cualquier otro rol: queda forzado a su propia compañía asignada
//   (la que tiene en su usuario), sin importar qué mande el header —
//   así no puede ver datos de otra compañía aunque lo intente.
// Debe ir SIEMPRE después de exigirSesion (necesita req.usuario).

function companiaActual(req, res, next) {
  if (!req.usuario) {
    return res.status(500).json({ error: 'companiaActual debe usarse después de exigirSesion' });
  }

  if (req.usuario.rol === 'administrador') {
    const companiaId = req.header('x-compania-id');
    if (!companiaId) {
      return res.status(400).json({ error: 'Falta seleccionar una compañía (header x-compania-id)' });
    }
    req.companiaId = companiaId;
  } else {
    req.companiaId = req.usuario.compania_id;
  }

  next();
}

module.exports = companiaActual;

// Middleware: exige que el usuario tenga uno de los roles de
// contabilidad indicados. Debe ir después de exigirSesion.
//
// Uso:
//   router.post('/cerrar', exigirRolContable(['administrador', 'jefe_contabilidad', 'contador']), c.cerrarPeriodo);

function exigirRolContable(rolesPermitidos) {
  return function (req, res, next) {
    if (!req.usuario) {
      return res.status(500).json({ error: 'exigirRolContable debe usarse después de exigirSesion' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para hacer esto.' });
    }
    next();
  };
}

module.exports = exigirRolContable;

// Middleware: verifica la licencia de la compañía actual.
// Solo bloquea el caso de una licencia DEMO ya vencida — la licencia
// normal nunca bloquea nada aquí (esa solo limita crear usuarios
// nuevos, en usuarios.controller.js).
//
// El administrador general SIEMPRE pasa, aunque el demo esté vencido
// — así puede entrar a convertir la compañía a licencia normal.
//
// Debe ir después de companiaActual (necesita req.companiaId).

const supabase = require('../db/supabaseClient');

async function verificarLicencia(req, res, next) {
  if (req.usuario.rol === 'administrador') return next();

  const { data: compania } = await supabase
    .from('companias')
    .select('tipo_licencia, fecha_vencimiento_demo')
    .eq('id', req.companiaId)
    .maybeSingle();

  if (!compania) return next(); // no debería pasar; no bloquear por un dato faltante

  if (compania.tipo_licencia === 'demo' && compania.fecha_vencimiento_demo) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (compania.fecha_vencimiento_demo < hoy) {
      return res.status(403).json({
        error: 'La licencia demo de esta compañía venció. Contacta al administrador del sistema para renovarla.',
        codigo: 'LICENCIA_VENCIDA',
      });
    }
  }

  next();
}

module.exports = verificarLicencia;

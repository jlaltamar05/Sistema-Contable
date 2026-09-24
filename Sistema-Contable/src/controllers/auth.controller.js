// Controlador de AUTENTICACIÓN (login) — propio de este sistema, pero
// valida contra la MISMA tabla "usuarios" que usa el Sistema
// Administrativo (comparten base de datos). Un contador entra aquí
// con el mismo usuario/clave que ya tiene allá.

const supabase = require('../db/supabaseClient');
const { verificarPassword } = require('../utils/passwordUtil');
const { generarToken } = require('../utils/tokenUtil');

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email y contraseña son obligatorios' });
  }

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !usuario) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  if (!usuario.activo) {
    return res.status(401).json({ error: 'Este usuario está desactivado' });
  }

  if (!verificarPassword(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];
  if (!ROLES_CONTABLES.includes(usuario.rol)) {
    return res.status(403).json({ error: 'Este usuario no tiene acceso al Sistema Contable.' });
  }

  const token = generarToken({
    usuario_id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    compania_id: usuario.compania_id,
  });

  res.json({
    token: token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      compania_id: usuario.compania_id,
    },
  });
}

module.exports = { login };

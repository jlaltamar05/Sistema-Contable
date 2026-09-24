// Utilidad de contraseñas, usando solo el módulo "crypto" incluido en
// Node.js (sin depender de librerías externas como bcrypt).
// Guarda el resultado como "salt:hash" en hexadecimal.

const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verificarPassword(password, almacenado) {
  if (!almacenado || !almacenado.includes(':')) return false;
  const [salt, hashGuardado] = almacenado.split(':');
  const hashCalculado = crypto.scryptSync(password, salt, 64).toString('hex');
  const bufferGuardado = Buffer.from(hashGuardado, 'hex');
  const bufferCalculado = Buffer.from(hashCalculado, 'hex');
  if (bufferGuardado.length !== bufferCalculado.length) return false;
  return crypto.timingSafeEqual(bufferGuardado, bufferCalculado);
}

module.exports = { hashPassword, verificarPassword };

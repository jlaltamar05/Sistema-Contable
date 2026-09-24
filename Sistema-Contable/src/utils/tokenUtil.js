// Utilidad de tokens de sesión, tipo JWT pero hecha con el módulo
// "crypto" nativo de Node.js (sin depender de la librería jsonwebtoken).
// Formato: base64url(payload JSON) + "." + firma HMAC-SHA256 en hex.

const crypto = require('crypto');

// En un caso real esto debería venir de una variable de entorno.
// Cambia este valor por uno propio y mantenlo en secreto.
const SECRETO = process.env.JWT_SECRETO || 'cambia-este-secreto-en-produccion-919283746';

const SIETE_DIAS_EN_MS = 7 * 24 * 60 * 60 * 1000;

function generarToken(datos) {
  const payload = Object.assign({}, datos, { exp: Date.now() + SIETE_DIAS_EN_MS });
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', SECRETO).update(payloadBase64).digest('hex');
  return payloadBase64 + '.' + firma;
}

function verificarToken(token) {
  if (!token || !token.includes('.')) return null;

  const partes = token.split('.');
  const payloadBase64 = partes[0];
  const firma = partes[1];
  const firmaEsperada = crypto.createHmac('sha256', SECRETO).update(payloadBase64).digest('hex');

  const bufferFirma = Buffer.from(firma, 'hex');
  const bufferEsperada = Buffer.from(firmaEsperada, 'hex');
  if (bufferFirma.length !== bufferEsperada.length || !crypto.timingSafeEqual(bufferFirma, bufferEsperada)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
  } catch (err) {
    return null;
  }

  if (!payload.exp || payload.exp < Date.now()) return null; // token vencido

  return payload;
}

module.exports = { generarToken, verificarToken };

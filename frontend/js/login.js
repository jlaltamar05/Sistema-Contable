// Lógica de la página de login del Sistema Contable.

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const respuesta = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(datos.error || 'No se pudo iniciar sesión.', 'error');
      return;
    }

    guardarSesion(datos.token, datos.usuario);

    if (datos.usuario.rol !== 'administrador') {
      establecerCompaniaActualId(datos.usuario.compania_id);
    } else if (!obtenerCompaniaActualId()) {
      try {
        const companias = await llamarApi('/companias');
        if (companias && companias.length > 0) {
          establecerCompaniaActualId(companias[0].id);
        }
      } catch (err) {
        // si falla, el selector de la barra lateral lo resuelve al cargar
      }
    }

    window.location.href = 'inicio.html';
  } catch (err) {
    mostrarMensaje('No se pudo conectar con el servidor. ¿Está corriendo "npm run dev"?', 'error');
  }
});

document.getElementById('boton-ver-login-password').addEventListener('click', () => {
  const campo = document.getElementById('login-password');
  campo.type = campo.type === 'password' ? 'text' : 'password';
});

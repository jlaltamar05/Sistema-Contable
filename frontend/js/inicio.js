async function cargarInicio() {
  const usuario = obtenerUsuarioSesion();
  document.getElementById('inicio-bienvenida').textContent = usuario ? 'Bienvenido, ' + usuario.nombre : '';

  try {
    const compania = await llamarApi('/companias/' + obtenerCompaniaActualId());
    document.getElementById('inicio-nombre-compania').textContent = compania.nombre || 'Sistema Contable';
    if (compania.logo_url) {
      const logo = document.getElementById('inicio-logo');
      logo.src = compania.logo_url;
      logo.style.display = 'block';
    }
  } catch (err) {
    document.getElementById('inicio-nombre-compania').textContent = 'Sistema Contable';
  }
}

cargarInicio();

# Sistema Contable

Sistema **separado** del Sistema Administrativo — su propio servidor,
su propio repositorio, su propio despliegue en Render. Ambos
comparten la **misma base de datos de Supabase**: no hay ninguna
llamada entre los dos servidores, la base de datos es el único punto
de conexión.

## Puesta en marcha en tu computadora

1. `npm install`
2. Copia `.env.example` como `.env` y pon ahí la MISMA `SUPABASE_KEY`
   (la service_role key) que ya usa el Sistema Administrativo.
3. `npm run dev` — corre por defecto en el puerto 3001 (el
   Administrativo usa el 3000, así que pueden correr los dos a la vez
   en tu compu sin chocar).
4. Abre `http://localhost:3001` en el navegador.

## Quién puede entrar

Solo usuarios con rol `administrador`, `jefe_contabilidad` o
`contador` — el login rechaza cualquier otro rol (vendedor, cobrador,
etc.), aunque la contraseña sea correcta.

## Publicarlo (igual que el Administrativo, pero como servicio nuevo)

1. Sube esta carpeta a un repositorio de GitHub **nuevo y distinto**
   al del Administrativo (ej. `Sistema-Contable`).
2. En Render: "New" > "Web Service", conecta ese repositorio nuevo.
3. Build Command: `npm install` — Start Command: `node src/server.js`
4. Plan: Free.
5. Environment Variables: agrega `SUPABASE_URL` y `SUPABASE_KEY`
   (las mismas del Administrativo) y `PORT=3001` (Render igual asigna
   su propio puerto real automáticamente, pero no está de más
   dejarlo).
6. Deploy. Te va a dar una URL nueva y distinta a la del
   Administrativo (ej. `sistema-contable-xxxx.onrender.com`).

## Qué NO tiene este sistema (a propósito)

- No administra Clientes, Proveedores, Facturas, Compras, Inventario,
  Bancos, Taller, ni Usuarios/Compañías — todo eso sigue siendo del
  Sistema Administrativo.
- Solo puede **leer** compañías (para el selector), no crear/editarlas.

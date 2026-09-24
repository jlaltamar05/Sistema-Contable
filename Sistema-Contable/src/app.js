// Configuración central de la app Express del SISTEMA CONTABLE.
// Sistema aparte del Administrativo (su propio servidor, su propio
// repositorio) — comparten la misma base de datos de Supabase.

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const companiasRoutes = require('./routes/companias.routes');
const cuentasContablesRoutes = require('./routes/cuentasContables.routes');
const centrosCostoRoutes = require('./routes/centrosCosto.routes');
const configuracionContableRoutes = require('./routes/configuracionContable.routes');
const asientosRoutes = require('./routes/asientos.routes');
const periodosContablesRoutes = require('./routes/periodosContables.routes');
const reportesContablesRoutes = require('./routes/reportesContables.routes');

const exigirSesion = require('./middleware/exigirSesion');
const companiaActual = require('./middleware/companiaActual');

const app = express();

app.use(cors());
app.use(express.json());

// Sirve las pantallas del frontend por HTTP real.
app.use(express.static(path.join(__dirname, '../frontend')));

// No hay index.html — la dirección principal manda directo al login.
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Login: la única ruta pública, sin sesión (es la que la crea)
app.use('/auth', authRoutes);

// A partir de aquí, toda ruta requiere sesión iniciada
app.use(exigirSesion);

// A partir de aquí, toda ruta requiere que se sepa la compañía actual
app.use(companiaActual);

app.use('/companias', companiasRoutes);
app.use('/cuentas-contables', cuentasContablesRoutes);
app.use('/centros-costo', centrosCostoRoutes);
app.use('/configuracion-contable', configuracionContableRoutes);
app.use('/asientos', asientosRoutes);
app.use('/periodos-contables', periodosContablesRoutes);
app.use('/reportes-contables', reportesContablesRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

module.exports = app;

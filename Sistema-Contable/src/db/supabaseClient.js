// Conexión centralizada a Supabase — es la MISMA base de datos que usa
// el Sistema Administrativo (se comparten .env con las mismas
// SUPABASE_URL / SUPABASE_KEY). Este sistema es un servidor aparte,
// pero ambos leen y escriben en las mismas tablas.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env. Usa las mismas del Sistema Administrativo.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

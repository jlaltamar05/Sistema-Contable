-- ============================================================
-- Preferencias de impresión por tipo de reporte contable.
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

create table if not exists preferencias_impresion (
  compania_id uuid not null references companias(id),
  tipo_reporte text not null check (tipo_reporte in ('libro_diario', 'balance_comprobacion', 'estado_resultados', 'balance_general')),
  orientacion text not null default 'horizontal' check (orientacion in ('vertical', 'horizontal')),
  incluir_logo boolean not null default true,
  primary key (compania_id, tipo_reporte)
);

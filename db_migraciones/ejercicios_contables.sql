-- ============================================================
-- Ejercicio Contable: el año fiscal, con apertura (saldos
-- iniciales) y cierre (traslada la utilidad/pérdida a Patrimonio).
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

create table if not exists ejercicios_contables (
  id uuid primary key default gen_random_uuid(),
  compania_id uuid not null references companias(id),
  anio integer not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  asiento_apertura_id uuid references asientos_contables(id) on delete set null,
  asiento_cierre_id uuid references asientos_contables(id) on delete set null,
  cerrado_por uuid references usuarios(id) on delete set null,
  cerrado_en timestamptz,
  created_at timestamptz not null default now(),
  unique (compania_id, anio)
);

-- Cuenta de Patrimonio donde cae la utilidad/pérdida al cerrar el
-- ejercicio — se configura una vez por compañía y el cierre la usa
-- siempre (Configuración Contable).
alter table configuracion_contable add column if not exists cuenta_utilidad_ejercicio_id uuid references cuentas_contables(id) on delete set null;

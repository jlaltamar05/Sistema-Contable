-- ============================================================
-- Constructor de Informes — versión Contabilidad.
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

create table if not exists informes_contables_definidos (
  id uuid primary key default gen_random_uuid(),
  compania_id uuid not null references companias(id),
  nombre text not null,
  fuente text not null,
  columnas text[] not null,
  orden_por text,
  orden_direccion text not null default 'asc',
  creado_por uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_informes_contables_compania on informes_contables_definidos(compania_id);

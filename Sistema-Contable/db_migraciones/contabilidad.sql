-- ============================================================
-- MÓDULO DE CONTABILIDAD — integración completa.
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

-- ---------- 1. Plan de Cuentas (por compañía) ----------

create table if not exists cuentas_contables (
  id uuid primary key default gen_random_uuid(),
  compania_id uuid not null references companias(id),
  codigo text not null,
  nombre text not null,
  tipo text not null check (tipo in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo')),
  cuenta_padre_id uuid references cuentas_contables(id) on delete set null,
  -- Solo las cuentas de detalle (acepta_movimiento = true) pueden recibir
  -- líneas de asiento; las que son "título"/agrupadoras se dejan en false.
  acepta_movimiento boolean not null default true,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (compania_id, codigo)
);

create index if not exists idx_cuentas_contables_compania on cuentas_contables(compania_id);

-- ---------- 2. Centros de Costo (por compañía) ----------
-- Tabla lista desde ya; todavía no se usa en el motor de asientos
-- (queda para una segunda vuelta), por eso asientos_detalle ya trae
-- su columna pero puede quedar vacía por ahora.

create table if not exists centros_costo (
  id uuid primary key default gen_random_uuid(),
  compania_id uuid not null references companias(id),
  codigo text not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (compania_id, codigo)
);

-- ---------- 3. Vinculación con los maestros que ya existen ----------

alter table clientes add column if not exists cuenta_contable_cxc_id uuid references cuentas_contables(id) on delete set null;
alter table proveedores add column if not exists cuenta_contable_cxp_id uuid references cuentas_contables(id) on delete set null;
alter table articulos add column if not exists cuenta_contable_inventario_id uuid references cuentas_contables(id) on delete set null;
alter table articulos add column if not exists cuenta_contable_costo_id uuid references cuentas_contables(id) on delete set null;
alter table articulos add column if not exists cuenta_contable_ingreso_id uuid references cuentas_contables(id) on delete set null;
alter table cuentas_bancarias add column if not exists cuenta_contable_id uuid references cuentas_contables(id) on delete set null;

-- ---------- 4. Configuración contable por compañía ----------
-- Cuentas "por defecto": si un cliente/proveedor/artículo/cuenta
-- bancaria no tiene su propia cuenta contable asignada, se usa la
-- genérica de aquí — así no hace falta configurar todo antes de
-- poder facturar el primer documento.

create table if not exists configuracion_contable (
  compania_id uuid primary key references companias(id),
  modo_contabilizacion text not null default 'manual'
    check (modo_contabilizacion in ('automatico', 'manual', 'proceso')),
  cuenta_cxc_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_cxp_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_iva_ventas_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_iva_compras_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_inventario_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_costo_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_ingreso_defecto_id uuid references cuentas_contables(id) on delete set null,
  cuenta_banco_defecto_id uuid references cuentas_contables(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- 5. Asientos contables (encabezado + detalle) ----------

create table if not exists asientos_contables (
  id uuid primary key default gen_random_uuid(),
  compania_id uuid not null references companias(id),
  numero_asiento text not null,
  fecha date not null,
  descripcion text,
  -- De qué documento administrativo salió este asiento (si vino de uno).
  documento_origen_tipo text,   -- 'factura' | 'compra' | 'cobro' | 'pago' | 'nota_credito' | null (manual)
  documento_origen_id uuid,
  -- 'pendiente' | 'contabilizado'
  estado text not null default 'pendiente' check (estado in ('pendiente', 'contabilizado')),
  -- Si este asiento es el reverso de otro (corrección de uno ya
  -- contabilizado), aquí queda el rastro hacia el original.
  asiento_reverso_de_id uuid references asientos_contables(id) on delete set null,
  creado_por uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  contabilizado_por uuid references usuarios(id) on delete set null,
  contabilizado_en timestamptz,
  unique (compania_id, numero_asiento)
);

create index if not exists idx_asientos_compania_fecha on asientos_contables(compania_id, fecha);
create index if not exists idx_asientos_documento_origen on asientos_contables(documento_origen_tipo, documento_origen_id);
create index if not exists idx_asientos_estado on asientos_contables(compania_id, estado);

create table if not exists asientos_detalle (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references asientos_contables(id) on delete cascade,
  cuenta_contable_id uuid not null references cuentas_contables(id),
  -- Sin usar todavía (segunda vuelta) — ya queda lista la columna.
  centro_costo_id uuid references centros_costo(id) on delete set null,
  debito numeric(14,2) not null default 0,
  credito numeric(14,2) not null default 0,
  descripcion text,
  constraint chk_debito_o_credito check (debito = 0 or credito = 0)
);

create index if not exists idx_asientos_detalle_asiento on asientos_detalle(asiento_id);
create index if not exists idx_asientos_detalle_cuenta on asientos_detalle(cuenta_contable_id);

-- ---------- 6. Períodos contables (cierre / reapertura) ----------

create table if not exists periodos_contables (
  id uuid primary key default gen_random_uuid(),
  compania_id uuid not null references companias(id),
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_por uuid references usuarios(id) on delete set null,
  cerrado_en timestamptz,
  reabierto_por uuid references usuarios(id) on delete set null,
  reabierto_en timestamptz,
  unique (compania_id, anio, mes)
);

-- ---------- 7. Permisos: nuevos roles de contabilidad ----------
-- Este sistema maneja permisos con un solo campo "rol" en usuarios
-- (no booleanos granulares). Se agregan dos roles nuevos:
--   'contador'          -> gestiona el plan de cuentas, asigna cuentas,
--                          contabiliza asientos, ve reportes.
--   'jefe_contabilidad' -> todo lo anterior, más reabrir períodos
--                          cerrados (el único que puede, junto al
--                          'administrador' general).
-- No hace falta ningún ALTER aquí: "rol" ya es texto libre, así que
-- estos valores nuevos ya se pueden usar en cuanto crees el usuario.

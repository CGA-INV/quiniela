-- =====================================================================
-- Tabla activity_log: bitácora de acciones administrativas.
-- Solo el super admin puede leer/borrar. Cualquier admin (super o de
-- sala) puede insertar sus propias acciones — los server actions lo
-- usan para dejar constancia automáticamente.
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_idx
  on public.activity_log(created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists "activity_log_super_select" on public.activity_log;
create policy "activity_log_super_select" on public.activity_log
  for select to authenticated using (public.is_admin());

drop policy if exists "activity_log_super_delete" on public.activity_log;
create policy "activity_log_super_delete" on public.activity_log
  for delete to authenticated using (public.is_admin());

-- Cualquier admin puede insertar su propia acción (para que quede registro).
drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert to authenticated with check (
    actor_id = auth.uid()
    and (public.is_admin() or public.is_any_pool_admin())
  );

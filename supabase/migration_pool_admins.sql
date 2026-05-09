-- =====================================================================
-- Rol "admin de sala": un usuario que el super admin promueve dentro
-- de una sala específica. Puede:
--   - Generar códigos de invitación PARA ESA SALA
--   - Cerrar partidos (set result + finished=true) — solo en partidos
--     no finalizados todavía
-- NO puede reabrir, eliminar partidos, ni cambiar resultados ya cerrados.
-- Solo el super admin (montagudev@gmail.com) puede hacer todo eso.
--
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- 1. Columna en pool_members
alter table public.pool_members
  add column if not exists is_admin boolean not null default false;

-- 2. Helpers
create or replace function public.is_pool_admin(p_pool uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pool_members
    where pool_id = p_pool
      and user_id = auth.uid()
      and is_admin = true
  );
$$;

create or replace function public.is_any_pool_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pool_members
    where user_id = auth.uid()
      and is_admin = true
  );
$$;

-- 3. RLS: invitations — super admin OR pool admin de la sala
drop policy if exists "invitations_admin_all" on public.invitations;
drop policy if exists "invitations_select" on public.invitations;
drop policy if exists "invitations_insert" on public.invitations;
drop policy if exists "invitations_update" on public.invitations;
drop policy if exists "invitations_delete" on public.invitations;

create policy "invitations_select" on public.invitations
  for select to authenticated using (
    public.is_admin() or public.is_pool_admin(pool_id)
  );

create policy "invitations_insert" on public.invitations
  for insert to authenticated with check (
    public.is_admin() or public.is_pool_admin(pool_id)
  );

create policy "invitations_delete" on public.invitations
  for delete to authenticated using (
    public.is_admin() or public.is_pool_admin(pool_id)
  );

-- 4. RLS: matches UPDATE — super admin (cualquier cosa) o pool admin
--    pero solo si el partido NO está finalizado todavía.
drop policy if exists "matches_update_admin" on public.matches;
create policy "matches_update_admin" on public.matches
  for update to authenticated using (
    public.is_admin()
    or (public.is_any_pool_admin() and matches.finished = false)
  );

-- 5. RLS: pool_members UPDATE — solo super admin (para promover/demover)
drop policy if exists "pool_members_admin_update" on public.pool_members;
create policy "pool_members_admin_update" on public.pool_members
  for update to authenticated using (public.is_admin());

-- =====================================================================
-- Permite que cualquier admin (super o pool) cree salas y agregue
-- miembros existentes directamente (sin pasar por invitación).
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- 1. Pools INSERT: super admin O cualquier pool admin (de cualquier sala)
drop policy if exists "pools_insert_admin" on public.pools;
create policy "pools_insert_admin" on public.pools
  for insert to authenticated with check (
    public.is_admin() or public.is_any_pool_admin()
  );

-- 2. Pools UPDATE/DELETE: super admin O pool admin de esa sala
drop policy if exists "pools_update_admin" on public.pools;
create policy "pools_update_admin" on public.pools
  for update to authenticated using (
    public.is_admin() or public.is_pool_admin(pools.id)
  );

drop policy if exists "pools_delete_admin" on public.pools;
create policy "pools_delete_admin" on public.pools
  for delete to authenticated using (
    public.is_admin() or public.is_pool_admin(pools.id)
  );

-- 3. pool_members INSERT directo (sin invitación)
--    Permitido si:
--    - el usuario se inserta a sí mismo (caso del invitation flow), O
--    - es super admin, O
--    - es pool admin de esa sala (admin invitando directo)
drop policy if exists "pool_members_admin_insert" on public.pool_members;
create policy "pool_members_admin_insert" on public.pool_members
  for insert to authenticated with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_pool_admin(pool_id)
  );

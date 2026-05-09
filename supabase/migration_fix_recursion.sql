-- =====================================================================
-- Fix: "infinite recursion detected in policy for relation pool_members"
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
--
-- Causa: la policy SELECT de pool_members hacía un EXISTS sobre
-- pool_members, y la policy SELECT de pools también — Postgres no podía
-- evaluar la policy sin volver a aplicarla. Lo resolvemos con una función
-- SECURITY DEFINER que bypassea RLS.
-- =====================================================================

-- Helper: ¿el usuario actual es miembro de esta sala?
create or replace function public.is_pool_member(p_pool uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pool_members
    where pool_id = p_pool and user_id = auth.uid()
  );
$$;

-- pool_members: usa el helper en vez de auto-referenciarse
drop policy if exists "pool_members_select" on public.pool_members;
create policy "pool_members_select" on public.pool_members
  for select to authenticated using (
    public.is_pool_member(pool_id) or public.is_admin()
  );

-- pools: usa el helper
drop policy if exists "pools_select_member" on public.pools;
create policy "pools_select_member" on public.pools
  for select to authenticated using (
    public.is_pool_member(id) or public.is_admin()
  );

-- predictions: misma corrección
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid() or (
      public.is_pool_member(pool_id)
      and exists (
        select 1 from public.matches m
        where m.id = predictions.match_id and m.kickoff_at <= now()
      )
    )
  );

drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_pool_member(pool_id)
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id and m.kickoff_at > now()
    )
  );

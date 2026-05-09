-- =====================================================================
-- Permite al admin gestionar partidos vía la app
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

drop policy if exists "matches_insert_admin" on public.matches;
create policy "matches_insert_admin" on public.matches
  for insert to authenticated with check (public.is_admin());

drop policy if exists "matches_update_admin" on public.matches;
create policy "matches_update_admin" on public.matches
  for update to authenticated using (public.is_admin());

drop policy if exists "matches_delete_admin" on public.matches;
create policy "matches_delete_admin" on public.matches
  for delete to authenticated using (public.is_admin());

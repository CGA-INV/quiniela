-- =====================================================================
-- Cierre ÚNICO de predicciones para toda la quiniela:
--   martes 10 de junio de 2026, 4:00 PM hora de Venezuela (UTC-4)
--   = 2026-06-10 20:00:00+00 (UTC)
--
-- Antes el cierre era por partido (1h antes del kickoff). Ahora es un
-- único deadline global: pasada esa hora no se puede insertar ni editar
-- ninguna predicción, y se ven las de todos.
--
-- IMPORTANTE: el mismo instante vive en lib/time.ts (PREDICTIONS_DEADLINE_ISO).
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_pool_member(pool_id)
    and now() < timestamptz '2026-06-10 20:00:00+00'
  );

drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated using (
    user_id = auth.uid()
    and now() < timestamptz '2026-06-10 20:00:00+00'
  );

-- Las predicciones de todos se ven a partir del cierre global.
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or (public.is_pool_member(pool_id) and now() >= timestamptz '2026-06-10 20:00:00+00')
  );

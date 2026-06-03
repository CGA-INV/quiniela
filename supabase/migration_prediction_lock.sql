-- =====================================================================
-- Cierra las predicciones 1 hora ANTES del kickoff.
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
--
-- IMPORTANTE: la constante de minutos también vive en
-- lib/time.ts (PREDICTION_LOCK_MINUTES). Si la cambias acá, cámbiala
-- en el JS también para que la UI coincida con el guardia de BD.
-- =====================================================================

drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_pool_member(pool_id)
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.kickoff_at > now() + interval '1 hour'
    )
  );

drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.kickoff_at > now() + interval '1 hour'
    )
  );

-- Las predicciones de otros se ven desde que cierra el plazo (no esperar al kickoff).
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.is_pool_member(pool_id)
      and exists (
        select 1 from public.matches m
        where m.id = predictions.match_id
          and m.kickoff_at - interval '1 hour' <= now()
      )
    )
  );

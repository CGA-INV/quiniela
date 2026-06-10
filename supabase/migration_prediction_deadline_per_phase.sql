-- =====================================================================
-- Cierre de predicciones POR FASE (reemplaza el cierre único global).
--
--   - Fase de grupos: cierre fijo el martes 10 de junio de 2026,
--     4:00 PM hora de Venezuela (UTC-4) = 2026-06-10 20:00:00+00 (UTC).
--   - Cada fase eliminatoria (round_of_32, round_of_16, quarter, semi,
--     third_place, final): cierra cuando ARRANCA la fase = kickoff del
--     primer partido de esa fase. Hasta entonces se puede insertar,
--     editar y BORRAR la predicción.
--
-- Además: se habilita el BORRADO de predicciones propias mientras la fase
-- siga abierta (deja la predicción "sin definir").
--
-- IMPORTANTE: el cierre de grupos (2026-06-10 20:00:00+00) también vive en
-- lib/time.ts (PREDICTIONS_DEADLINE_ISO). Manténlos en sync.
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- ¿La fase del partido p_match_id sigue abierta para predecir?
--   grupos      -> antes del cierre fijo
--   eliminatoria-> antes del primer kickoff de esa fase (mismo set de pool)
create or replace function public.prediction_phase_open(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.stage = 'group'
      then now() < timestamptz '2026-06-10 20:00:00+00'
    else now() < coalesce((
      select min(m2.kickoff_at)
      from public.matches m2
      where m2.stage = m.stage
        and m2.pool_id is not distinct from m.pool_id
    ), timestamptz '2026-06-10 20:00:00+00')
  end
  from public.matches m
  where m.id = p_match_id;
$$;

-- INSERT: solo el dueño, miembro de la sala, y con la fase abierta.
drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_pool_member(pool_id)
    and public.prediction_phase_open(match_id)
  );

-- UPDATE: solo el dueño, y con la fase abierta.
drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated using (
    user_id = auth.uid()
    and public.prediction_phase_open(match_id)
  );

-- DELETE: borrar la predicción propia mientras la fase siga abierta.
drop policy if exists "predictions_delete_own_before_lock" on public.predictions;
create policy "predictions_delete_own_before_lock" on public.predictions
  for delete to authenticated using (
    user_id = auth.uid()
    and public.prediction_phase_open(match_id)
  );

-- SELECT: las predicciones de otros se ven cuando cierra la fase del partido.
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.is_pool_member(pool_id)
      and not public.prediction_phase_open(match_id)
    )
  );

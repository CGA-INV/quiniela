-- =====================================================================
-- Agrega estadio, ciudad y número de partido a matches.
-- Permite al admin leer TODAS las predicciones (para los conteos).
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists city text;
alter table public.matches add column if not exists match_no int;

-- Cada número de partido es único (1..104) — pero permitimos NULL.
create unique index if not exists matches_match_no_unique
  on public.matches(match_no) where match_no is not null;

-- Admin puede ver predicciones de cualquier partido/sala (para reportes)
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.is_pool_member(pool_id)
      and exists (
        select 1 from public.matches m
        where m.id = predictions.match_id and m.kickoff_at <= now()
      )
    )
  );

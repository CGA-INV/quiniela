-- =====================================================================
-- Nueva tabla de puntos:
--   5 → marcador exacto
--   3 → acertaste quién gana (no era empate)
--   2 → predijiste empate y empató (pero no el marcador exacto)
--   0 → fallo
--
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

create or replace function public.calc_points(
  ph int, pa int, rh int, ra int
) returns int
language sql immutable as $$
  select case
    when rh is null or ra is null then 0
    -- Marcador exacto
    when ph = rh and pa = ra then 5
    -- Predijo empate y empató (pero no fue exacto, eso ya lo capturó arriba)
    when ph = pa and rh = ra then 2
    -- Acertó el ganador (mismo signo de diferencia, no es empate)
    when sign(ph - pa) = sign(rh - ra) then 3
    else 0
  end;
$$;

-- Recalcula TODAS las predicciones de partidos finalizados con la nueva regla.
update public.predictions p
   set points = public.calc_points(p.pred_home, p.pred_away, m.home_score, m.away_score),
       updated_at = now()
  from public.matches m
 where p.match_id = m.id
   and m.finished = true
   and m.home_score is not null
   and m.away_score is not null;

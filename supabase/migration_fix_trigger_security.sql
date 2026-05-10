-- =====================================================================
-- Fix: el trigger que recalcula puntos al cerrar un partido NO tenía
-- SECURITY DEFINER, entonces se ejecutaba con los permisos del admin
-- que cierra el partido. La RLS de predictions UPDATE solo permite
-- actualizar predicciones propias y antes del kickoff — así que el
-- trigger fallaba silenciosamente y los puntos quedaban en 0 para
-- todos los demás usuarios (y para el admin después del cierre).
--
-- Con SECURITY DEFINER, el trigger se ejecuta con privilegios del
-- creador de la función (postgres), que bypassea RLS.
--
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
--
-- IMPORTANTE: después de correrla, vuelve a "cerrar" cada partido que
-- ya hayas marcado como finalizado para que el trigger los recalcule:
--   UPDATE public.matches SET updated_at = now() WHERE finished = true;
-- (esto NO dispara el trigger porque la condición checkea cambio de
-- score/finished. Mejor: en /admin/matches reabre y vuelve a cerrar).
-- =====================================================================

create or replace function public.recalc_predictions_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finished and (old.finished is distinct from new.finished
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score) then
    update public.predictions
      set points = public.calc_points(pred_home, pred_away, new.home_score, new.away_score),
          updated_at = now()
      where match_id = new.id;
  end if;
  return new;
end;
$$;

-- También recreamos calc_points por si quedó desactualizada (no cambia,
-- pero asegura que existe y es immutable para el trigger).
create or replace function public.calc_points(
  ph int, pa int, rh int, ra int
) returns int
language sql immutable as $$
  select case
    when rh is null or ra is null then 0
    when ph = rh and pa = ra then 3
    when sign(ph - pa) = sign(rh - ra) then 1
    else 0
  end;
$$;

-- =====================================================================
-- Recálculo manual: corre los puntos de TODAS las predicciones de
-- partidos finalizados. Útil para arreglar la data histórica que quedó
-- en 0 por el bug.
-- =====================================================================
update public.predictions p
   set points = public.calc_points(p.pred_home, p.pred_away, m.home_score, m.away_score),
       updated_at = now()
  from public.matches m
 where p.match_id = m.id
   and m.finished = true
   and m.home_score is not null
   and m.away_score is not null;

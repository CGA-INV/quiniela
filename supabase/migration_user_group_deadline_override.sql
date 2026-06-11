-- =====================================================================
-- Override de cierre de grupos POR USUARIO (excepción individual).
--
-- profiles.group_deadline_override: si está puesto, EXTIENDE el cierre de
-- grupos de ese usuario (nunca lo acorta). El cierre efectivo de grupos para
-- un usuario es el MAYOR entre: el cierre de su sala (o el global) y su
-- override personal. Solo afecta a la fase de grupos.
--
-- Pegar en Supabase SQL Editor -> Run. Idempotente (salvo el paso 3, que
-- reinicia la ventana de 2h cada vez que se corre).
-- =====================================================================

-- 1) Columna de override por usuario.
alter table public.profiles add column if not exists group_deadline_override timestamptz;

-- 2) prediction_phase_open: grupos = MAX(cierre de la sala, override del usuario).
create or replace function public.prediction_phase_open(p_match_id uuid, p_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.stage = 'group'
      then now() < greatest(
        coalesce(
          (select group_deadline from public.pools where id = p_pool_id),
          timestamptz '2026-06-11 03:59:00+00'
        ),
        coalesce(
          (select group_deadline_override from public.profiles where id = auth.uid()),
          timestamptz '-infinity'
        )
      )
    else now() < coalesce((
      select min(m2.kickoff_at)
      from public.matches m2
      where m2.stage = m.stage
        and m2.pool_id is not distinct from m.pool_id
    ), timestamptz '2026-06-11 03:59:00+00')
  end
  from public.matches m
  where m.id = p_match_id;
$$;

-- 3) Excepción: 2 horas EXTRA para cargar grupos, desde el momento de correr esto.
--    abarrios.cga@gmail.com (Alex barrios) y dmartinez1705oca@gmail.com (Daniel Martinez).
update public.profiles
  set group_deadline_override = now() + interval '2 hours'
  where id in (
    '869a5dfb-56f2-4a1e-94a7-456e3e5dd5d8',
    '5d423ea8-ab4f-429c-bd1e-40e21f7b4e41'
  );

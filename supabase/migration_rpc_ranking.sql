-- =====================================================================
-- RPC pool_ranking: agrega stats por usuario en server-side (Postgres),
-- en una sola query. Mucho más rápido que traer todas las predicciones
-- y agregar en JS — escala bien aunque haya cientos de usuarios y miles
-- de predicciones.
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

create or replace function public.pool_ranking(p_pool uuid)
returns table (
  user_id uuid,
  display_name text,
  is_admin boolean,
  total int,
  exactos int,
  ganador int,
  empate int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Solo super admin o miembros pueden ver el ranking
  if not (public.is_admin() or public.is_pool_member(p_pool)) then
    raise exception 'Acceso denegado';
  end if;

  return query
  select
    pm.user_id,
    p.display_name,
    pm.is_admin,
    coalesce(sum(pred.points), 0)::int                                as total,
    coalesce(sum(case when pred.points = 5 then 1 else 0 end), 0)::int as exactos,
    coalesce(sum(case when pred.points = 3 then 1 else 0 end), 0)::int as ganador,
    coalesce(sum(case when pred.points = 2 then 1 else 0 end), 0)::int as empate
  from public.pool_members pm
  join public.profiles p on p.id = pm.user_id
  left join public.predictions pred
    on pred.user_id = pm.user_id and pred.pool_id = pm.pool_id
  where pm.pool_id = p_pool
  group by pm.user_id, p.display_name, pm.is_admin
  order by total desc, exactos desc, p.display_name asc;
end;
$$;

grant execute on function public.pool_ranking(uuid) to authenticated;

-- =====================================================================
-- Indexes para queries calientes. Mejora dramática cuando crece la data.
-- Pegar en Supabase SQL Editor -> Run. Idempotente (CREATE IF NOT EXISTS).
-- =====================================================================

-- predictions: la query más común es WHERE pool_id = X AND user_id = Y
-- (las propias predicciones del usuario). Composite acelera mucho.
create index if not exists predictions_user_pool_idx
  on public.predictions(user_id, pool_id);

-- predictions por pool (para ranking agregado)
-- (predictions_pool_idx ya existe — verificamos por las dudas)
create index if not exists predictions_pool_idx
  on public.predictions(pool_id);

-- matches por stage (winner detection: WHERE stage = 'group')
create index if not exists matches_stage_idx
  on public.matches(stage);

-- matches por (stage, pool_id) — winner sandbox vs global
create index if not exists matches_stage_pool_idx
  on public.matches(stage, pool_id);

-- pool_members: getAdminContext busca WHERE user_id = X AND is_admin = true
-- Index parcial es perfecto porque la mayoría tiene is_admin = false.
create index if not exists pool_members_user_admin_partial_idx
  on public.pool_members(user_id) where is_admin = true;

-- profiles: el dropdown "agregar miembro existente" ordena por display_name
create index if not exists profiles_display_name_idx
  on public.profiles(display_name);

-- invitations: filtro por pool_id (el dashboard admin lo usa con IN)
create index if not exists invitations_pool_id_idx
  on public.invitations(pool_id);

-- activity_log ya tiene index por created_at desc. Buen estado.

-- ANALYZE para que el planner conozca las estadísticas nuevas inmediatamente
analyze public.predictions;
analyze public.matches;
analyze public.pool_members;
analyze public.profiles;
analyze public.invitations;

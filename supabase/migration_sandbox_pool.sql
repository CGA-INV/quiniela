-- =====================================================================
-- Sandbox: una sala marcada is_sandbox=true tiene su PROPIO calendario
-- de partidos. matches.pool_id NULL = partido global (compartido por
-- todas las salas reales). pool_id=X = partido visible solo en sala X.
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

alter table public.pools
  add column if not exists is_sandbox boolean not null default false;

alter table public.matches
  add column if not exists pool_id uuid references public.pools(id) on delete cascade;

create index if not exists matches_pool_id_idx on public.matches(pool_id);

-- Sandbox pools también contienen información identificable por nombre.
-- Útil para que aparezca distinto en la UI.

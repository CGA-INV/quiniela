-- =====================================================================
-- Fix: el upsert necesita unique constraint regular, no índice parcial.
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- Quita el índice parcial viejo
drop index if exists public.matches_match_no_unique;

-- Agrega constraint unique normal (permite varios NULL, único en no-NULL)
alter table public.matches drop constraint if exists matches_match_no_key;
alter table public.matches add constraint matches_match_no_key unique (match_no);

-- Refresca el cache de PostgREST por las dudas
notify pgrst, 'reload schema';

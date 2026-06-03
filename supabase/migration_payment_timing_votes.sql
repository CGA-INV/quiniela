-- Encuesta: ¿se paga ANTES o DESPUÉS de saber el ganador?
-- Un voto por miembro de la sala.

create table if not exists public.pool_payment_votes (
  pool_id    uuid        not null references public.pools(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)   on delete cascade,
  timing     text        not null check (timing in ('antes', 'despues')),
  created_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

alter table public.pool_payment_votes enable row level security;

drop policy if exists "ver pagovotos de mi sala" on public.pool_payment_votes;
create policy "ver pagovotos de mi sala" on public.pool_payment_votes
  for select using (
    exists (select 1 from public.pool_members pm
      where pm.pool_id = pool_payment_votes.pool_id and pm.user_id = auth.uid())
  );

drop policy if exists "votar pago en mi sala" on public.pool_payment_votes;
create policy "votar pago en mi sala" on public.pool_payment_votes
  for insert with check (
    user_id = auth.uid() and
    exists (select 1 from public.pool_members pm
      where pm.pool_id = pool_payment_votes.pool_id and pm.user_id = auth.uid())
  );

drop policy if exists "cambiar mi pagovoto" on public.pool_payment_votes;
create policy "cambiar mi pagovoto" on public.pool_payment_votes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

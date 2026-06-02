-- Encuesta de precio de la quiniela (fase de grupos).
-- Cada miembro de la sala vota 3, 4 o 5 USD. Gana el más votado.

create table if not exists public.pool_price_votes (
  pool_id    uuid        not null references public.pools(id)     on delete cascade,
  user_id    uuid        not null references auth.users(id)       on delete cascade,
  price      smallint    not null check (price in (3, 4, 5)),
  created_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

alter table public.pool_price_votes enable row level security;

-- Ver los votos de las salas a las que pertenezco.
drop policy if exists "ver votos de mi sala" on public.pool_price_votes;
create policy "ver votos de mi sala" on public.pool_price_votes
  for select using (
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pool_price_votes.pool_id and pm.user_id = auth.uid()
    )
  );

-- Insertar mi propio voto si soy miembro de la sala.
drop policy if exists "votar en mi sala" on public.pool_price_votes;
create policy "votar en mi sala" on public.pool_price_votes
  for insert with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pool_price_votes.pool_id and pm.user_id = auth.uid()
    )
  );

-- Cambiar mi propio voto.
drop policy if exists "cambiar mi voto" on public.pool_price_votes;
create policy "cambiar mi voto" on public.pool_price_votes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

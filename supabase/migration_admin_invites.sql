-- =====================================================================
-- Migración: admin único + invitaciones one-time
-- Pegar TODO en Supabase SQL Editor -> Run
-- Idempotente: se puede correr varias veces sin romper nada.
-- =====================================================================

-- 1. Helper: ¿el usuario actual es el admin global?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((auth.jwt()->>'email')::text, '') = 'montagudev@gmail.com';
$$;

-- 2. Reemplazar policies de pools: solo admin puede crear/editar/borrar
drop policy if exists "pools_insert_owner" on public.pools;
drop policy if exists "pools_update_owner" on public.pools;
drop policy if exists "pools_delete_owner" on public.pools;

create policy "pools_insert_admin" on public.pools
  for insert to authenticated with check (public.is_admin());

create policy "pools_update_admin" on public.pools
  for update to authenticated using (public.is_admin());

create policy "pools_delete_admin" on public.pools
  for delete to authenticated using (public.is_admin());

-- 3. Función vieja de "unirse con código abierto" ya no aplica
drop function if exists public.join_pool_by_code(text);

-- 4. Tabla de invitaciones (one-time, expiran en 7 días)
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  email text not null,
  code text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations(lower(email));
create index if not exists invitations_pool_idx on public.invitations(pool_id);

alter table public.invitations enable row level security;

drop policy if exists "invitations_admin_all" on public.invitations;
create policy "invitations_admin_all" on public.invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. Función para canjear una invitación (security definer = bypassea RLS)
create or replace function public.redeem_invitation(code text)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  inv public.invitations%rowtype;
  user_email text;
begin
  user_email := lower(coalesce((auth.jwt()->>'email')::text, ''));
  if user_email = '' then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select * into inv
    from public.invitations
   where invitations.code = upper(trim(redeem_invitation.code))
   for update;

  if not found then
    raise exception 'Código de invitación no encontrado';
  end if;
  if inv.used_at is not null then
    raise exception 'Esta invitación ya fue usada';
  end if;
  if inv.expires_at < now() then
    raise exception 'Esta invitación expiró';
  end if;
  if lower(inv.email) <> user_email then
    raise exception 'Esta invitación es para otro correo';
  end if;

  insert into public.pool_members (pool_id, user_id)
    values (inv.pool_id, auth.uid())
    on conflict do nothing;

  update public.invitations
    set used_by = auth.uid(), used_at = now()
    where id = inv.id;

  return inv.pool_id;
end;
$$;

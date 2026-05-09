-- =====================================================================
-- Migración: códigos de invitación abiertos (sin envío de correo)
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- 1. El email del invitado ya no es obligatorio (admin solo genera el código)
alter table public.invitations alter column email drop not null;

-- 2. redeem_invitation: ya no valida email (cualquier usuario logueado puede canjear)
create or replace function public.redeem_invitation(code text)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  inv public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select * into inv
    from public.invitations
   where invitations.code = upper(trim(redeem_invitation.code))
   for update;

  if not found then
    raise exception 'Código de invitación inválido';
  end if;
  if inv.used_at is not null then
    raise exception 'Esta invitación ya fue usada';
  end if;
  if inv.expires_at < now() then
    raise exception 'Esta invitación expiró';
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

-- 3. peek_invitation: validar código ANTES de crear cuenta (sin consumirlo)
create or replace function public.peek_invitation(code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.invitations
    where invitations.code = upper(trim(peek_invitation.code))
      and used_at is null
      and expires_at >= now()
  );
$$;

-- Anon (usuarios no logueados) necesita poder llamar a peek durante el signup.
grant execute on function public.peek_invitation(text) to anon, authenticated;

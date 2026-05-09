-- =====================================================================
-- Permite borrar usuarios completamente sin romper la data:
--  - invitations.invited_by → cascade (se borran las invitaciones que mandó)
--  - pools.owner_id → nullable + set null (la sala se conserva, queda sin owner)
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- Las invitaciones que el usuario haya generado se borran junto con él.
alter table public.invitations
  drop constraint if exists invitations_invited_by_fkey;
alter table public.invitations
  add constraint invitations_invited_by_fkey
  foreign key (invited_by)
  references public.profiles(id)
  on delete cascade;

-- Las salas que el usuario haya creado se MANTIENEN (con owner_id null).
-- Los miembros y partidos siguen ahí, otro admin puede tomarlas.
alter table public.pools
  alter column owner_id drop not null;
alter table public.pools
  drop constraint if exists pools_owner_id_fkey;
alter table public.pools
  add constraint pools_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete set null;

-- pool_members.user_id, predictions.user_id, payments.payer_id/payee_id,
-- activity_log.actor_id ya tienen ON DELETE CASCADE.

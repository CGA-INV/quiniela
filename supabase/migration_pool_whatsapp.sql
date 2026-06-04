-- Link del grupo de WhatsApp por sala.
alter table public.pools add column if not exists whatsapp_url text;

-- Permite a super admin o al admin de la sala actualizar la sala (p. ej. el link).
drop policy if exists "pools_update_admin" on public.pools;
create policy "pools_update_admin" on public.pools
  for update to authenticated using (
    public.is_admin() or exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pools.id and pm.user_id = auth.uid() and pm.is_admin
    )
  );

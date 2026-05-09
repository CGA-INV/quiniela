-- =====================================================================
-- Sistema de pagos: cuando termina la fase de grupos, los perdedores
-- pagan al ganador. Cada perdedor sube comprobante; ganador valida.
--
-- Pegar TODO en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- 1. Tabla payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete cascade,
  payee_id uuid not null references public.profiles(id) on delete cascade,
  proof_url text not null,
  proof_path text not null,
  uploaded_at timestamptz not null default now(),
  validated_at timestamptz,
  notes text,
  unique (pool_id, payer_id)
);

create index if not exists payments_pool_idx on public.payments(pool_id);
create index if not exists payments_payee_idx on public.payments(payee_id);

alter table public.payments enable row level security;

-- SELECT: el payer ve su propio, el payee ve los que recibe, super admin todos
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select to authenticated using (
    payer_id = auth.uid()
    or payee_id = auth.uid()
    or public.is_admin()
  );

-- INSERT: solo el propio usuario subiendo su pago en una sala donde es miembro
drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments
  for insert to authenticated with check (
    payer_id = auth.uid()
    and public.is_pool_member(pool_id)
  );

-- UPDATE: el payer puede re-subir (cambia proof_url); el payee puede validar
drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments
  for update to authenticated using (
    payer_id = auth.uid()
    or payee_id = auth.uid()
    or public.is_admin()
  );

-- DELETE: el propio payer (re-subir) o super admin
drop policy if exists "payments_delete" on public.payments;
create policy "payments_delete" on public.payments
  for delete to authenticated using (
    payer_id = auth.uid() or public.is_admin()
  );

-- =====================================================================
-- 2. Storage bucket para los comprobantes
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = true;

-- Políticas de storage:
-- INSERT: usuario autenticado solo puede subir a path {pool_id}/{su_uid}/...
drop policy if exists "payment_proofs_insert" on storage.objects;
create policy "payment_proofs_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- UPDATE para upsert de re-uploads:
drop policy if exists "payment_proofs_update" on storage.objects;
create policy "payment_proofs_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- DELETE: solo el dueño del archivo
drop policy if exists "payment_proofs_delete" on storage.objects;
create policy "payment_proofs_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- SELECT: bucket público, no necesita policy (cualquiera con la URL ve la imagen).
-- Las URLs incluyen UUIDs random así que son imposibles de adivinar.

-- =====================================================================
-- Crea el usuario admin manualmente.
-- Pegar TODO en Supabase SQL Editor -> Run.
-- Ya queda confirmado y listo para hacer login.
--
-- Cambia v_password por la contraseña que quieras usar.
-- =====================================================================

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'montagudev@gmail.com';
  v_password text := 'admin123';   -- <-- cámbiala si quieres
begin
  -- Limpia cualquier usuario previo con ese correo (por si quedó a medias).
  delete from auth.users where lower(email) = lower(v_email);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated', 'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', 'Admin'),
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  raise notice 'Usuario % creado con id %', v_email, v_user_id;
end $$;

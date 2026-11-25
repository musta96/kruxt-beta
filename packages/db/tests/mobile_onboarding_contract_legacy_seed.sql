set request.jwt.claims = '{"role":"service_role"}';

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles(id, username, display_name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice_lifts', 'Alice Lifts'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob_trains', 'Bob Trains'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'legacy_lifter', 'Legacy Lifter');

insert into public.policy_version_tracking(
  id,
  policy_type,
  version,
  label,
  document_url,
  checksum,
  effective_at,
  is_active
)
values
  ('11111111-1111-4111-8111-111111111111', 'terms', '1.0', 'Terms', 'https://example.test/terms-v1', repeat('a', 64), now() - interval '1 day', true),
  ('22222222-2222-4222-8222-222222222222', 'privacy', '1.0', 'Privacy', 'https://example.test/privacy-v1', repeat('b', 64), now() - interval '1 day', true),
  ('33333333-3333-4333-8333-333333333333', 'health_data', '1.0', 'Health', 'https://example.test/health-v1', repeat('c', 64), now() - interval '1 day', true);

insert into public.consents(user_id, consent_type, policy_version_id, granted, source)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'terms', '11111111-1111-4111-8111-111111111111', true, 'legacy-cutover-test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'privacy', '22222222-2222-4222-8222-222222222222', true, 'legacy-cutover-test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'health_data_processing', '33333333-3333-4333-8333-333333333333', true, 'legacy-cutover-test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'marketing_email', '22222222-2222-4222-8222-222222222222', true, 'legacy-cutover-test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'push_notifications', '22222222-2222-4222-8222-222222222222', true, 'legacy-cutover-test');

reset request.jwt.claims;

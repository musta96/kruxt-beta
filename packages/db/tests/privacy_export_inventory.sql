begin;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into auth.users(id, email) values
  ('7d000000-0000-4000-8000-000000000001', 'inventory-one@example.test'),
  ('7d000000-0000-4000-8000-000000000002', 'inventory-two@example.test');
insert into public.profiles(id, username, display_name) values
  ('7d000000-0000-4000-8000-000000000001', 'inventory_one', 'Inventory One'),
  ('7d000000-0000-4000-8000-000000000002', 'inventory_two', 'Inventory Two');
insert into public.support_tickets(id, reporter_user_id, reporter_email, subject, description, metadata) values
  ('7d000000-0000-4000-8000-000000000010', '7d000000-0000-4000-8000-000000000001',
   'inventory-one@example.test', 'Subject ticket', 'Subject description', '{"secret":"internal-ticket-marker"}'),
  ('7d000000-0000-4000-8000-000000000020', '7d000000-0000-4000-8000-000000000002',
   'inventory-two@example.test', 'Other ticket', 'Unrelated marker', '{}');
insert into public.support_ticket_messages(ticket_id, actor_type, body, is_internal, metadata) values
  ('7d000000-0000-4000-8000-000000000010', 'user', 'Subject public message', false, '{"secret":"internal-message-marker"}'),
  ('7d000000-0000-4000-8000-000000000010', 'user', 'Hidden internal note', true, '{}'),
  ('7d000000-0000-4000-8000-000000000020', 'user', 'Other tenant message', false, '{}');

insert into public.privacy_requests(id, user_id, request_type, status) values
  ('7d000000-0000-4000-8000-000000000030', '7d000000-0000-4000-8000-000000000001', 'export', 'fulfilled'),
  ('7d000000-0000-4000-8000-000000000031', '7d000000-0000-4000-8000-000000000001', 'export', 'fulfilled'),
  ('7d000000-0000-4000-8000-000000000032', '7d000000-0000-4000-8000-000000000002', 'export', 'fulfilled');
insert into public.privacy_export_jobs(privacy_request_id, user_id, status, storage_bucket, storage_path, signed_url_expires_at) values
  ('7d000000-0000-4000-8000-000000000030', '7d000000-0000-4000-8000-000000000001', 'succeeded', 'privacy-exports', 'subject/live.json', now() + interval '1 hour'),
  ('7d000000-0000-4000-8000-000000000031', '7d000000-0000-4000-8000-000000000001', 'succeeded', 'privacy-exports', 'subject/expired.json', now() - interval '1 hour'),
  ('7d000000-0000-4000-8000-000000000032', '7d000000-0000-4000-8000-000000000002', 'succeeded', 'privacy-exports', 'other/live.json', now() + interval '1 hour');
insert into storage.objects(bucket_id, name) values
  ('privacy-exports', 'subject/live.json'), ('privacy-exports', 'subject/expired.json'),
  ('privacy-exports', 'other/live.json'), ('privacy-exports', 'subject/untracked.json');
grant select on storage.objects to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7d000000-0000-4000-8000-000000000001', true);
do $$
declare payload jsonb;
begin
  payload := public.build_privacy_export_payload();
  if jsonb_array_length(payload->'support_tickets') <> 1
    or jsonb_array_length(payload->'support_ticket_messages') <> 1
    or payload->'support_ticket_messages'->0->>'body' <> 'Subject public message' then
    raise exception 'Support export inventory mismatch';
  end if;
  if payload::text like '%Hidden internal note%'
    or payload::text like '%Other tenant message%'
    or payload::text like '%internal-ticket-marker%'
    or payload::text like '%internal-message-marker%' then
    raise exception 'Support export leaked unrelated or internal content';
  end if;
  begin
    perform public.build_privacy_export_payload('7d000000-0000-4000-8000-000000000002');
    raise exception 'Cross-subject export unexpectedly permitted';
  exception when raise_exception then
    if sqlerrm <> 'Cannot export data for another user' then raise; end if;
  end;
  if has_function_privilege('authenticated', 'public.build_privacy_export_payload_legacy(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.log_workout_atomic_legacy(jsonb,jsonb)', 'EXECUTE') then
    raise exception 'Unrestricted legacy builder or workout RPC remains callable';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'privacy-exports') <> 1
    or not exists(select 1 from storage.objects where name = 'subject/live.json') then
    raise exception 'Export Storage policy exposed expired, untracked, or cross-subject packages';
  end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.profiles where id in (
      '7d000000-0000-4000-8000-000000000001', '7d000000-0000-4000-8000-000000000002') and is_public) then
    raise exception 'New profiles are public by default';
  end if;
end $$;
rollback;

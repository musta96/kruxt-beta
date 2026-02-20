create or replace function public.reject_mutation_immutable_table()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table % is immutable; append-only writes only', tg_table_name;
end;
$$;

drop trigger if exists trg_policy_version_tracking_immutable on public.policy_version_tracking;
create trigger trg_policy_version_tracking_immutable
before update or delete on public.policy_version_tracking
for each row execute function public.reject_mutation_immutable_table();

drop trigger if exists trg_consents_set_updated_at on public.consents;

drop trigger if exists trg_consents_immutable on public.consents;
create trigger trg_consents_immutable
before update or delete on public.consents
for each row execute function public.reject_mutation_immutable_table();

drop policy if exists policy_versions_manage_service on public.policy_version_tracking;
drop policy if exists policy_versions_insert_service on public.policy_version_tracking;

create policy policy_versions_insert_service
on public.policy_version_tracking for insert to authenticated
with check (public.is_service_role());

drop policy if exists consents_insert_self on public.consents;
drop policy if exists consents_update_self_or_service on public.consents;
drop policy if exists consents_insert_service_only on public.consents;

create policy consents_insert_self_or_service
on public.consents for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- Disposable SQL contract only. This is not a deployable migration.
do $$ begin
  if current_setting('kruxt.disposable_private_proof_contract', true) is distinct from 'on' then
    raise exception 'Disposable private proof contract opt-in required';
  end if;
  if not exists (select 1 from storage.buckets where id = 'workout-proof-media' and public = false) then
    raise exception 'Expected existing private proof bucket';
  end if;
end $$;

create schema private_proof_contract;
revoke all on schema private_proof_contract from public, anon, authenticated, service_role;

create function private_proof_contract.path_matches(_owner uuid, _workout uuid, _path text)
returns boolean language sql immutable set search_path = '' as $$
  select array_length(string_to_array(_path, '/'), 1) = 4
    and split_part(_path, '/', 1) = _owner::text
    and split_part(_path, '/', 2) = _workout::text
    and split_part(_path, '/', 3) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(_path, '/', 4) ~ '^[a-z0-9._-]+$'
    and split_part(_path, '/', 4) not in ('.', '..');
$$;

create function private_proof_contract.owns_path(_workout uuid, _path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and private_proof_contract.path_matches(auth.uid(), _workout, _path)
    and exists (select 1 from public.workouts w where w.id = _workout and w.user_id = auth.uid());
$$;

create function private_proof_contract.owns_object(_workout uuid, _path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private_proof_contract.owns_path(_workout, _path)
    and exists (select 1 from storage.objects o where o.bucket_id = 'workout-proof-media'
      and o.name = _path and o.owner_id = auth.uid()::text);
$$;

-- Definer lookups avoid circular Storage/metadata RLS. No caller-supplied actor.
create function private_proof_contract.is_registered(_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and split_part(_path, '/', 1) = auth.uid()::text and exists (
    select 1 from public.workout_proof_media m where m.storage_bucket = 'workout-proof-media'
      and m.storage_path = _path);
$$;

create function private_proof_contract.valid_metadata(_workout uuid, _uploader uuid, _bucket text, _path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.workouts w
    join storage.objects o on o.bucket_id = _bucket and o.name = _path
      and o.owner_id = _uploader::text
    where w.id = _workout and w.user_id = _uploader and _bucket = 'workout-proof-media'
      and private_proof_contract.path_matches(_uploader, _workout, _path)
      and public.can_view_workout_proof_media(_workout, auth.uid()));
$$;

create function private_proof_contract.visible_binding(_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.workout_proof_media m
    where m.storage_path = _path and private_proof_contract.valid_metadata(
      m.workout_id, m.uploader_user_id, m.storage_bucket, m.storage_path));
$$;

create function private_proof_contract.immutable_registration()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.id, new.workout_id, new.uploader_user_id, new.storage_bucket, new.storage_path, new.sort_order)
    is distinct from
     (old.id, old.workout_id, old.uploader_user_id, old.storage_bucket, old.storage_path, old.sort_order) then
    raise exception using errcode = '42501', message = 'Attachment registration identity is immutable';
  end if;
  return new;
end $$;

-- Serialize registration against orphan deletion using the actual object row.
create function private_proof_contract.lock_registration_object()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '42501', message = 'Attachment registration requires read committed isolation';
  end if;
  if new.uploader_user_id is distinct from auth.uid()
    or not coalesce(private_proof_contract.owns_path(new.workout_id, new.storage_path), false) then
    raise exception using errcode = '42501', message = 'Invalid attachment owner or path';
  end if;
  perform 1 from storage.objects o where o.bucket_id = new.storage_bucket
    and o.bucket_id = 'workout-proof-media' and o.name = new.storage_path
    and o.owner_id = auth.uid()::text for update;
  if not found then
    raise exception using errcode = '42501', message = 'An owned attachment object is required';
  end if;
  return new;
end $$;

create function private_proof_contract.guard_object_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.bucket_id <> 'workout-proof-media' then return old; end if;
  -- A fixed transaction snapshot could miss a registration committed during the lock wait.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '42501', message = 'Attachment deletion requires read committed isolation';
  end if;
  if exists (
    select 1 from public.workout_proof_media m
    where m.storage_bucket = old.bucket_id and m.storage_path = old.name
  ) then
    raise exception using errcode = '42501', message = 'Registered attachment objects cannot be deleted';
  end if;
  return old;
end $$;

revoke all on all functions in schema private_proof_contract from public, anon, authenticated, service_role;
-- Stored policy expressions can execute their resolved functions without exposing the schema.
grant execute on function private_proof_contract.owns_path(uuid,text),
  private_proof_contract.owns_object(uuid,text), private_proof_contract.is_registered(text),
  private_proof_contract.visible_binding(text),
  private_proof_contract.valid_metadata(uuid,uuid,text,text) to authenticated;

create trigger private_proof_immutable_registration before update on public.workout_proof_media
for each row execute function private_proof_contract.immutable_registration();
create trigger private_proof_lock_registration_object before insert on public.workout_proof_media
for each row execute function private_proof_contract.lock_registration_object();
create trigger private_proof_guard_object_delete before delete on storage.objects
for each row execute function private_proof_contract.guard_object_delete();

create policy private_proof_bound_insert on public.workout_proof_media as restrictive
for insert to authenticated with check (
  uploader_user_id = auth.uid() and storage_bucket = 'workout-proof-media'
  and private_proof_contract.owns_object(workout_id, storage_path));
create policy private_proof_valid_metadata_select on public.workout_proof_media as restrictive
for select to authenticated using (private_proof_contract.valid_metadata(
  workout_id, uploader_user_id, storage_bucket, storage_path));
create policy private_proof_owned_update on public.workout_proof_media as restrictive
for update to authenticated using (uploader_user_id = auth.uid() and exists (
  select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
with check (uploader_user_id = auth.uid() and exists (
  select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- A text comparison avoids casting malformed path segments to UUIDs.
create policy private_proof_bound_object_insert on storage.objects as restrictive
for insert to authenticated with check (bucket_id <> 'workout-proof-media' or (
  owner_id = auth.uid()::text and exists (select 1 from public.workouts w
    where w.id::text = split_part(name, '/', 2)
      and private_proof_contract.owns_path(w.id, name))));

-- Updates are deliberately not part of the proof protocol, even before registration.
create policy private_proof_no_object_update on storage.objects as restrictive
for update to authenticated using (bucket_id <> 'workout-proof-media')
with check (bucket_id <> 'workout-proof-media');

create policy private_proof_valid_object_select on storage.objects as restrictive
for select to authenticated using (bucket_id <> 'workout-proof-media'
  or private_proof_contract.visible_binding(name)
  or (owner_id = auth.uid()::text and split_part(name, '/', 1) = auth.uid()::text
    and not private_proof_contract.is_registered(name)));

create policy private_proof_orphan_delete on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'workout-proof-media' or (
  owner_id = auth.uid()::text and split_part(name, '/', 1) = auth.uid()::text
  and not private_proof_contract.is_registered(name)));

-- DELETE needs SELECT visibility. Own orphan visibility grants no other actor access.
create policy private_proof_own_orphan_select on storage.objects
for select to authenticated using (bucket_id = 'workout-proof-media'
  and owner_id = auth.uid()::text and split_part(name, '/', 1) = auth.uid()::text
  and not private_proof_contract.is_registered(name));

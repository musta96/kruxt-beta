-- Guard storage policy UUID casts for malformed object paths.

drop policy if exists gym_brand_assets_insert on storage.objects;
create policy gym_brand_assets_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gym-brand-assets'
  and array_length(storage.foldername(name), 1) >= 1
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (
        public.can_manage_gym_config(((storage.foldername(name))[1])::uuid, auth.uid())
        or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
      )
    else false
  end
);

drop policy if exists gym_brand_assets_update on storage.objects;
create policy gym_brand_assets_update
on storage.objects for update to authenticated
using (
  bucket_id = 'gym-brand-assets'
  and array_length(storage.foldername(name), 1) >= 1
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (
        public.can_manage_gym_config(((storage.foldername(name))[1])::uuid, auth.uid())
        or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
      )
    else false
  end
)
with check (
  bucket_id = 'gym-brand-assets'
  and array_length(storage.foldername(name), 1) >= 1
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (
        public.can_manage_gym_config(((storage.foldername(name))[1])::uuid, auth.uid())
        or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
      )
    else false
  end
);

drop policy if exists gym_brand_assets_delete on storage.objects;
create policy gym_brand_assets_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'gym-brand-assets'
  and array_length(storage.foldername(name), 1) >= 1
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (
        public.can_manage_gym_config(((storage.foldername(name))[1])::uuid, auth.uid())
        or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
      )
    else false
  end
);

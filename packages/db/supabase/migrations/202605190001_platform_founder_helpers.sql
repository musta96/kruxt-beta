-- Helper functions used by platform workspace policies.

create or replace function public.is_platform_founder(_viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_operator_accounts poa
    where poa.user_id = _viewer
      and poa.role = 'founder'
      and poa.is_active = true
  );
$$;

create or replace function public.has_gym_staff_access(_gym_id uuid, _viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_founder(_viewer)
      or public.is_gym_staff(_gym_id, _viewer);
$$;

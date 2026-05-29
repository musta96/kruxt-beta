-- Let KRUXT platform operators inspect tenant workspaces without being added
-- as fake gym members. Operational actions still depend on the existing
-- support access grant/session policies.

drop policy if exists gyms_select_public_or_member on public.gyms;
create policy gyms_select_public_or_member
on public.gyms for select to authenticated
using (
  is_public
  or public.is_gym_member(id, auth.uid())
  or public.is_platform_founder(auth.uid())
  or public.platform_operator_has_permission('platform.overview.read', auth.uid())
);

drop policy if exists gym_brand_settings_select on public.gym_brand_settings;
create policy gym_brand_settings_select
on public.gym_brand_settings for select to authenticated
using (
  public.can_view_gym(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.overview.read', auth.uid())
);

drop policy if exists gym_membership_plans_select_visible on public.gym_membership_plans;
create policy gym_membership_plans_select_visible
on public.gym_membership_plans for select to authenticated
using (
  public.can_view_gym(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.overview.read', auth.uid())
);

drop policy if exists gym_memberships_founder_select on public.gym_memberships;
create policy gym_memberships_founder_select
on public.gym_memberships for select to authenticated
using (
  public.is_platform_founder(auth.uid())
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

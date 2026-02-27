-- =====================================================
-- FOUNDER-LEVEL POLICIES: gyms (global read/write for founders)
-- =====================================================

drop policy if exists gyms_select_public_or_member on public.gyms;
create policy gyms_select_public_or_member
on public.gyms for select to authenticated
using (
  is_public
  or public.is_gym_member(id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gyms_insert_owner_self on public.gyms;
create policy gyms_insert_owner_self
on public.gyms for insert to authenticated
with check (
  owner_user_id = auth.uid()
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gyms_update_staff_or_owner on public.gyms;
create policy gyms_update_staff_or_owner
on public.gyms for update to authenticated
using (
  public.is_gym_staff(id, auth.uid())
  or owner_user_id = auth.uid()
  or public.is_platform_founder(auth.uid())
)
with check (
  public.is_gym_staff(id, auth.uid())
  or owner_user_id = auth.uid()
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gyms_delete_owner on public.gyms;
create policy gyms_delete_owner
on public.gyms for delete to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_platform_founder(auth.uid())
);

-- =====================================================
-- FOUNDER-LEVEL POLICIES: gym_platform_subscriptions
-- =====================================================

drop policy if exists gym_platform_subscriptions_manage on public.gym_platform_subscriptions;
create policy gym_platform_subscriptions_manage
on public.gym_platform_subscriptions for all to authenticated
using (
  public.is_service_role()
  or public.is_platform_founder(auth.uid())
)
with check (
  public.is_service_role()
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gym_platform_subscriptions_select on public.gym_platform_subscriptions;
create policy gym_platform_subscriptions_select
on public.gym_platform_subscriptions for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

-- =====================================================
-- FOUNDER-LEVEL POLICIES: invoice_compliance_profiles
-- =====================================================

drop policy if exists invoice_compliance_profiles_select on public.invoice_compliance_profiles;
create policy invoice_compliance_profiles_select
on public.invoice_compliance_profiles for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

drop policy if exists invoice_compliance_profiles_manage on public.invoice_compliance_profiles;
create policy invoice_compliance_profiles_manage
on public.invoice_compliance_profiles for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

-- =====================================================
-- FOUNDER-LEVEL POLICIES: gym_memberships
-- =====================================================

drop policy if exists gym_memberships_insert_self_or_staff on public.gym_memberships;
create policy gym_memberships_insert_self_or_staff
on public.gym_memberships for insert to authenticated
with check (
  user_id = auth.uid()
  or public.is_gym_staff(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gym_memberships_founder_select on public.gym_memberships;
create policy gym_memberships_founder_select
on public.gym_memberships for select to authenticated
using (public.is_platform_founder(auth.uid()));

drop policy if exists gym_memberships_founder_insert on public.gym_memberships;
create policy gym_memberships_founder_insert
on public.gym_memberships for insert to authenticated
with check (public.is_platform_founder(auth.uid()));

drop policy if exists gym_memberships_founder_update on public.gym_memberships;
create policy gym_memberships_founder_update
on public.gym_memberships for update to authenticated
using (public.is_platform_founder(auth.uid()))
with check (public.is_platform_founder(auth.uid()));

drop policy if exists gym_memberships_founder_delete on public.gym_memberships;
create policy gym_memberships_founder_delete
on public.gym_memberships for delete to authenticated
using (public.is_platform_founder(auth.uid()));
create policy dunning_events_manage_service_or_staff
on public.dunning_events for all to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = dunning_events.subscription_id
      and public.is_gym_staff(ms.gym_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = dunning_events.subscription_id
      and public.is_gym_staff(ms.gym_id, auth.uid())
  )
);

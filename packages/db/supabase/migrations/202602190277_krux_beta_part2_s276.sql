create policy dunning_events_select_self_or_staff
on public.dunning_events for select to authenticated
using (
  exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = dunning_events.subscription_id
      and (ms.user_id = auth.uid() or public.is_gym_staff(ms.gym_id, auth.uid()))
  )
);

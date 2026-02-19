-- =====================================================
-- DEFAULT NOTIFICATION PREFERENCES ON PROFILE CREATE
-- =====================================================

create or replace function public.seed_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

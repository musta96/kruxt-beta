create policy notification_preferences_self
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

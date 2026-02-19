create policy push_notification_tokens_self
on public.push_notification_tokens for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy social_interactions_update_self
on public.social_interactions for update to authenticated
using (actor_user_id = auth.uid())
with check (actor_user_id = auth.uid());

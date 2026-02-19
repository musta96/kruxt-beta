create policy social_interactions_delete_self
on public.social_interactions for delete to authenticated
using (actor_user_id = auth.uid());

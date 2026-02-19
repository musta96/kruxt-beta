create policy feed_events_insert_owner_or_service
on public.feed_events for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

create policy leaderboard_entries_manage_service
on public.leaderboard_entries for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

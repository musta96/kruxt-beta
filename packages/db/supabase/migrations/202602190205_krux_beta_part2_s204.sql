create policy leaderboard_entries_select_all
on public.leaderboard_entries for select to authenticated
using (true);

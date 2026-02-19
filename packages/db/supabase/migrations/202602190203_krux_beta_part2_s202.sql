create policy leaderboards_select_all
on public.leaderboards for select to authenticated
using (true);

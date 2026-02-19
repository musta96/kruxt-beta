create policy feature_flags_select
on public.feature_flags for select to authenticated
using (true);

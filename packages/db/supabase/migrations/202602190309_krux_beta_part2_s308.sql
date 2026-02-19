create policy user_reports_insert_reporter
on public.user_reports for insert to authenticated
with check (reporter_user_id = auth.uid());

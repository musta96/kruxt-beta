create trigger trg_user_reports_set_updated_at before update on public.user_reports
for each row execute function public.set_updated_at();

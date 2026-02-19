create trigger trg_audit_logs_no_update
before update or delete on public.audit_logs
for each row execute function public.prevent_mutation();

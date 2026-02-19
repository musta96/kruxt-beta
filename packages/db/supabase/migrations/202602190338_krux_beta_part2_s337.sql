create trigger trg_webhook_events_no_delete
before delete on public.integration_webhook_events
for each row execute function public.prevent_mutation();

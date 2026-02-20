alter type public.privacy_request_status add value if not exists 'triaged';
alter type public.privacy_request_status add value if not exists 'in_progress';
alter type public.privacy_request_status add value if not exists 'fulfilled';

alter table public.privacy_requests
  add column if not exists triaged_at timestamptz,
  add column if not exists in_progress_at timestamptz,
  add column if not exists sla_breached_at timestamptz;

create index if not exists idx_privacy_requests_status_due
  on public.privacy_requests(status, due_at);

alter table public.policy_version_tracking
  add column if not exists published_at timestamptz not null default now(),
  add column if not exists change_summary text,
  add column if not exists requires_reconsent boolean not null default true,
  add column if not exists supersedes_policy_version_id uuid references public.policy_version_tracking(id) on delete set null;

update public.policy_version_tracking
set published_at = coalesce(published_at, created_at)
where published_at is null;

create index if not exists idx_policy_version_type_effective
  on public.policy_version_tracking(policy_type, effective_at desc, created_at desc);

-- Draft/publish workflow for gym public pages. Drafts are private to gym
-- operators and KRUXT platform operators; consumers keep reading published
-- gym_brand_settings and active plans only.

insert into public.platform_permission_catalog (permission_key, category, label, description, is_sensitive)
values (
  'platform.gyms.manage',
  'platform',
  'Tenant Gym Manage',
  'Manage tenant gym admin surfaces, branding, and public-page publishing.',
  true
)
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  is_active = true;

insert into public.platform_role_permissions (role, permission_key, is_allowed)
values
  ('founder'::public.platform_operator_role, 'platform.gyms.manage', true),
  ('ops_admin'::public.platform_operator_role, 'platform.gyms.manage', true)
on conflict (role, permission_key) do update
set is_allowed = excluded.is_allowed;

create table if not exists public.gym_public_page_drafts (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'published')),
  brand_settings jsonb not null default '{}'::jsonb,
  visible_membership_plan_ids uuid[] not null default '{}'::uuid[],
  schedule_visible boolean not null default true,
  checks jsonb not null default '[]'::jsonb,
  last_previewed_at timestamptz,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gym_public_page_drafts_updated_at
  on public.gym_public_page_drafts(updated_at desc);

drop trigger if exists trg_gym_public_page_drafts_set_updated_at on public.gym_public_page_drafts;
create trigger trg_gym_public_page_drafts_set_updated_at
before update on public.gym_public_page_drafts
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.gym_public_page_drafts to authenticated;
grant select, insert, update, delete on public.gym_public_page_drafts to service_role;

alter table public.gym_public_page_drafts enable row level security;

drop policy if exists gym_public_page_drafts_select on public.gym_public_page_drafts;
create policy gym_public_page_drafts_select
on public.gym_public_page_drafts for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
);

drop policy if exists gym_public_page_drafts_manage on public.gym_public_page_drafts;
create policy gym_public_page_drafts_manage
on public.gym_public_page_drafts for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
);

drop policy if exists gym_brand_settings_manage on public.gym_brand_settings;
create policy gym_brand_settings_manage
on public.gym_brand_settings for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.gyms.manage', auth.uid())
);

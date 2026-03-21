create table if not exists public.user_workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  workout_type public.workout_type not null default 'strength',
  source text not null default 'manual',
  template_days jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_workout_templates_user_id
  on public.user_workout_templates (user_id, created_at desc);

drop trigger if exists trg_user_workout_templates_set_updated_at on public.user_workout_templates;
create trigger trg_user_workout_templates_set_updated_at
before update on public.user_workout_templates
for each row execute function public.set_updated_at();

alter table public.user_workout_templates enable row level security;

drop policy if exists user_workout_templates_select_owner on public.user_workout_templates;
create policy user_workout_templates_select_owner
on public.user_workout_templates for select to authenticated
using (user_id = auth.uid());

drop policy if exists user_workout_templates_insert_owner on public.user_workout_templates;
create policy user_workout_templates_insert_owner
on public.user_workout_templates for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists user_workout_templates_update_owner on public.user_workout_templates;
create policy user_workout_templates_update_owner
on public.user_workout_templates for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_workout_templates_delete_owner on public.user_workout_templates;
create policy user_workout_templates_delete_owner
on public.user_workout_templates for delete to authenticated
using (user_id = auth.uid());

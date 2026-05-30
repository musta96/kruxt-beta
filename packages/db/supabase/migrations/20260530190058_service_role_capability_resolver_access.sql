create or replace function public.platform_get_gym_capabilities(
  p_gym_id uuid
)
returns table (
  capability_key text,
  category text,
  sort_order integer,
  label text,
  description text,
  value_type text,
  effective_bool boolean,
  effective_limit integer,
  source text,
  global_bool_default boolean,
  global_limit_default integer,
  template_key text,
  template_name text,
  template_bool_value boolean,
  template_limit_value integer,
  override_bool_value boolean,
  override_limit_value integer,
  override_reason text,
  override_updated_at timestamptz,
  is_billing_sensitive boolean,
  metadata jsonb,
  impact_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_template_key text;
  v_template_name text;
begin
  if p_gym_id is null or not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  if not (
    public.is_service_role()
    or public.platform_operator_has_permission('platform.flags.view', v_actor)
    or public.platform_operator_has_permission('platform.flags.tenant_override', v_actor)
    or public.platform_operator_has_permission('platform.entitlements.templates.manage', v_actor)
    or public.is_gym_staff(p_gym_id, v_actor)
  ) then
    raise exception 'Capability view access is required';
  end if;

  select gta.template_key, pet.name
  into v_template_key, v_template_name
  from public.gym_entitlement_template_assignments gta
  join public.platform_entitlement_templates pet on pet.template_key = gta.template_key
  where gta.gym_id = p_gym_id
  limit 1;

  if v_template_key is null then
    select pp.entitlement_template_key, pet.name
    into v_template_key, v_template_name
    from public.gym_platform_subscriptions gps
    join public.platform_plans pp on pp.id = gps.platform_plan_id
    left join public.platform_entitlement_templates pet on pet.template_key = pp.entitlement_template_key
    where gps.gym_id = p_gym_id
      and gps.status in ('trialing', 'active', 'past_due', 'unpaid')
      and pp.entitlement_template_key is not null
    order by gps.created_at desc
    limit 1;
  end if;

  return query
  select
    c.capability_key,
    c.category,
    c.sort_order,
    c.label,
    c.description,
    c.value_type,
    case
      when c.value_type = 'boolean' then coalesce(go.bool_value, ptc.bool_value, c.global_bool_default)
      else null
    end as effective_bool,
    case
      when c.value_type = 'limit' then coalesce(go.limit_value, ptc.limit_value, c.global_limit_default)
      else null
    end as effective_limit,
    case
      when go.capability_key is not null then 'override'
      when ptc.capability_key is not null then 'plan'
      else 'global'
    end as source,
    c.global_bool_default,
    c.global_limit_default,
    v_template_key,
    v_template_name,
    ptc.bool_value,
    ptc.limit_value,
    go.bool_value,
    go.limit_value,
    go.reason,
    go.updated_at,
    c.is_billing_sensitive,
    c.metadata,
    public.platform_get_capability_impact_count(p_gym_id, c.capability_key) as impact_count
  from public.platform_capability_catalog c
  left join public.platform_entitlement_template_capabilities ptc
    on ptc.template_key = v_template_key
   and ptc.capability_key = c.capability_key
  left join public.gym_capability_overrides go
    on go.gym_id = p_gym_id
   and go.capability_key = c.capability_key
  order by c.category, c.sort_order, c.capability_key;
end;
$$;

revoke all on function public.platform_get_gym_capabilities(uuid) from public;
grant execute on function public.platform_get_gym_capabilities(uuid) to authenticated;
grant execute on function public.platform_get_gym_capabilities(uuid) to service_role;

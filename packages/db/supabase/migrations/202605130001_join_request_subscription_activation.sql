-- Create manual subscription and invoice records when staff approve a plan-backed join request.

create or replace function public.review_gym_join_request(
  p_request_id uuid,
  p_next_status text,
  p_staff_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.gym_join_requests%rowtype;
  v_plan public.gym_membership_plans%rowtype;
  v_membership_id uuid;
  v_subscription_id uuid;
  v_invoice_id uuid;
  v_subscription_status public.subscription_status;
  v_period_end timestamptz;
  v_trial_ends_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_next_status not in ('approved', 'rejected', 'cancelled') then
    raise exception 'Invalid join request status';
  end if;

  select *
  into v_request
  from public.gym_join_requests gjr
  where gjr.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Join request not found';
  end if;

  if not public.is_gym_staff(v_request.gym_id, v_user_id) then
    raise exception 'Gym staff access is required';
  end if;

  insert into public.gym_memberships(
    gym_id,
    user_id,
    role,
    membership_status,
    membership_plan_id,
    started_at
  )
  values (
    v_request.gym_id,
    v_request.user_id,
    'member',
    case when p_next_status = 'approved' then 'active'::public.membership_status else 'cancelled'::public.membership_status end,
    v_request.requested_membership_plan_id,
    case when p_next_status = 'approved' then now() else null end
  )
  on conflict (gym_id, user_id) do update
    set membership_status = case
          when p_next_status = 'approved' then 'active'::public.membership_status
          when public.gym_memberships.membership_status = 'pending' then 'cancelled'::public.membership_status
          else public.gym_memberships.membership_status
        end,
        membership_plan_id = coalesce(v_request.requested_membership_plan_id, public.gym_memberships.membership_plan_id),
        started_at = case
          when p_next_status = 'approved' then coalesce(public.gym_memberships.started_at, now())
          else public.gym_memberships.started_at
        end
  returning id
  into v_membership_id;

  if p_next_status = 'approved' and v_request.requested_membership_plan_id is not null then
    select *
    into v_plan
    from public.gym_membership_plans gmp
    where gmp.id = v_request.requested_membership_plan_id
      and gmp.gym_id = v_request.gym_id
      and gmp.is_active = true;

    if v_plan.id is null then
      raise exception 'Requested membership plan is no longer available';
    end if;

    v_trial_ends_at := case
      when coalesce(v_plan.trial_days, 0) > 0 then now() + make_interval(days => v_plan.trial_days)
      else null
    end;

    v_subscription_status := case
      when v_trial_ends_at is not null then 'trialing'::public.subscription_status
      else 'active'::public.subscription_status
    end;

    v_period_end := case v_plan.billing_cycle
      when 'monthly' then now() + interval '1 month'
      when 'quarterly' then now() + interval '3 months'
      when 'yearly' then now() + interval '1 year'
      when 'dropin' then null
      else null
    end;

    select ms.id
    into v_subscription_id
    from public.member_subscriptions ms
    where ms.gym_id = v_request.gym_id
      and ms.user_id = v_request.user_id
      and ms.membership_plan_id = v_plan.id
      and ms.status <> 'canceled'
    order by ms.created_at desc
    limit 1
    for update;

    if v_subscription_id is null then
      insert into public.member_subscriptions(
        gym_id,
        user_id,
        membership_plan_id,
        status,
        provider,
        current_period_start,
        current_period_end,
        trial_ends_at,
        metadata
      )
      values (
        v_request.gym_id,
        v_request.user_id,
        v_plan.id,
        v_subscription_status,
        'manual',
        now(),
        v_period_end,
        v_trial_ends_at,
        jsonb_build_object(
          'source', 'join_request_approval',
          'join_request_id', v_request.id,
          'approved_by', v_user_id,
          'billing_cycle', v_plan.billing_cycle
        )
      )
      returning id
      into v_subscription_id;
    else
      update public.member_subscriptions
      set status = v_subscription_status,
          provider = 'manual',
          current_period_start = coalesce(current_period_start, now()),
          current_period_end = coalesce(current_period_end, v_period_end),
          trial_ends_at = v_trial_ends_at,
          canceled_at = null,
          cancel_at = null,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'source', 'join_request_approval',
            'join_request_id', v_request.id,
            'approved_by', v_user_id,
            'billing_cycle', v_plan.billing_cycle
          )
      where id = v_subscription_id;
    end if;

    if v_plan.price_cents > 0 then
      select i.id
      into v_invoice_id
      from public.invoices i
      where i.subscription_id = v_subscription_id
        and i.metadata->>'join_request_id' = v_request.id::text
      order by i.created_at desc
      limit 1;

      if v_invoice_id is null then
        insert into public.invoices(
          subscription_id,
          gym_id,
          user_id,
          status,
          currency,
          subtotal_cents,
          tax_cents,
          total_cents,
          amount_paid_cents,
          amount_due_cents,
          due_at,
          metadata
        )
        values (
          v_subscription_id,
          v_request.gym_id,
          v_request.user_id,
          'open',
          v_plan.currency,
          v_plan.price_cents,
          0,
          v_plan.price_cents,
          0,
          v_plan.price_cents,
          coalesce(v_trial_ends_at, now() + interval '7 days'),
          jsonb_build_object(
            'source', 'join_request_approval',
            'join_request_id', v_request.id,
            'membership_plan_id', v_plan.id,
            'manual_collection', true
          )
        );
      end if;
    end if;
  end if;

  update public.gym_join_requests
  set status = p_next_status,
      staff_note = nullif(trim(coalesce(p_staff_note, '')), ''),
      reviewed_by = v_user_id,
      reviewed_at = now()
  where id = p_request_id;

  return v_membership_id;
end;
$$;

revoke all on function public.review_gym_join_request(uuid, text, text) from public;
grant execute on function public.review_gym_join_request(uuid, text, text) to authenticated;

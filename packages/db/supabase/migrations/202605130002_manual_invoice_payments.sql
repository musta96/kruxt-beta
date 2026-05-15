-- Record manual member invoice payments with an auditable transaction row.

create or replace function public.record_manual_invoice_payment(
  p_invoice_id uuid,
  p_amount_cents integer default null,
  p_payment_method_type text default 'manual',
  p_reference text default null,
  p_note text default null,
  p_captured_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_amount_cents integer;
  v_new_amount_paid integer;
  v_new_amount_due integer;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_invoice
  from public.invoices i
  where i.id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Invoice not found';
  end if;

  if not public.is_gym_staff(v_invoice.gym_id, v_user_id) then
    raise exception 'Gym staff access is required';
  end if;

  v_amount_cents := coalesce(p_amount_cents, nullif(v_invoice.amount_due_cents, 0), v_invoice.total_cents);

  if v_amount_cents is null or v_amount_cents <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  insert into public.payment_transactions(
    invoice_id,
    subscription_id,
    gym_id,
    user_id,
    provider,
    status,
    payment_method_type,
    amount_cents,
    fee_cents,
    tax_cents,
    currency,
    captured_at,
    metadata
  )
  values (
    v_invoice.id,
    v_invoice.subscription_id,
    v_invoice.gym_id,
    v_invoice.user_id,
    'manual',
    'paid',
    nullif(trim(coalesce(p_payment_method_type, 'manual')), ''),
    v_amount_cents,
    0,
    0,
    v_invoice.currency,
    coalesce(p_captured_at, now()),
    jsonb_build_object(
      'source', 'manual_invoice_payment',
      'reference', nullif(trim(coalesce(p_reference, '')), ''),
      'note', nullif(trim(coalesce(p_note, '')), ''),
      'recorded_by', v_user_id
    )
  )
  returning id
  into v_payment_id;

  v_new_amount_paid := v_invoice.amount_paid_cents + v_amount_cents;
  v_new_amount_due := greatest(v_invoice.total_cents - v_new_amount_paid, 0);

  update public.invoices
  set amount_paid_cents = v_new_amount_paid,
      amount_due_cents = v_new_amount_due,
      status = case when v_new_amount_due = 0 then 'paid'::public.payment_status else 'open'::public.payment_status end,
      paid_at = case when v_new_amount_due = 0 then coalesce(p_captured_at, now()) else paid_at end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_manual_payment_id', v_payment_id,
        'last_manual_payment_at', coalesce(p_captured_at, now())
      )
  where id = v_invoice.id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_manual_invoice_payment(uuid, integer, text, text, text, timestamptz) from public;
grant execute on function public.record_manual_invoice_payment(uuid, integer, text, text, text, timestamptz) to authenticated;

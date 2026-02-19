-- =====================================================
-- IMMUTABILITY GUARDS
-- =====================================================

create or replace function public.prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This table is append-only';
end;
$$;

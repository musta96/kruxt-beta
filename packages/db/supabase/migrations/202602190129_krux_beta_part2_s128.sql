create policy gyms_select_public_or_member
on public.gyms for select to authenticated
using (is_public or public.is_gym_member(id, auth.uid()));

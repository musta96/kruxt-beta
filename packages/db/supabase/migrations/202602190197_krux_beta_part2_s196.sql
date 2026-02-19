create policy challenge_participants_select
on public.challenge_participants for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and (
        c.visibility = 'public'
        or c.creator_user_id = auth.uid()
        or (c.visibility = 'gym' and c.gym_id is not null and public.can_view_gym(c.gym_id, auth.uid()))
      )
  )
);

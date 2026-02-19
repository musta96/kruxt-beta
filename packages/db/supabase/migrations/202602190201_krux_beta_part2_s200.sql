create policy challenge_participants_update_self_or_creator
on public.challenge_participants for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.creator_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.creator_user_id = auth.uid()
  )
);

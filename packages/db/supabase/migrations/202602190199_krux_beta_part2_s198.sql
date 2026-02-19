create policy challenge_participants_insert_self
on public.challenge_participants for insert to authenticated
with check (user_id = auth.uid());

create trigger trg_challenge_participants_set_updated_at before update on public.challenge_participants
for each row execute function public.set_updated_at();

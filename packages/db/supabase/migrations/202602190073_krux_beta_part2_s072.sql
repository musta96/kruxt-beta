create trigger trg_workout_feed_event
after insert on public.workouts
for each row execute function public.create_workout_feed_event_trigger();

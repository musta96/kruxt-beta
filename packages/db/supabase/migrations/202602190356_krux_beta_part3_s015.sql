create index if not exists idx_push_tokens_user_active on public.push_notification_tokens(user_id, is_active, updated_at desc);

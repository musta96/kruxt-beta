create index if not exists idx_push_tokens_platform_active on public.push_notification_tokens(platform, is_active, updated_at desc);

revoke all on function public.publish_policy_version(
  public.policy_type,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
) from public;
grant execute on function public.publish_policy_version(
  public.policy_type,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
) to service_role;

revoke all on function public.current_policy_version_id(public.policy_type, timestamptz) from public;
grant execute on function public.current_policy_version_id(public.policy_type, timestamptz) to authenticated;
grant execute on function public.current_policy_version_id(public.policy_type, timestamptz) to service_role;

revoke all on function public.record_user_consent(
  public.consent_type,
  boolean,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) from public;
grant execute on function public.record_user_consent(
  public.consent_type,
  boolean,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) to authenticated;
grant execute on function public.record_user_consent(
  public.consent_type,
  boolean,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.list_missing_required_consents(uuid) from public;
grant execute on function public.list_missing_required_consents(uuid) to authenticated;
grant execute on function public.list_missing_required_consents(uuid) to service_role;

revoke all on function public.user_has_required_consents(uuid) from public;
grant execute on function public.user_has_required_consents(uuid) to authenticated;
grant execute on function public.user_has_required_consents(uuid) to service_role;

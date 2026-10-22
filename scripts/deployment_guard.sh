#!/usr/bin/env bash

# Shared local-only checks. Sourced by the deployment entrypoints.
DEV_PROJECT_REF="hgomsmhsybrxjdxbgkjy"
DEPLOY_MODE="check"
DEPLOY_CONFIRM=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply|--dry-run)
      [ "$DEPLOY_MODE" = "check" ] || { echo "Choose one deployment mode." >&2; exit 1; }
      DEPLOY_MODE="${1#--}"; shift ;;
    --confirm-dev-project)
      [ "$#" -ge 2 ] || { echo "Missing project confirmation." >&2; exit 1; }
      DEPLOY_CONFIRM="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

fail_deploy() { echo "$*" >&2; exit 1; }

SOURCE_MIGRATIONS_DIR="$ROOT_DIR/packages/db/supabase/migrations"
TARGET_MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
[ -f "$ROOT_DIR/supabase/config.toml" ] || fail_deploy "Missing Supabase configuration."
[ -d "$SOURCE_MIGRATIONS_DIR" ] && [ -d "$TARGET_MIGRATIONS_DIR" ] || fail_deploy "Missing migration directories."
for migration in \
  202608030001_guard_bzone_demo_seed.sql \
  202608030002_atomic_class_booking_waitlist.sql \
  202608030003_harden_class_cancellation_promotion.sql \
  202608030004_consent_activation_hardening.sql \
  202608030005_mobile_onboarding_contract.sql \
  202608030006_harden_class_lifecycle.sql; do
  [ -f "$SOURCE_MIGRATIONS_DIR/$migration" ] || fail_deploy "Missing coordinated release migration: $migration"
done

# Never infer which historical tree is authoritative or overwrite either tree.
diff -qr "$SOURCE_MIGRATIONS_DIR" "$TARGET_MIGRATIONS_DIR" || fail_deploy "Migration histories differ. Reconcile against remote history before deployment; no files were changed."

if [ "$DEPLOY_MODE" != "check" ]; then
  [ "$DEPLOY_CONFIRM" = "$DEV_PROJECT_REF" ] || fail_deploy "Require --confirm-dev-project $DEV_PROJECT_REF"
  command -v supabase >/dev/null 2>&1 || fail_deploy "supabase CLI not found."
fi

#!/usr/bin/env bash
# Apply database setup to a linked Supabase project via CLI.
# Prerequisites:
#   1. npx supabase login
#   2. npx supabase link --project-ref YOUR_PROJECT_REF
#   3. Database password from Supabase Dashboard → Settings → Database
#
# Usage:
#   ./scripts/push-supabase.sh
#   ./scripts/push-supabase.sh --dry-run

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Pushing migrations to linked Supabase project..."
npx supabase db push --linked "$@"

echo "Done. Run supabase/verify.sql in the SQL Editor to confirm."

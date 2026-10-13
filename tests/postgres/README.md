# PostgreSQL financial guard regression tests

These workflows use isolated PostgreSQL 16 services. They never connect to Supabase or production.

## Coverage

- Direct UPDATE of a cost referenced by an active distribution is blocked.
- DELETE of an allocated payment is blocked.
- A nested trigger cannot bypass the allocation guard.
- Editing an allocation becomes possible after reversal.
- A cost belonging to another organization remains editable.
- An organization with active **or reversed** distribution history cannot be deleted, so FK cascades cannot erase the audit trail.
- The additive lifecycle migration upgrades a legacy table that lacks `status`, `reversed_at`, `reversal_reason`, and `reversed_from_id`.
- The additive migration is applied twice to verify idempotency; legacy rows are initialized as active, and explicit reversed states are preserved.

## Important limitations

- The financial guard tests use a minimal synthetic schema, not the full production schema.
- The lifecycle-upgrade workflow tests the legacy-table-to-upgraded-table path, not a replay of every migration in the repository.
- This does not establish which columns or trigger definitions currently exist in the production Supabase database.
- Before any production rollout, inspect the migration history and actual schema in a separately approved, read-only verification step, then review a rollout plan. Do not run these test SQL files against production.
- No production migration, storage change, or deployment is performed by these tests.

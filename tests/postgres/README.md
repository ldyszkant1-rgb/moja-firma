# PostgreSQL financial guard regression tests

These workflows use isolated PostgreSQL 16 services. They never connect to Supabase or production.

## Coverage

- Replays the profit-distribution migrations in timestamp order against a minimal base application schema:
  1. `20261007170000_add_profit_distribution_tracking.sql`
  2. `20261007191607_add_profit_distribution_history_status.sql`
  3. `20261011131054_validate_profit_distribution_relations.sql`
  4. `20261011144623_prevent_duplicate_profit_distribution_allocations.sql`
  5. `20261011145650_prevent_mutation_of_allocated_financial_rows.sql`
  6. `20261011210000_protect_distributed_finance_costs.sql`
  7. `20261013180000_prevent_org_delete_with_active_distributions.sql`
  8. `20261014120000_add_profit_distribution_lifecycle_columns.sql`
- Direct UPDATE of a cost referenced by an active distribution is blocked.
- DELETE of an allocated payment is blocked.
- A nested trigger cannot bypass the allocation guard.
- Editing an allocation becomes possible after reversal.
- A cost belonging to another organization remains editable.
- An organization with active **or reversed** distribution history cannot be deleted, so FK cascades cannot erase the audit trail.
- Separately tests the additive lifecycle migration against a legacy table without the four lifecycle columns.
- Verifies the reversal self-FK uses `ON DELETE NO ACTION` and blocks deletion of a referenced distribution, preserving reversal history.
- The additive migration refuses to add the FK if orphan reversal references are found; it fails clearly rather than silently discarding or legitimizing broken history.
- Applies the additive migration repeatedly to verify idempotency; legacy rows are initialized as active, and explicit reversed states are preserved.

## Important limitations

- The migration replay uses a minimal test-only base schema, not the full production schema or all repository migrations.
- This does not establish which columns or trigger definitions currently exist in the production Supabase database.
- Before any production rollout, inspect migration history and the actual schema in a separately approved, read-only verification step, then review a rollout plan. Do not run these test SQL files against production.
- No production migration, storage change, or deployment is performed by these tests.

# PostgreSQL financial guard regression tests

These workflows use isolated PostgreSQL 16 services. They never connect to Supabase or production.

## Coverage

- Replays the profit-distribution migrations in timestamp order against a minimal base application schema:
  1. `20261007170000_add_profit_distribution_tracking.sql`
  2. `20261007191607_add_profit_distribution_history_status.sql`
  3. `20261011131054_validate_profit_distribution_relations.sql`
  4. `20261011144623_prevent_duplicate_profit_distribution_allocations.sql`
  5. `20261011145650_prevent_mutation_of_allocated_financial_rows.sql`
  6. `20261011210100_protect_distributed_finance_costs.sql`
  7. `20261014120000_add_profit_distribution_lifecycle_columns.sql`
  8. `20261014133251_prevent_org_delete_with_distribution_history.sql`
  9. `20261014133255_protect_profit_distribution_history.sql`
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
- Production read-only verification was completed on 2026-10-14. The two history-deletion guards were applied directly to production and registered there as versions `20261014133251` and `20261014133255`; controlled DELETE attempts confirmed both protections reject deletion. Production still has two active distributions, and no financial rows were changed or deleted.
- The repository filenames for these two migrations match the versions recorded in production, avoiding a needless reapplication during a future `db push`.
- Production does not record the original bootstrap migration version `20261007170000`; if a future `db push` proposes replaying it against the existing table, the migration now preserves existing policies and does not grant `DELETE` on `profit_distributions`. CI asserts this privilege contract immediately after the bootstrap migration, before the later guard migration runs.
- The additive lifecycle migration is intentionally idempotent for databases where the lifecycle columns and `NO ACTION` self-FK already exist.
- The replay remains a minimal test-only schema, not a full replay of every production migration. Before any future rollout, inspect the proposed `db push` plan and verify it contains no unexpected operations. Never run these test SQL files against production.
- These tests do not change production, Storage configuration, or deployment.

## Prywatny Storage realizacji

- Migracja `20261014150000_prepare_aeroinstal_storage_policies.sql` oraz `20261014151000_make_aeroinstal_storage_private.sql` ustawia bucket `aeroinstal-files` jako prywatny i odtwarza polityki SELECT/INSERT/UPDATE/DELETE ograniczone do ID realizacji oraz bieżącej organizacji.
- W politykach sprawdzana jest ścieżka pliku `jobs/<job-id>/...` przeciwko `jobs.id`; nie wolno odwoływać się do ścieżki z `jobs.name`.
- Frontend generuje czasowe adresy przez `createSignedUrl` i odświeża je z zapisanej ścieżki podczas pobierania danych oraz zdarzeń Realtime. Nie używa już `getPublicUrl`.
- CI sprawdza kontrakt migracji i klienta. To kontrola statyczna; nie zastępuje testu na podglądzie aplikacji z prawdziwą sesją i istniejącymi plikami.
- **Nie zastosowano tych migracji w produkcji.** Produkcyjny bucket nadal jest publiczny. W produkcji znajduje się 14 obiektów, których dostęp trzeba sprawdzić po przełączeniu.
- Bezpieczna kolejność rollout: najpierw zastosować migrację przygotowującą polityki (bucket pozostaje publiczny), następnie wdrożyć kod używający podpisanych adresów i sprawdzić odczyt, dodawanie, zmianę oraz usuwanie plików; dopiero potem zastosować osobną migrację przełączającą bucket na prywatny; na koniec ponownie sprawdzić dostęp do wszystkich istniejących plików.

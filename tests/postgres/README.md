# PostgreSQL financial guard regression tests

These tests use a minimal synthetic schema in an isolated PostgreSQL 16 service. They do not connect to Supabase or production.

Coverage:
- direct UPDATE of a cost referenced by an active distribution is blocked;
- DELETE of an allocated payment is blocked;
- an UPDATE initiated by a nested trigger is blocked;
- an edit is allowed after the distribution is reversed;
- a cost belonging to another organization remains editable.

Limitations:
- This is not a full production-schema integration test. FK and trigger order must be checked against the actual schema before changing the organization-deletion behavior.
- The workflow tests the migration in this branch; GitHub Actions must run before the fix can be considered verified.
- No production migration, storage change, or deployment is performed by these tests.

-- RLS does not protect tables from TRUNCATE. The application uses row-level
-- CRUD and RPCs, not table-level trigger/reference management. Remove these
-- unnecessary privileges while preserving SELECT/INSERT/UPDATE/DELETE.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

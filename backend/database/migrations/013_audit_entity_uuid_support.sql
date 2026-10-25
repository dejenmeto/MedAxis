
-- Allow audit logs to reference both BIGINT and UUID entity IDs.
-- Existing numeric IDs are preserved as text.

ALTER TABLE audit_logs
  ALTER COLUMN entity_id TYPE TEXT
  USING entity_id::TEXT;

COMMENT ON COLUMN audit_logs.entity_id IS
  'Identifier of the audited entity; stored as text to support BIGINT and UUID IDs.';

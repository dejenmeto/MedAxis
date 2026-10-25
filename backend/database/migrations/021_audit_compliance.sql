
-- 021_audit_compliance.sql
-- Adds compliance tracking while reusing the existing audit_logs table.

CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  hospital_id BIGINT NOT NULL
    REFERENCES hospitals(id) ON DELETE CASCADE,

  title VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'waived')),

  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  due_date DATE,
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,

  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_hospital
  ON compliance_checks (hospital_id);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_status
  ON compliance_checks (hospital_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_due_date
  ON compliance_checks (hospital_id, due_date);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_assigned_to
  ON compliance_checks (hospital_id, assigned_to);

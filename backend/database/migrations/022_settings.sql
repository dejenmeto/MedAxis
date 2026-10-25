
CREATE TABLE IF NOT EXISTS hospital_settings (
  scope_key TEXT PRIMARY KEY,
  hospital_id BIGINT REFERENCES hospitals(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hospital_settings_scope_key_valid
    CHECK (
      scope_key = 'global'
      OR scope_key = 'hospital:' || hospital_id::text
    )
);

CREATE INDEX IF NOT EXISTS idx_hospital_settings_hospital_id
  ON hospital_settings (hospital_id);

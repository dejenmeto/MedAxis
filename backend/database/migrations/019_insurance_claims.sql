
-- MedAxis: Insurance and Claims
-- Apply through the existing Node.js migration runner.
-- Do not add BEGIN or COMMIT; the runner manages transactions.

CREATE TABLE IF NOT EXISTS insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  provider_code VARCHAR(40) NOT NULL,
  name VARCHAR(180) NOT NULL,
  contact_person VARCHAR(150),
  phone VARCHAR(40),
  email VARCHAR(180),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, provider_code)
);

CREATE TABLE IF NOT EXISTS patient_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  provider_id UUID NOT NULL REFERENCES insurance_providers(id),
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  policy_number VARCHAR(100) NOT NULL,
  member_number VARCHAR(100),
  plan_name VARCHAR(160),
  coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 100
    CHECK (coverage_percent BETWEEN 0 AND 100),
  coverage_limit NUMERIC(14,2)
    CHECK (coverage_limit IS NULL OR coverage_limit >= 0),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, policy_number),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  claim_number VARCHAR(60) NOT NULL,
  policy_id UUID NOT NULL REFERENCES patient_insurance_policies(id),
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  invoice_reference VARCHAR(100),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_at TIMESTAMPTZ,
  claim_amount NUMERIC(14,2) NOT NULL CHECK (claim_amount > 0),
  approved_amount NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (approved_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  diagnosis_summary TEXT,
  claim_notes TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'submitted', 'under_review', 'approved',
      'partially_approved', 'rejected', 'paid', 'cancelled'
    )),
  rejection_reason TEXT,
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, claim_number),
  CHECK (approved_amount <= claim_amount)
);

CREATE TABLE IF NOT EXISTS insurance_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  claim_id UUID NOT NULL REFERENCES insurance_claims(id),
  reimbursement_reference VARCHAR(100) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date DATE,
  payment_method VARCHAR(30),
  notes TEXT,
  recorded_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, reimbursement_reference)
);

CREATE INDEX IF NOT EXISTS idx_insurance_providers_hospital
  ON insurance_providers (hospital_id, name);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_patient
  ON patient_insurance_policies (hospital_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_provider
  ON patient_insurance_policies (hospital_id, provider_id);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_status
  ON insurance_claims (hospital_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient
  ON insurance_claims (hospital_id, patient_id, service_date DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_reimbursements_claim
  ON insurance_reimbursements (hospital_id, claim_id);


-- 020_payroll.sql
-- Payroll tables for MedAxis Hospital ERP.
-- The migration runner manages transactions.

CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  period_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'processing', 'approved', 'paid', 'closed')),
  notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_period_dates_check CHECK (end_date >= start_date),
  CONSTRAINT payroll_period_name_unique UNIQUE (hospital_id, period_name)
);

CREATE TABLE IF NOT EXISTS employee_salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  basic_salary NUMERIC(14,2) NOT NULL CHECK (basic_salary >= 0),
  housing_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  transport_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  other_allowances NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
  bonus NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  tax_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_deduction >= 0),
  pension_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (pension_deduction >= 0),
  other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_effective_dates_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT salary_structure_staff_unique UNIQUE (hospital_id, staff_id, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  salary_structure_id UUID REFERENCES employee_salary_structures(id) ON DELETE SET NULL,

  -- Salary snapshots preserve the values used for this payroll calculation.
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  housing_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  transport_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  other_allowances NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
  bonus NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  tax_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_deduction >= 0),
  pension_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (pension_deduction >= 0),
  other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
  gross_salary NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gross_salary >= 0),
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_deductions >= 0),
  net_salary NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (net_salary >= 0),

  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'partially_paid', 'paid', 'void')),
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payroll_record_staff_period_unique UNIQUE (hospital_id, period_id, staff_id),
  CONSTRAINT payroll_net_salary_check CHECK (net_salary = gross_salary - total_deductions)
);

CREATE TABLE IF NOT EXISTS payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  payroll_record_id UUID NOT NULL REFERENCES payroll_records(id),
  payment_reference VARCHAR(120) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL
    CHECK (payment_method IN ('bank_transfer', 'cash', 'mobile_money', 'cheque', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_payment_reference_unique UNIQUE (hospital_id, payment_reference)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_hospital_dates
  ON payroll_periods (hospital_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_salary_structures_hospital_staff
  ON employee_salary_structures (hospital_id, staff_id, is_active);

CREATE INDEX IF NOT EXISTS idx_payroll_records_hospital_period
  ON payroll_records (hospital_id, period_id, status);

CREATE INDEX IF NOT EXISTS idx_payroll_records_hospital_staff
  ON payroll_records (hospital_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_record
  ON payroll_payments (hospital_id, payroll_record_id);

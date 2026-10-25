CREATE TABLE departments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL,
  description TEXT,
  head_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  parent_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, code)
);

CREATE INDEX departments_hospital_idx
  ON departments (hospital_id);
CREATE INDEX departments_active_idx
  ON departments (is_active);

CREATE TABLE staff_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  employee_id VARCHAR(50) NOT NULL,
  specialization VARCHAR(255),
  qualification TEXT,
  experience_years INTEGER NOT NULL DEFAULT 0
    CHECK (experience_years >= 0),
  consultation_fee NUMERIC(12,2)
    CHECK (consultation_fee IS NULL OR consultation_fee >= 0),
  max_patients_per_day INTEGER NOT NULL DEFAULT 30
    CHECK (max_patients_per_day > 0),
  joining_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, employee_id)
);

CREATE INDEX staff_hospital_department_idx
  ON staff_profiles (hospital_id, department_id);
CREATE INDEX staff_specialization_idx
  ON staff_profiles (specialization);
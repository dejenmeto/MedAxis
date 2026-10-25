CREATE TABLE patients (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  mr_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (
    gender IS NULL OR gender IN ('male', 'female', 'other', 'unknown')
  ),
  blood_group VARCHAR(5) CHECK (
    blood_group IS NULL OR blood_group IN (
      'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    )
  ),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(30),
  address TEXT,
  city VARCHAR(100),
  region VARCHAR(100),
  postal_code VARCHAR(20),
  patient_type VARCHAR(10) NOT NULL DEFAULT 'OPD'
    CHECK (patient_type IN ('OPD', 'IPD')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, mr_number)
);

CREATE INDEX patients_hospital_idx ON patients (hospital_id);
CREATE INDEX patients_name_idx
  ON patients (hospital_id, last_name, first_name);
CREATE INDEX patients_phone_idx ON patients (phone);
CREATE INDEX patients_created_idx ON patients (created_at DESC);

CREATE TABLE patient_guardians (
  patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  guardian_user_id BIGINT NOT NULL REFERENCES users(id),
  relationship VARCHAR(50),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (patient_id, guardian_user_id)
);
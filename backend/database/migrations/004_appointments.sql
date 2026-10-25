CREATE TABLE appointments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
  appointment_number VARCHAR(50) NOT NULL,
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  doctor_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled', 'confirmed', 'in_progress',
      'completed', 'cancelled', 'no_show'
    )),
  appointment_type VARCHAR(20) NOT NULL DEFAULT 'physical'
    CHECK (appointment_type IN ('physical', 'video', 'emergency')),
  reason TEXT,
  symptoms TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, appointment_number),
  CHECK (end_time > start_time)
);

CREATE INDEX appointments_date_idx
  ON appointments (hospital_id, appointment_date);
CREATE INDEX appointments_doctor_date_idx
  ON appointments (doctor_id, appointment_date, start_time);
CREATE INDEX appointments_patient_idx
  ON appointments (patient_id, appointment_date DESC);
CREATE INDEX appointments_status_idx
  ON appointments (hospital_id, status);
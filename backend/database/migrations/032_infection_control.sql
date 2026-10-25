
-- MedAxis: Infection Prevention and Control
-- The existing migration runner manages the transaction.

CREATE TABLE IF NOT EXISTS infection_control_cases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    case_number VARCHAR(60) NOT NULL,
    patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    infection_type VARCHAR(150) NOT NULL,
    suspected_source VARCHAR(150),
    department VARCHAR(120),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate'
        CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    isolation_required BOOLEAN NOT NULL DEFAULT FALSE,
    isolation_precautions TEXT,
    status VARCHAR(25) NOT NULL DEFAULT 'under_review'
        CHECK (status IN (
            'reported', 'under_review', 'confirmed',
            'monitoring', 'resolved', 'closed'
        )),
    outcome_notes TEXT,
    reported_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_to BIGINT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, case_number)
);

CREATE TABLE IF NOT EXISTS infection_control_actions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    case_id BIGINT NOT NULL REFERENCES infection_control_cases(id) ON DELETE RESTRICT,
    action_title VARCHAR(200) NOT NULL,
    action_description TEXT,
    assigned_to BIGINT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infection_cases_hospital_status
    ON infection_control_cases(hospital_id, status);

CREATE INDEX IF NOT EXISTS idx_infection_cases_detected
    ON infection_control_cases(hospital_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_infection_cases_patient
    ON infection_control_cases(patient_id);

CREATE INDEX IF NOT EXISTS idx_infection_actions_case
    ON infection_control_actions(hospital_id, case_id);

CREATE INDEX IF NOT EXISTS idx_infection_actions_status
    ON infection_control_actions(hospital_id, status);

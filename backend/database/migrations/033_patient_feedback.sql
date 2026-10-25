
-- MedAxis: Hospital Complaints and Patient Feedback
-- The existing migration runner manages transactions.

CREATE TABLE IF NOT EXISTS patient_feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    reference_number VARCHAR(60) NOT NULL,
    patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    feedback_type VARCHAR(25) NOT NULL DEFAULT 'complaint'
        CHECK (feedback_type IN (
            'complaint', 'compliment', 'suggestion', 'service_concern'
        )),
    category VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    department VARCHAR(120),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(25) NOT NULL DEFAULT 'received'
        CHECK (status IN (
            'received', 'under_review', 'investigating',
            'awaiting_response', 'resolved', 'closed'
        )),
    submitted_by_name VARCHAR(150),
    submitted_by_contact VARCHAR(200),
    confidential BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_summary TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, reference_number)
);

CREATE TABLE IF NOT EXISTS patient_feedback_notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    feedback_id BIGINT NOT NULL REFERENCES patient_feedback(id) ON DELETE RESTRICT,
    note_type VARCHAR(20) NOT NULL DEFAULT 'investigation'
        CHECK (note_type IN (
            'investigation', 'contact_attempt', 'decision', 'resolution', 'other'
        )),
    note TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_hospital_status
    ON patient_feedback(hospital_id, status);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_hospital_received
    ON patient_feedback(hospital_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_hospital_category
    ON patient_feedback(hospital_id, category);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_notes_parent
    ON patient_feedback_notes(hospital_id, feedback_id, created_at DESC);

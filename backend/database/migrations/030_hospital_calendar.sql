
-- MedAxis Hospital Calendar & Scheduling
-- The Node.js migration runner manages the transaction.

CREATE TABLE IF NOT EXISTS hospital_calendar_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    hospital_id BIGINT NOT NULL
        REFERENCES hospitals(id) ON DELETE RESTRICT,

    title VARCHAR(200) NOT NULL,
    description TEXT,

    event_type VARCHAR(30) NOT NULL DEFAULT 'other'
        CHECK (
            event_type IN (
                'appointment',
                'meeting',
                'staff_shift',
                'procedure',
                'maintenance',
                'other'
            )
        ),

    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (
            status IN (
                'scheduled',
                'completed',
                'cancelled'
            )
        ),

    doctor_staff_id BIGINT
        REFERENCES staff_profiles(id) ON DELETE SET NULL,

    patient_id BIGINT
        REFERENCES patients(id) ON DELETE SET NULL,

    location VARCHAR(200),

    created_by BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT hospital_calendar_valid_time
        CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_hospital_start
    ON hospital_calendar_events (hospital_id, start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_hospital_status
    ON hospital_calendar_events (hospital_id, status);

CREATE INDEX IF NOT EXISTS idx_calendar_doctor_start
    ON hospital_calendar_events (doctor_staff_id, start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_patient_start
    ON hospital_calendar_events (patient_id, start_at);

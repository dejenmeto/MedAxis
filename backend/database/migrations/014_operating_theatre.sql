
-- 014_operating_theatre.sql
-- MedAxis Operating Theatre module.
-- Safe to run repeatedly; existing records are preserved.

CREATE TABLE IF NOT EXISTS theatre_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    room_number VARCHAR(50) NOT NULL,
    room_name VARCHAR(150) NOT NULL,
    room_type VARCHAR(40) NOT NULL DEFAULT 'general',
    room_status VARCHAR(30) NOT NULL DEFAULT 'available'
        CHECK (room_status IN (
            'available', 'maintenance', 'inactive'
        )),
    location VARCHAR(150),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, room_number)
);

CREATE TABLE IF NOT EXISTS surgical_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    procedure_code VARCHAR(60) NOT NULL,
    procedure_name VARCHAR(180) NOT NULL,
    specialty VARCHAR(120),
    description TEXT,
    estimated_duration_minutes INTEGER NOT NULL DEFAULT 60
        CHECK (estimated_duration_minutes > 0),
    standard_fee NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (standard_fee >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, procedure_code)
);

CREATE TABLE IF NOT EXISTS theatre_surgeries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    surgery_number VARCHAR(60) NOT NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    theatre_room_id UUID NOT NULL REFERENCES theatre_rooms(id),
    procedure_id UUID NOT NULL REFERENCES surgical_procedures(id),
    surgeon_id BIGINT REFERENCES staff_profiles(id),
    anaesthetist_id BIGINT REFERENCES staff_profiles(id),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    priority VARCHAR(20) NOT NULL DEFAULT 'routine'
        CHECK (priority IN ('routine', 'urgent', 'emergency')),
    surgery_status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
        CHECK (surgery_status IN (
            'scheduled', 'preparation', 'in_progress',
            'completed', 'cancelled', 'postponed'
        )),
    preoperative_diagnosis TEXT,
    postoperative_diagnosis TEXT,
    cancellation_reason TEXT,
    notes TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, surgery_number),
    CHECK (scheduled_end > scheduled_start),
    CHECK (
        actual_end IS NULL OR actual_start IS NULL
        OR actual_end >= actual_start
    )
);

CREATE TABLE IF NOT EXISTS theatre_surgery_team (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    surgery_id UUID NOT NULL REFERENCES theatre_surgeries(id)
        ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
    team_role VARCHAR(40) NOT NULL
        CHECK (team_role IN (
            'surgeon', 'assistant_surgeon', 'anaesthetist',
            'scrub_nurse', 'circulating_nurse', 'technician',
            'other'
        )),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (surgery_id, staff_id, team_role)
);

CREATE TABLE IF NOT EXISTS theatre_operation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    surgery_id UUID NOT NULL UNIQUE
        REFERENCES theatre_surgeries(id),
    anaesthesia_type VARCHAR(80),
    anaesthesia_notes TEXT,
    procedure_performed TEXT NOT NULL,
    operative_findings TEXT,
    operative_technique TEXT,
    estimated_blood_loss_ml INTEGER
        CHECK (
            estimated_blood_loss_ml IS NULL
            OR estimated_blood_loss_ml >= 0
        ),
    complications TEXT,
    specimens TEXT,
    implants_used TEXT,
    post_op_plan TEXT,
    recovery_destination VARCHAR(100),
    recorded_by BIGINT REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theatre_rooms_hospital
    ON theatre_rooms(hospital_id, room_status);

CREATE INDEX IF NOT EXISTS idx_surgical_procedures_hospital
    ON surgical_procedures(hospital_id, is_active);

CREATE INDEX IF NOT EXISTS idx_theatre_surgeries_schedule
    ON theatre_surgeries(hospital_id, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_theatre_surgeries_status
    ON theatre_surgeries(hospital_id, surgery_status);

CREATE INDEX IF NOT EXISTS idx_theatre_surgeries_patient
    ON theatre_surgeries(hospital_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_theatre_team_surgery
    ON theatre_surgery_team(hospital_id, surgery_id);

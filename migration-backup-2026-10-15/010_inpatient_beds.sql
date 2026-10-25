
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    department_id UUID REFERENCES departments(id),
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(40) NOT NULL DEFAULT 'general',
    floor_number VARCHAR(30),
    daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, room_number)
);

CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    bed_number VARCHAR(50) NOT NULL,
    bed_status VARCHAR(30) NOT NULL DEFAULT 'available'
        CHECK (bed_status IN ('available', 'occupied', 'maintenance', 'reserved')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, bed_number)
);

CREATE TABLE IF NOT EXISTS admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    bed_id UUID NOT NULL REFERENCES beds(id),
    attending_staff_id UUID REFERENCES staff_profiles(id),
    admitted_by UUID REFERENCES users(id),
    admission_number VARCHAR(60) NOT NULL,
    admission_type VARCHAR(30) NOT NULL DEFAULT 'routine'
        CHECK (admission_type IN ('routine', 'emergency', 'transfer')),
    admission_reason TEXT NOT NULL,
    admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_discharge_at TIMESTAMPTZ,
    discharged_at TIMESTAMPTZ,
    discharge_notes TEXT,
    admission_status VARCHAR(30) NOT NULL DEFAULT 'admitted'
        CHECK (admission_status IN ('admitted', 'discharged', 'transferred', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, admission_number),
    CHECK (
        expected_discharge_at IS NULL
        OR expected_discharge_at >= admitted_at
    ),
    CHECK (
        discharged_at IS NULL
        OR discharged_at >= admitted_at
    )
);

CREATE INDEX IF NOT EXISTS idx_rooms_hospital
    ON rooms(hospital_id);

CREATE INDEX IF NOT EXISTS idx_beds_hospital_status
    ON beds(hospital_id, bed_status);

CREATE INDEX IF NOT EXISTS idx_admissions_hospital_status
    ON admissions(hospital_id, admission_status);

CREATE INDEX IF NOT EXISTS idx_admissions_patient
    ON admissions(patient_id);

CREATE INDEX IF NOT EXISTS idx_admissions_admitted_at
    ON admissions(admitted_at DESC);

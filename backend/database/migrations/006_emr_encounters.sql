CREATE TABLE IF NOT EXISTS encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    clinician_id BIGINT REFERENCES staff_profiles(id),
    encounter_number VARCHAR(60) NOT NULL,
    encounter_type VARCHAR(30) NOT NULL DEFAULT 'outpatient'
        CHECK (encounter_type IN (
            'outpatient', 'inpatient', 'emergency', 'telemedicine'
        )),
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    examination_notes TEXT,
    assessment TEXT,
    plan TEXT,
    encounter_status VARCHAR(25) NOT NULL DEFAULT 'open'
        CHECK (encounter_status IN ('open', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, encounter_number)
);

CREATE TABLE IF NOT EXISTS encounter_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    recorded_by BIGINT REFERENCES staff_profiles(id),
    temperature_c NUMERIC(4, 1)
        CHECK (temperature_c IS NULL OR temperature_c BETWEEN 25 AND 45),
    systolic_bp SMALLINT
        CHECK (systolic_bp IS NULL OR systolic_bp BETWEEN 30 AND 300),
    diastolic_bp SMALLINT
        CHECK (diastolic_bp IS NULL OR diastolic_bp BETWEEN 20 AND 200),
    pulse_bpm SMALLINT
        CHECK (pulse_bpm IS NULL OR pulse_bpm BETWEEN 20 AND 250),
    respiratory_rate SMALLINT
        CHECK (respiratory_rate IS NULL OR respiratory_rate BETWEEN 1 AND 100),
    oxygen_saturation NUMERIC(5, 2)
        CHECK (
            oxygen_saturation IS NULL
            OR oxygen_saturation BETWEEN 0 AND 100
        ),
    weight_kg NUMERIC(6, 2)
        CHECK (weight_kg IS NULL OR weight_kg > 0),
    height_cm NUMERIC(6, 2)
        CHECK (height_cm IS NULL OR height_cm > 0),
    pain_score SMALLINT
        CHECK (pain_score IS NULL OR pain_score BETWEEN 0 AND 10),
    notes TEXT,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encounter_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    diagnosis_code VARCHAR(40),
    diagnosis_name VARCHAR(255) NOT NULL,
    diagnosis_type VARCHAR(25) NOT NULL DEFAULT 'working'
        CHECK (diagnosis_type IN ('working', 'final', 'differential')),
    notes TEXT,
    diagnosed_by BIGINT REFERENCES staff_profiles(id),
    diagnosed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient_started
    ON encounters(hospital_id, patient_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_encounters_clinician
    ON encounters(hospital_id, clinician_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_encounters_status
    ON encounters(hospital_id, encounter_status);

CREATE INDEX IF NOT EXISTS idx_encounter_vitals_encounter
    ON encounter_vitals(encounter_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_encounter
    ON encounter_diagnoses(encounter_id, diagnosed_at DESC);

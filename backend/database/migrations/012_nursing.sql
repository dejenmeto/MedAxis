
CREATE TABLE IF NOT EXISTS nursing_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    admission_id UUID REFERENCES admissions(id),
    nurse_id BIGINT REFERENCES staff_profiles(id),
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chief_complaint TEXT,
    general_appearance TEXT,
    pain_score SMALLINT CHECK (pain_score BETWEEN 0 AND 10),
    fall_risk VARCHAR(20)
        CHECK (fall_risk IS NULL OR fall_risk IN ('low', 'moderate', 'high')),
    pressure_injury_risk VARCHAR(20)
        CHECK (
            pressure_injury_risk IS NULL
            OR pressure_injury_risk IN ('low', 'moderate', 'high')
        ),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nursing_care_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    admission_id UUID REFERENCES admissions(id),
    created_by BIGINT REFERENCES staff_profiles(id),
    nursing_diagnosis TEXT NOT NULL,
    goals TEXT NOT NULL,
    interventions TEXT NOT NULL,
    evaluation TEXT,
    plan_status VARCHAR(25) NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'completed', 'discontinued')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nursing_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    admission_id UUID REFERENCES admissions(id),
    recorded_by BIGINT REFERENCES staff_profiles(id),
    observation_type VARCHAR(60) NOT NULL,
    observation_value TEXT NOT NULL,
    unit VARCHAR(30),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursing_assessments_patient
    ON nursing_assessments(hospital_id, patient_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_nursing_care_plans_status
    ON nursing_care_plans(hospital_id, patient_id, plan_status);

CREATE INDEX IF NOT EXISTS idx_nursing_observations_patient
    ON nursing_observations(hospital_id, patient_id, observed_at DESC);

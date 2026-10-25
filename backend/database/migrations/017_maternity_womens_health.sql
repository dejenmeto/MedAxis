
-- MedAxis Maternity & Women's Health
-- Migration: 017_maternity_womens_health.sql
-- Existing migration runner manages transactions.
-- Do not add BEGIN or COMMIT.

-- ============================================================================
-- 1. MATERNAL PREGNANCY RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS maternity_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    admission_id UUID REFERENCES admissions(id),

    pregnancy_number VARCHAR(60) NOT NULL,
    gravida SMALLINT NOT NULL DEFAULT 1 CHECK (gravida >= 0),
    para SMALLINT NOT NULL DEFAULT 0 CHECK (para >= 0),
    abortions SMALLINT NOT NULL DEFAULT 0 CHECK (abortions >= 0),
    living_children SMALLINT NOT NULL DEFAULT 0 CHECK (living_children >= 0),

    last_menstrual_period DATE,
    estimated_delivery_date DATE,
    actual_delivery_date DATE,

    gestational_age_weeks SMALLINT
        CHECK (gestational_age_weeks BETWEEN 0 AND 45),
    gestational_age_days SMALLINT
        CHECK (gestational_age_days BETWEEN 0 AND 6),

    pregnancy_type VARCHAR(20) NOT NULL DEFAULT 'singleton'
        CHECK (pregnancy_type IN ('singleton', 'multiple')),

    blood_group VARCHAR(5),
    rhesus_factor VARCHAR(10)
        CHECK (rhesus_factor IN ('positive', 'negative') OR rhesus_factor IS NULL),

    risk_level VARCHAR(20) NOT NULL DEFAULT 'low'
        CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),

    pregnancy_status VARCHAR(25) NOT NULL DEFAULT 'antenatal'
        CHECK (pregnancy_status IN (
            'antenatal',
            'in_labor',
            'delivered',
            'postpartum',
            'pregnancy_loss',
            'cancelled'
        )),

    medical_history TEXT,
    obstetric_history TEXT,
    allergies TEXT,
    notes TEXT,

    assigned_staff_id BIGINT REFERENCES staff_profiles(id),
    created_by BIGINT REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_maternity_hospital_pregnancy
        UNIQUE (hospital_id, pregnancy_number),

    CHECK (
        estimated_delivery_date IS NULL
        OR last_menstrual_period IS NULL
        OR estimated_delivery_date >= last_menstrual_period
    ),

    CHECK (
        actual_delivery_date IS NULL
        OR last_menstrual_period IS NULL
        OR actual_delivery_date >= last_menstrual_period
    )
);

CREATE INDEX IF NOT EXISTS idx_maternity_patient
    ON maternity_records(hospital_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maternity_status
    ON maternity_records(hospital_id, pregnancy_status, risk_level);

CREATE INDEX IF NOT EXISTS idx_maternity_due_date
    ON maternity_records(hospital_id, estimated_delivery_date)
    WHERE pregnancy_status IN ('antenatal', 'in_labor');


-- ============================================================================
-- 2. ANTENATAL VISITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS antenatal_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    maternity_record_id UUID NOT NULL REFERENCES maternity_records(id),

    visit_number SMALLINT NOT NULL CHECK (visit_number > 0),
    visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    gestational_age_weeks SMALLINT
        CHECK (gestational_age_weeks BETWEEN 0 AND 45),
    gestational_age_days SMALLINT
        CHECK (gestational_age_days BETWEEN 0 AND 6),

    systolic_bp NUMERIC(6,2)
        CHECK (systolic_bp IS NULL OR systolic_bp > 0),
    diastolic_bp NUMERIC(6,2)
        CHECK (diastolic_bp IS NULL OR diastolic_bp > 0),
    weight_kg NUMERIC(6,2)
        CHECK (weight_kg IS NULL OR weight_kg > 0),
    temperature_c NUMERIC(4,2)
        CHECK (temperature_c IS NULL OR temperature_c BETWEEN 20 AND 50),

    fetal_heart_rate SMALLINT
        CHECK (fetal_heart_rate IS NULL OR fetal_heart_rate BETWEEN 60 AND 240),
    fundal_height_cm NUMERIC(5,2)
        CHECK (fundal_height_cm IS NULL OR fundal_height_cm > 0),

    urine_protein VARCHAR(20),
    urine_glucose VARCHAR(20),
    hemoglobin_g_dl NUMERIC(4,2)
        CHECK (hemoglobin_g_dl IS NULL OR hemoglobin_g_dl > 0),

    symptoms TEXT,
    examination_findings TEXT,
    assessment TEXT,
    treatment_plan TEXT,
    danger_signs TEXT,
    next_visit_date DATE,

    attended_by BIGINT REFERENCES staff_profiles(id),
    recorded_by BIGINT REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hospital_id, maternity_record_id, visit_number)
);

CREATE INDEX IF NOT EXISTS idx_antenatal_record_date
    ON antenatal_visits(hospital_id, maternity_record_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_antenatal_next_visit
    ON antenatal_visits(hospital_id, next_visit_date)
    WHERE next_visit_date IS NOT NULL;


-- ============================================================================
-- 3. LABOR RECORDS
-- One labor episode per pregnancy record in this initial version.
-- ============================================================================

CREATE TABLE IF NOT EXISTS labor_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    maternity_record_id UUID NOT NULL REFERENCES maternity_records(id),
    admission_id UUID REFERENCES admissions(id),

    labor_number VARCHAR(60) NOT NULL,
    labor_onset_at TIMESTAMPTZ,
    membrane_rupture_at TIMESTAMPTZ,
    full_dilation_at TIMESTAMPTZ,
    delivery_started_at TIMESTAMPTZ,
    labor_completed_at TIMESTAMPTZ,

    labor_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (labor_status IN (
            'active', 'completed', 'transferred', 'cancelled'
        )),

    presentation VARCHAR(30),
    induction_method VARCHAR(100),
    analgesia_method VARCHAR(100),
    membrane_status VARCHAR(20)
        CHECK (
            membrane_status IN ('intact', 'ruptured', 'unknown')
            OR membrane_status IS NULL
        ),

    complications TEXT,
    clinical_notes TEXT,

    attending_staff_id BIGINT REFERENCES staff_profiles(id),
    recorded_by BIGINT REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hospital_id, labor_number),
    UNIQUE (maternity_record_id),

    CHECK (
        labor_completed_at IS NULL
        OR labor_onset_at IS NULL
        OR labor_completed_at >= labor_onset_at
    )
);

CREATE INDEX IF NOT EXISTS idx_labor_status
    ON labor_records(hospital_id, labor_status, labor_onset_at DESC);

CREATE INDEX IF NOT EXISTS idx_labor_maternity
    ON labor_records(hospital_id, maternity_record_id);


-- ============================================================================
-- 4. FETAL AND LABOR OBSERVATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fetal_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    labor_record_id UUID NOT NULL REFERENCES labor_records(id),

    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fetal_heart_rate SMALLINT
        CHECK (fetal_heart_rate IS NULL OR fetal_heart_rate BETWEEN 30 AND 300),

    contraction_frequency_per_10_min SMALLINT
        CHECK (
            contraction_frequency_per_10_min IS NULL
            OR contraction_frequency_per_10_min BETWEEN 0 AND 20
        ),

    contraction_duration_seconds SMALLINT
        CHECK (
            contraction_duration_seconds IS NULL
            OR contraction_duration_seconds >= 0
        ),

    cervical_dilation_cm NUMERIC(3,1)
        CHECK (
            cervical_dilation_cm IS NULL
            OR cervical_dilation_cm BETWEEN 0 AND 10
        ),

    cervical_effacement_percent SMALLINT
        CHECK (
            cervical_effacement_percent IS NULL
            OR cervical_effacement_percent BETWEEN 0 AND 100
        ),

    fetal_station SMALLINT
        CHECK (
            fetal_station IS NULL
            OR fetal_station BETWEEN -5 AND 5
        ),

    maternal_systolic_bp NUMERIC(6,2)
        CHECK (
            maternal_systolic_bp IS NULL
            OR maternal_systolic_bp > 0
        ),

    maternal_diastolic_bp NUMERIC(6,2)
        CHECK (
            maternal_diastolic_bp IS NULL
            OR maternal_diastolic_bp > 0
        ),

    maternal_pulse SMALLINT
        CHECK (maternal_pulse IS NULL OR maternal_pulse > 0),

    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fetal_observations_time
    ON fetal_observations(hospital_id, labor_record_id, observed_at DESC);


-- ============================================================================
-- 5. DELIVERY RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    maternity_record_id UUID NOT NULL REFERENCES maternity_records(id),
    labor_record_id UUID NOT NULL REFERENCES labor_records(id),

    delivery_number VARCHAR(60) NOT NULL,
    delivery_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    delivery_method VARCHAR(30) NOT NULL
        CHECK (delivery_method IN (
            'vaginal',
            'assisted_vaginal',
            'cesarean',
            'other'
        )),

    delivery_outcome VARCHAR(25) NOT NULL
        CHECK (delivery_outcome IN (
            'live_birth',
            'stillbirth',
            'mixed',
            'pregnancy_loss'
        )),

    placenta_delivered_at TIMESTAMPTZ,
    placenta_complete BOOLEAN,
    blood_loss_ml NUMERIC(10,2)
        CHECK (blood_loss_ml IS NULL OR blood_loss_ml >= 0),

    episiotomy_performed BOOLEAN NOT NULL DEFAULT FALSE,
    perineal_tear_degree SMALLINT
        CHECK (perineal_tear_degree BETWEEN 1 AND 4 OR perineal_tear_degree IS NULL),

    maternal_complications TEXT,
    newborn_complications TEXT,
    delivery_notes TEXT,

    attending_staff_id BIGINT REFERENCES staff_profiles(id),
    recorded_by BIGINT REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hospital_id, delivery_number),
    UNIQUE (labor_record_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_maternity
    ON delivery_records(hospital_id, maternity_record_id, delivery_at DESC);


-- ============================================================================
-- 6. NEWBORN RECORDS
-- Supports multiple newborns for multiple pregnancies.
-- patient_id is optional until a newborn is registered in the patient system.
-- ============================================================================

CREATE TABLE IF NOT EXISTS newborn_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    delivery_id UUID NOT NULL REFERENCES delivery_records(id),
    maternity_record_id UUID NOT NULL REFERENCES maternity_records(id),
    patient_id BIGINT REFERENCES patients(id),

    newborn_number SMALLINT NOT NULL DEFAULT 1
        CHECK (newborn_number > 0),

    newborn_identifier VARCHAR(60),
    date_of_birth TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    sex VARCHAR(20) NOT NULL DEFAULT 'unknown'
        CHECK (sex IN ('female', 'male', 'indeterminate', 'unknown')),

    birth_weight_grams INTEGER
        CHECK (birth_weight_grams IS NULL OR birth_weight_grams > 0),
    length_cm NUMERIC(5,2)
        CHECK (length_cm IS NULL OR length_cm > 0),
    head_circumference_cm NUMERIC(5,2)
        CHECK (head_circumference_cm IS NULL OR head_circumference_cm > 0),

    apgar_1_min SMALLINT
        CHECK (apgar_1_min BETWEEN 0 AND 10 OR apgar_1_min IS NULL),
    apgar_5_min SMALLINT
        CHECK (apgar_5_min BETWEEN 0 AND 10 OR apgar_5_min IS NULL),
    apgar_10_min SMALLINT
        CHECK (apgar_10_min BETWEEN 0 AND 10 OR apgar_10_min IS NULL),

    resuscitation_required BOOLEAN NOT NULL DEFAULT FALSE,
    resuscitation_details TEXT,

    feeding_method VARCHAR(30)
        CHECK (
            feeding_method IN (
                'breastfeeding', 'formula', 'mixed', 'not_started', 'other'
            )
            OR feeding_method IS NULL
        ),

    newborn_status VARCHAR(25) NOT NULL DEFAULT 'stable'
        CHECK (newborn_status IN (
            'stable', 'observation', 'nicu', 'transferred', 'deceased'
        )),

    congenital_conditions TEXT,
    clinical_notes TEXT,

    recorded_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (delivery_id, newborn_number),
    UNIQUE (hospital_id, newborn_identifier)
);

CREATE INDEX IF NOT EXISTS idx_newborn_delivery
    ON newborn_records(hospital_id, delivery_id);

CREATE INDEX IF NOT EXISTS idx_newborn_patient
    ON newborn_records(hospital_id, patient_id)
    WHERE patient_id IS NOT NULL;


-- ============================================================================
-- 7. POSTNATAL VISITS
-- A visit can concern the mother, newborn, or both.
-- ============================================================================

CREATE TABLE IF NOT EXISTS postnatal_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    maternity_record_id UUID NOT NULL REFERENCES maternity_records(id),
    newborn_id UUID REFERENCES newborn_records(id),

    visit_number SMALLINT NOT NULL CHECK (visit_number > 0),
    visit_type VARCHAR(20) NOT NULL DEFAULT 'maternal'
        CHECK (visit_type IN ('maternal', 'newborn', 'combined')),

    visit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_visit_date DATE,

    maternal_systolic_bp NUMERIC(6,2)
        CHECK (
            maternal_systolic_bp IS NULL
            OR maternal_systolic_bp > 0
        ),
    maternal_diastolic_bp NUMERIC(6,2)
        CHECK (
            maternal_diastolic_bp IS NULL
            OR maternal_diastolic_bp > 0
        ),
    maternal_temperature_c NUMERIC(4,2)
        CHECK (
            maternal_temperature_c IS NULL
            OR maternal_temperature_c BETWEEN 20 AND 50
        ),

    maternal_assessment TEXT,
    maternal_treatment_plan TEXT,
    newborn_assessment TEXT,
    newborn_feeding_notes TEXT,
    danger_signs TEXT,
    counseling_notes TEXT,

    attended_by BIGINT REFERENCES staff_profiles(id),
    recorded_by BIGINT REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hospital_id, maternity_record_id, visit_number),

    CHECK (
        visit_type <> 'newborn'
        OR newborn_id IS NOT NULL
    ),

    CHECK (
        visit_type <> 'combined'
        OR newborn_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_postnatal_maternity_date
    ON postnatal_visits(hospital_id, maternity_record_id, visit_at DESC);

CREATE INDEX IF NOT EXISTS idx_postnatal_next_visit
    ON postnatal_visits(hospital_id, next_visit_date)
    WHERE next_visit_date IS NOT NULL;


-- ============================================================================
-- END OF MIGRATION 017
-- ============================================================================

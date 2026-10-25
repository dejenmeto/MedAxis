
CREATE TABLE IF NOT EXISTS imaging_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    service_code VARCHAR(50) NOT NULL,
    service_name VARCHAR(180) NOT NULL,
    modality VARCHAR(40) NOT NULL
        CHECK (modality IN (
            'xray', 'ultrasound', 'ct', 'mri',
            'mammography', 'fluoroscopy', 'other'
        )),
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, service_code)
);

CREATE TABLE IF NOT EXISTS imaging_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    service_id UUID NOT NULL REFERENCES imaging_services(id),
    ordered_by BIGINT REFERENCES staff_profiles(id),
    assigned_radiologist_id BIGINT REFERENCES staff_profiles(id),
    order_number VARCHAR(60) NOT NULL,
    clinical_indication TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'routine'
        CHECK (priority IN ('routine', 'urgent', 'stat')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'requested'
        CHECK (order_status IN (
            'requested', 'scheduled', 'in_progress',
            'completed', 'cancelled'
        )),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ,
    performed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, order_number)
);

CREATE TABLE IF NOT EXISTS imaging_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    imaging_order_id UUID NOT NULL UNIQUE REFERENCES imaging_orders(id),
    radiologist_id BIGINT REFERENCES staff_profiles(id),
    findings TEXT,
    impression TEXT NOT NULL,
    recommendations TEXT,
    report_status VARCHAR(25) NOT NULL DEFAULT 'draft'
        CHECK (report_status IN ('draft', 'final', 'amended')),
    reported_at TIMESTAMPTZ,
    amended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_services_hospital
    ON imaging_services(hospital_id, is_active);

CREATE INDEX IF NOT EXISTS idx_imaging_orders_hospital_status
    ON imaging_orders(hospital_id, order_status);

CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient
    ON imaging_orders(patient_id);

CREATE INDEX IF NOT EXISTS idx_imaging_orders_requested_at
    ON imaging_orders(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_imaging_reports_hospital
    ON imaging_reports(hospital_id, report_status);

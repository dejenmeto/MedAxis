CREATE TABLE IF NOT EXISTS lab_test_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    test_code VARCHAR(60) NOT NULL,
    test_name VARCHAR(180) NOT NULL,
    specimen_type VARCHAR(100),
    department_name VARCHAR(100),
    price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    turnaround_hours INTEGER
        CHECK (turnaround_hours IS NULL OR turnaround_hours >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, test_code)
);

CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    encounter_id UUID REFERENCES encounters(id),
    ordered_by BIGINT REFERENCES staff_profiles(id),
    order_number VARCHAR(60) NOT NULL,
    clinical_notes TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'routine'
        CHECK (priority IN ('routine', 'urgent', 'stat')),
    order_status VARCHAR(25) NOT NULL DEFAULT 'requested'
        CHECK (order_status IN (
            'requested', 'collected', 'in_progress',
            'partially_completed', 'completed', 'cancelled'
        )),
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collected_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, order_number)
);

CREATE TABLE IF NOT EXISTS lab_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id),
    lab_order_id UUID NOT NULL REFERENCES lab_orders(id),
    test_id UUID NOT NULL REFERENCES lab_test_catalog(id),
    performed_by BIGINT REFERENCES staff_profiles(id),
    item_status VARCHAR(25) NOT NULL DEFAULT 'requested'
        CHECK (item_status IN (
            'requested', 'in_progress', 'completed', 'cancelled'
        )),
    result_value TEXT,
    result_unit VARCHAR(50),
    reference_range VARCHAR(120),
    abnormal_flag VARCHAR(20)
        CHECK (
            abnormal_flag IS NULL
            OR abnormal_flag IN ('low', 'normal', 'high', 'critical')
        ),
    result_notes TEXT,
    resulted_at TIMESTAMPTZ,
    verified_by BIGINT REFERENCES staff_profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_catalog_hospital_active
    ON lab_test_catalog(hospital_id, is_active);

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient
    ON lab_orders(hospital_id, patient_id, ordered_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_orders_status
    ON lab_orders(hospital_id, order_status);

CREATE INDEX IF NOT EXISTS idx_lab_items_order
    ON lab_order_items(lab_order_id);

CREATE INDEX IF NOT EXISTS idx_lab_items_status
    ON lab_order_items(hospital_id, item_status);


-- MedAxis: Hospital Equipment and Maintenance
-- The existing migration runner handles BEGIN and COMMIT.

CREATE TABLE IF NOT EXISTS hospital_equipment (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    equipment_code VARCHAR(60) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(150),
    model_number VARCHAR(100),
    serial_number VARCHAR(150),
    location VARCHAR(200),
    condition_status VARCHAR(30) NOT NULL DEFAULT 'good'
        CHECK (condition_status IN (
            'new', 'good', 'needs_repair', 'under_maintenance', 'retired'
        )),
    purchase_date DATE,
    warranty_expiry DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, equipment_code)
);

CREATE TABLE IF NOT EXISTS equipment_maintenance_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    equipment_id BIGINT NOT NULL REFERENCES hospital_equipment(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (status IN (
            'open', 'assigned', 'in_progress', 'completed', 'cancelled'
        )),
    assigned_to BIGINT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    scheduled_date DATE,
    completed_at TIMESTAMPTZ,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    resolution_notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_hospital_active
    ON hospital_equipment(hospital_id, active);

CREATE INDEX IF NOT EXISTS idx_equipment_hospital_category
    ON hospital_equipment(hospital_id, category);

CREATE INDEX IF NOT EXISTS idx_equipment_orders_hospital_status
    ON equipment_maintenance_orders(hospital_id, status);

CREATE INDEX IF NOT EXISTS idx_equipment_orders_equipment
    ON equipment_maintenance_orders(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_orders_schedule
    ON equipment_maintenance_orders(hospital_id, scheduled_date);

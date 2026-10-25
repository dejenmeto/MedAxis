
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    code VARCHAR(60) NOT NULL,
    name VARCHAR(180) NOT NULL,
    generic_name VARCHAR(180),
    category VARCHAR(100),
    dosage_form VARCHAR(80),
    strength VARCHAR(80),
    manufacturer VARCHAR(180),
    unit_of_measure VARCHAR(40) NOT NULL DEFAULT 'unit',
    reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (reorder_level >= 0),
    prescription_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, code)
);

CREATE TABLE IF NOT EXISTS medication_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    medication_id UUID NOT NULL REFERENCES medications(id),
    batch_number VARCHAR(100) NOT NULL,
    quantity_received NUMERIC(12, 2) NOT NULL CHECK (quantity_received > 0),
    quantity_remaining NUMERIC(12, 2) NOT NULL CHECK (quantity_remaining >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    manufactured_on DATE,
    expires_on DATE,
    supplier_name VARCHAR(180),
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, medication_id, batch_number),
    CHECK (quantity_remaining <= quantity_received),
    CHECK (expires_on IS NULL OR manufactured_on IS NULL OR expires_on >= manufactured_on)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    medication_id UUID NOT NULL REFERENCES medications(id),
    batch_id UUID REFERENCES medication_batches(id),
    movement_type VARCHAR(30) NOT NULL
        CHECK (movement_type IN (
            'receipt', 'dispense', 'return',
            'adjustment_in', 'adjustment_out', 'expired', 'damaged'
        )),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    performed_by UUID REFERENCES users(id),
    movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_hospital_active
    ON medications(hospital_id, is_active);

CREATE INDEX IF NOT EXISTS idx_medication_batches_expiry
    ON medication_batches(hospital_id, medication_id, expires_on);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_medication
    ON inventory_movements(hospital_id, medication_id, movement_at DESC);

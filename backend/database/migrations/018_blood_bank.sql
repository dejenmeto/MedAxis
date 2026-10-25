
-- 018_blood_bank.sql
-- The existing migration runner manages the transaction.

CREATE TABLE IF NOT EXISTS blood_donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    donor_number VARCHAR(40) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    sex VARCHAR(20) CHECK (
        sex IN ('female', 'male', 'other', 'unknown')
    ),
    phone VARCHAR(40),
    email VARCHAR(255),
    blood_group VARCHAR(3) CHECK (
        blood_group IN ('A', 'B', 'AB', 'O')
    ),
    rh_type VARCHAR(8) CHECK (
        rh_type IN ('positive', 'negative', 'unknown')
    ),
    address TEXT,
    eligibility_status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (eligibility_status IN (
            'pending', 'eligible', 'deferred',
            'permanently_deferred'
        )),
    last_donation_date DATE,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, donor_number)
);

CREATE INDEX IF NOT EXISTS idx_blood_donors_name
    ON blood_donors(hospital_id, last_name, first_name);

CREATE TABLE IF NOT EXISTS blood_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    donation_number VARCHAR(50) NOT NULL,
    donor_id UUID NOT NULL REFERENCES blood_donors(id) ON DELETE RESTRICT,
    donated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    donation_type VARCHAR(24) NOT NULL DEFAULT 'whole_blood'
        CHECK (donation_type IN (
            'whole_blood', 'apheresis', 'autologous', 'other'
        )),
    volume_ml INTEGER NOT NULL DEFAULT 450
        CHECK (volume_ml > 0 AND volume_ml <= 1000),
    collection_status VARCHAR(20) NOT NULL DEFAULT 'collected'
        CHECK (collection_status IN (
            'collected', 'processing', 'completed', 'discarded', 'cancelled'
        )),
    collected_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, donation_number)
);

CREATE INDEX IF NOT EXISTS idx_blood_donations_donor
    ON blood_donations(hospital_id, donor_id, donated_at DESC);

CREATE TABLE IF NOT EXISTS blood_screening_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    donation_id UUID NOT NULL REFERENCES blood_donations(id) ON DELETE RESTRICT,
    test_name VARCHAR(80) NOT NULL,
    result VARCHAR(20) NOT NULL
        CHECK (result IN (
            'negative', 'positive', 'reactive',
            'non_reactive', 'inconclusive', 'pending'
        )),
    tested_at TIMESTAMPTZ,
    tested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_screening_donation
    ON blood_screening_tests(hospital_id, donation_id);

CREATE TABLE IF NOT EXISTS blood_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    unit_number VARCHAR(60) NOT NULL,
    donation_id UUID NOT NULL REFERENCES blood_donations(id) ON DELETE RESTRICT,
    component_type VARCHAR(30) NOT NULL
        CHECK (component_type IN (
            'whole_blood', 'red_cells', 'platelets',
            'plasma', 'cryoprecipitate', 'other'
        )),
    blood_group VARCHAR(3) NOT NULL
        CHECK (blood_group IN ('A', 'B', 'AB', 'O')),
    rh_type VARCHAR(8) NOT NULL
        CHECK (rh_type IN ('positive', 'negative')),
    volume_ml INTEGER CHECK (
        volume_ml IS NULL OR (volume_ml > 0 AND volume_ml <= 1000)
    ),
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    storage_location VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'quarantined'
        CHECK (status IN (
            'quarantined', 'available', 'reserved',
            'issued', 'discarded', 'expired'
        )),
    screening_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, unit_number),
    CHECK (expires_at > collected_at)
);

CREATE INDEX IF NOT EXISTS idx_blood_units_inventory
    ON blood_units(
        hospital_id, blood_group, rh_type,
        component_type, status, expires_at
    );

CREATE TABLE IF NOT EXISTS blood_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    request_number VARCHAR(50) NOT NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    requested_component VARCHAR(30) NOT NULL
        CHECK (requested_component IN (
            'whole_blood', 'red_cells', 'platelets',
            'plasma', 'cryoprecipitate', 'other'
        )),
    blood_group VARCHAR(3) NOT NULL
        CHECK (blood_group IN ('A', 'B', 'AB', 'O')),
    rh_type VARCHAR(8) NOT NULL
        CHECK (rh_type IN ('positive', 'negative', 'unknown')),
    units_requested INTEGER NOT NULL DEFAULT 1
        CHECK (units_requested > 0 AND units_requested <= 50),
    urgency VARCHAR(20) NOT NULL DEFAULT 'routine'
        CHECK (urgency IN ('routine', 'urgent', 'emergency')),
    clinical_indication TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'approved', 'partially_fulfilled',
            'fulfilled', 'rejected', 'cancelled'
        )),
    requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    needed_by TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_blood_requests_queue
    ON blood_requests(hospital_id, status, urgency, created_at DESC);

CREATE TABLE IF NOT EXISTS blood_compatibility_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE RESTRICT,
    blood_unit_id UUID NOT NULL REFERENCES blood_units(id) ON DELETE RESTRICT,
    result VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (result IN (
            'compatible', 'incompatible', 'pending', 'inconclusive'
        )),
    tested_at TIMESTAMPTZ,
    tested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, request_id, blood_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_blood_crossmatch_request
    ON blood_compatibility_tests(hospital_id, request_id, result);

CREATE TABLE IF NOT EXISTS blood_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    issue_number VARCHAR(50) NOT NULL,
    request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE RESTRICT,
    blood_unit_id UUID NOT NULL REFERENCES blood_units(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    received_by_name VARCHAR(200),
    destination VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, issue_number),
    UNIQUE (hospital_id, blood_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_blood_issues_request
    ON blood_issues(hospital_id, request_id, issued_at DESC);

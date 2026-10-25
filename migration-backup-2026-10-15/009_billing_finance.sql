
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    encounter_id UUID REFERENCES encounters(id),
    invoice_number VARCHAR(60) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'ETB',
    invoice_status VARCHAR(25) NOT NULL DEFAULT 'draft'
        CHECK (invoice_status IN (
            'draft', 'issued', 'partially_paid', 'paid', 'void', 'overdue'
        )),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    balance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, invoice_number),
    CHECK (discount_amount + tax_amount <= subtotal + tax_amount + discount_amount + total_amount)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    description VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'service',
    reference_id UUID,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    payment_reference VARCHAR(100),
    payment_method VARCHAR(30) NOT NULL
        CHECK (payment_method IN (
            'cash', 'card', 'bank_transfer', 'mobile_money',
            'insurance', 'other'
        )),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'ETB',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (payment_status IN ('pending', 'completed', 'failed', 'reversed')),
    received_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient
    ON invoices(hospital_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status
    ON invoices(hospital_id, invoice_status);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
    ON invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
    ON payments(invoice_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_hospital_date
    ON payments(hospital_id, paid_at DESC);

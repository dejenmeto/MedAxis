
-- 029_appointment_slots.sql
-- Creates appointment slots without modifying existing appointment records.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS appointment_slots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    hospital_id BIGINT NOT NULL
        REFERENCES hospitals(id) ON DELETE RESTRICT,

    doctor_staff_id BIGINT NOT NULL
        REFERENCES staff_profiles(id) ON DELETE RESTRICT,

    patient_id BIGINT
        REFERENCES patients(id) ON DELETE RESTRICT,

    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN (
            'available',
            'booked',
            'blocked',
            'cancelled'
        )),

    appointment_id BIGINT,
    notes TEXT,

    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT appointment_slots_valid_time
        CHECK (end_time > start_time),

    CONSTRAINT appointment_slots_booking_fields
        CHECK (
            (status <> 'booked')
            OR patient_id IS NOT NULL
        ),

    CONSTRAINT appointment_slots_doctor_no_overlap
        EXCLUDE USING gist (
            hospital_id WITH =,
            doctor_staff_id WITH =,
            slot_date WITH =,
            (tsrange(
                (slot_date + start_time),
                (slot_date + end_time),
                '[)'
            )) WITH &&
        )
        WHERE (status IN ('available', 'booked', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_hospital_date
    ON appointment_slots (hospital_id, slot_date);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_doctor_date
    ON appointment_slots (doctor_staff_id, slot_date);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_status
    ON appointment_slots (hospital_id, status, slot_date);

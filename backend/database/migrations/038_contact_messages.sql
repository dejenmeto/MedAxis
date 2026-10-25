
-- Contact form submissions for MedAxis
-- The existing Node migration runner manages transactions.

CREATE TABLE contact_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    hospital_id BIGINT NULL
        REFERENCES hospitals(id) ON DELETE SET NULL,

    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'read', 'in_progress', 'resolved', 'archived')),

    admin_notes TEXT NULL,
    read_at TIMESTAMPTZ NULL,
    resolved_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_created_at
    ON contact_messages (created_at DESC);

CREATE INDEX idx_contact_messages_status_created
    ON contact_messages (status, created_at DESC);

CREATE INDEX idx_contact_messages_email
    ON contact_messages (LOWER(email));

CREATE INDEX idx_contact_messages_hospital_created
    ON contact_messages (hospital_id, created_at DESC);

const pool = require("../config/database");

const adminRoles = ["super_admin", "hospital_admin"];
const portalRoles = ["patient", "guardian"];

function hospitalId(req) {
  const id = Number(req.user?.hospitalId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function userId(req) {
  const id = Number(req.user?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requireHospital(req, res) {
  const id = hospitalId(req);
  if (!id) {
    res.status(400).json({
      message: "Your account is not assigned to a hospital.",
    });
    return null;
  }
  return id;
}

function requireRole(req, res, roles) {
  if (!roles.includes(req.user?.role)) {
    res
      .status(403)
      .json({ message: "You are not allowed to access this resource." });
    return false;
  }
  return true;
}

async function tableColumns(table) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1`,
    [table],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function findTable(candidates, requiredColumns = []) {
  for (const table of candidates) {
    const columns = await tableColumns(table);
    if (
      columns.size &&
      requiredColumns.every((column) => columns.has(column))
    ) {
      return { table, columns };
    }
  }
  return null;
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error("Invalid database identifier.");
  }
  return `"${value}"`;
}

async function getApprovedPatients(req, hospital) {
  const result = await pool.query(
    `SELECT a.patient_id, a.relationship
     FROM patient_portal_access a
     WHERE a.hospital_id = $1
       AND a.portal_user_id = $2
       AND a.status = 'approved'
     ORDER BY a.created_at DESC`,
    [hospital, userId(req)],
  );

  return result.rows;
}

exports.dashboard = async (req, res) => {
  if (!requireRole(req, res, portalRoles)) return;

  const hospital = requireHospital(req, res);
  if (!hospital) return;

  try {
    const links = await getApprovedPatients(req, hospital);

    res.json({
      message: "Patient portal dashboard loaded.",
      patients: links.map((link) => ({
        patientId: link.patient_id,
        relationship: link.relationship,
      })),
      accessCount: links.length,
    });
  } catch (error) {
    console.error("Patient portal dashboard error:", error.message);
    res.status(500).json({ message: "Unable to load the patient portal." });
  }
};

// Admins use this endpoint to link a portal user to a patient.
// New links always start pending and require explicit approval.

exports.createAccess = async (req, res) => {
  if (!requireRole(req, res, adminRoles)) return;

  const hospital = requireHospital(req, res);
  if (!hospital) return;

  const portalUserId = Number(req.body.portalUserId);
  const patientId = Number(req.body.patientId);
  const relationship = req.body.relationship;

  if (
    !Number.isSafeInteger(portalUserId) ||
    portalUserId <= 0 ||
    !Number.isSafeInteger(patientId) ||
    patientId <= 0 ||
    !["self", "guardian"].includes(relationship)
  ) {
    return res.status(400).json({
      message: "Provide valid portal user, patient, and relationship values.",
    });
  }

  try {
    // Check the actual database columns before querying hospital_id.
    const patientColumns = await tableColumns("patients");
    const userColumns = await tableColumns("users");

    if (!patientColumns.has("hospital_id") || !userColumns.has("hospital_id")) {
      return res.status(409).json({
        message:
          "Portal access cannot be linked safely yet. The patients and users tables must have a valid hospital ownership relationship.",
      });
    }

    // Confirm that the patient belongs to this hospital.
    const patient = await pool.query(
      `SELECT id
       FROM patients
       WHERE id = $1 AND hospital_id = $2
       LIMIT 1`,
      [patientId, hospital],
    );

    if (!patient.rows.length) {
      return res.status(404).json({
        message: "Patient not found in this hospital.",
      });
    }

    // Confirm that the portal user belongs to this hospital.
    const portalUser = await pool.query(
      `SELECT id, role
       FROM users
       WHERE id = $1 AND hospital_id = $2
       LIMIT 1`,
      [portalUserId, hospital],
    );

    if (!portalUser.rows.length) {
      return res.status(404).json({
        message: "Portal user not found in this hospital.",
      });
    }

    if (!portalRoles.includes(portalUser.rows[0].role)) {
      return res.status(400).json({
        message: "The selected user must have the patient or guardian role.",
      });
    }

    // Create the access link or update an existing link.
    const result = await pool.query(
      `INSERT INTO patient_portal_access
        (hospital_id, portal_user_id, patient_id, relationship, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (hospital_id, portal_user_id, patient_id)
       DO UPDATE SET
         relationship = EXCLUDED.relationship,
         status = CASE
           WHEN patient_portal_access.status = 'approved'
             THEN patient_portal_access.status
           ELSE 'pending'
         END,
         updated_at = NOW()
       RETURNING *`,
      [hospital, portalUserId, patientId, relationship],
    );

    return res.status(201).json({
      message: "Portal access link created and awaiting approval.",
      access: result.rows[0],
    });
  } catch (error) {
    console.error("Create portal access error:", error.message);

    return res.status(500).json({
      message: "Unable to create portal access.",
    });
  }
};

exports.listAccess = async (req, res) => {
  if (!requireRole(req, res, adminRoles)) return;

  const hospital = requireHospital(req, res);
  if (!hospital) return;

  try {
    const result = await pool.query(
      `SELECT a.*, u.email AS portal_user_email
       FROM patient_portal_access a
       JOIN users u ON u.id = a.portal_user_id
       WHERE a.hospital_id = $1
       ORDER BY a.created_at DESC
       LIMIT 300`,
      [hospital],
    );

    res.json({ access: result.rows });
  } catch (error) {
    console.error("List portal access error:", error.message);
    res.status(500).json({ message: "Unable to load portal access links." });
  }
};

exports.updateAccessStatus = async (req, res) => {
  if (!requireRole(req, res, adminRoles)) return;

  const hospital = requireHospital(req, res);
  if (!hospital) return;

  const { status } = req.body;
  if (!["approved", "revoked", "pending"].includes(status)) {
    return res.status(400).json({ message: "Invalid access status." });
  }

  try {
    const result = await pool.query(
      `UPDATE patient_portal_access
       SET status = $1,
           approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE NULL END,
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3 AND hospital_id = $4
       RETURNING *`,
      [status, userId(req), req.params.id, hospital],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Access link not found." });
    }

    res.json({ access: result.rows[0] });
  } catch (error) {
    console.error("Update portal access error:", error.message);
    res.status(500).json({ message: "Unable to update portal access." });
  }
};

// Return records from a compatible existing table only.
// Each returned record must belong to an approved patient link.
exports.patientResource = async (req, res, resource) => {
  if (!requireRole(req, res, portalRoles)) return;

  const hospital = requireHospital(req, res);
  if (!hospital) return;

  const patientId = Number(req.params.patientId);
  if (!Number.isSafeInteger(patientId) || patientId <= 0) {
    return res.status(400).json({ message: "Invalid patient ID." });
  }

  try {
    const access = await pool.query(
      `SELECT 1
       FROM patient_portal_access
       WHERE hospital_id = $1 AND portal_user_id = $2
         AND patient_id = $3 AND status = 'approved'
       LIMIT 1`,
      [hospital, userId(req), patientId],
    );

    if (!access.rows.length) {
      return res.status(403).json({
        message:
          "You do not have approved access to this patient's information.",
      });
    }

    const configurations = {
      appointments: {
        tables: ["appointments"],
        patientColumns: ["patient_id"],
        dateColumns: ["appointment_date", "scheduled_at", "created_at"],
      },
      documents: {
        tables: ["medical_documents", "patient_documents"],
        patientColumns: ["patient_id"],
        dateColumns: ["created_at", "uploaded_at"],
      },
      reports: {
        tables: ["medical_reports", "patient_medical_reports"],
        patientColumns: ["patient_id"],
        dateColumns: ["created_at", "report_date"],
      },
      invoices: {
        tables: ["invoices"],
        patientColumns: ["patient_id"],
        dateColumns: ["created_at", "invoice_date"],
      },
      payments: {
        tables: ["payments"],
        patientColumns: ["patient_id"],
        dateColumns: ["created_at", "payment_date"],
      },
    };

    const config = configurations[resource];
    if (!config) {
      return res.status(400).json({ message: "Unsupported resource." });
    }

    const tableInfo = await findTable(config.tables, config.patientColumns);

    if (!tableInfo) {
      return res.json({
        records: [],
        unavailable: true,
        message: `No compatible ${resource} table was found.`,
      });
    }

    const { table, columns } = tableInfo;
    const patientColumn = config.patientColumns.find((column) =>
      columns.has(column),
    );

    const safeColumnsByResource = {
      appointments: [
        "id",
        "appointment_date",
        "scheduled_at",
        "status",
        "appointment_type",
        "reason",
        "created_at",
      ],
      documents: [
        "id",
        "title",
        "document_type",
        "file_name",
        "description",
        "created_at",
        "uploaded_at",
      ],
      reports: [
        "id",
        "title",
        "report_type",
        "status",
        "report_date",
        "created_at",
      ],
      invoices: [
        "id",
        "invoice_number",
        "status",
        "total_amount",
        "amount",
        "currency",
        "due_date",
        "invoice_date",
        "created_at",
      ],
      payments: [
        "id",
        "payment_reference",
        "transaction_reference",
        "amount",
        "currency",
        "status",
        "payment_date",
        "created_at",
      ],
    };

    const selectedColumns = safeColumnsByResource[resource].filter((column) =>
      columns.has(column),
    );

    if (!selectedColumns.includes("id")) {
      return res.json({
        records: [],
        unavailable: true,
        message: `The ${resource} table does not expose a compatible record ID.`,
      });
    }

    if (columns.has("hospital_id")) {
      const sql = `SELECT ${selectedColumns.map(quoteIdentifier).join(", ")}
        FROM ${quoteIdentifier(table)}
        WHERE ${quoteIdentifier(patientColumn)} = $1
          AND hospital_id = $2
        ORDER BY ${quoteIdentifier(
          config.dateColumns.find((column) => columns.has(column)) ||
            selectedColumns[0],
        )} DESC
        LIMIT 100`;

      const result = await pool.query(sql, [patientId, hospital]);
      return res.json({ records: result.rows });
    }

    // Never expose a table without a hospital column through this portal.
    return res.json({
      records: [],
      unavailable: true,
      message: `The ${resource} table has no hospital_id column; access is disabled until its tenant scope can be verified.`,
    });
  } catch (error) {
    console.error(`Portal ${resource} error:`, error.message);
    res.status(500).json({ message: `Unable to load ${resource}.` });
  }
};

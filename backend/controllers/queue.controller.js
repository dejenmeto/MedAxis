const { pool } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const ALLOWED_ROLES = [
  "super_admin",
  "hospital_admin",
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "radiologist",
];

const STATUSES = [
  "waiting",
  "called",
  "in_service",
  "completed",
  "skipped",
  "cancelled",
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

function getHospitalId(req) {
  const { role, hospitalId } = req.user || {};

  if (hospitalId) return String(hospitalId);

  if (role === "super_admin" && req.body?.hospitalId) {
    return String(req.body.hospitalId);
  }

  const error = new Error("A hospital must be selected for this operation.");
  error.statusCode = 400;
  throw error;
}

function ensureHospitalScope(req, res, next) {
  const { role, hospitalId } = req.user || {};

  if (role === "super_admin" || hospitalId) {
    return next();
  }

  return res.status(403).json({
    message: "Your account is not assigned to a hospital.",
  });
}

function validateText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }

  if (value.trim().length > maxLength) {
    const error = new Error(
      `${label} must be ${maxLength} characters or fewer.`,
    );
    error.statusCode = 400;
    throw error;
  }

  return value.trim();
}

function validateOptionalId(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (!/^\d+$/.test(String(value)) || Number(value) <= 0) {
    const error = new Error(`${label} must be a valid positive ID.`);
    error.statusCode = 400;
    throw error;
  }

  return String(value);
}

function getScopedHospitalId(req) {
  const { role, hospitalId } = req.user || {};

  if (hospitalId) return String(hospitalId);

  if (role === "super_admin") {
    return validateOptionalId(req.query.hospitalId, "Hospital ID");
  }

  return null;
}

function canUseHospital(req, requestedHospitalId) {
  const { role, hospitalId } = req.user || {};

  if (role === "super_admin") return true;

  return hospitalId && String(hospitalId) === String(requestedHospitalId);
}

function validateStatus(status) {
  if (!STATUSES.includes(status)) {
    const error = new Error("Invalid queue status.");
    error.statusCode = 400;
    throw error;
  }
  return status;
}

function validatePriority(priority) {
  if (!PRIORITIES.includes(priority)) {
    const error = new Error("Invalid queue priority.");
    error.statusCode = 400;
    throw error;
  }
  return priority;
}

function getDateFilter(value) {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error("Date must use YYYY-MM-DD format.");
    error.statusCode = 400;
    throw error;
  }

  return value;
}

// GET /api/queue
exports.listQueue = asyncHandler(async (req, res) => {
  const hospitalId = getScopedHospitalId(req);

  if (!hospitalId) {
    return res.status(400).json({
      message: "Select a hospital to view its queue.",
    });
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  const offset = (page - 1) * limit;

  const search = String(req.query.search || "").trim();
  const department = String(req.query.department || "").trim();
  const status = String(req.query.status || "").trim();
  const priority = String(req.query.priority || "").trim();
  const date = getDateFilter(req.query.date) || null;

  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status filter." });
  }

  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: "Invalid priority filter." });
  }

  const conditions = ["q.hospital_id = $1"];
  const values = [hospitalId];

  function addCondition(sql, value) {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  }

  if (date) addCondition("q.queue_date = ?::date", date);
  if (department) {
    addCondition("q.department ILIKE ?", `%${department}%`);
  }
  if (status) addCondition("q.status = ?", status);
  if (priority) addCondition("q.priority = ?", priority);

  if (search) {
    values.push(`%${search}%`);
    const n = values.length;
    conditions.push(
      `(q.queue_code ILIKE $${n}
        OR q.department ILIKE $${n}
        OR q.patient_id::text ILIKE $${n}
        OR q.queue_number::text ILIKE $${n})`,
    );
  }

  const where = conditions.join(" AND ");

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT q.*
       FROM patient_queue q
       WHERE ${where}
       ORDER BY
         CASE q.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'normal' THEN 3
           ELSE 4
         END,
         q.queue_date DESC,
         q.queue_number ASC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM patient_queue q
       WHERE ${where}`,
      values,
    ),
  ]);

  const total = countResult.rows[0].total;

  res.json({
    data: rowsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/queue/dashboard?date=YYYY-MM-DD
exports.getDashboard = asyncHandler(async (req, res) => {
  const hospitalId = getScopedHospitalId(req);

  if (!hospitalId) {
    return res.status(400).json({
      message: "Select a hospital to view queue statistics.",
    });
  }

  const date = getDateFilter(req.query.date);

  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
       COUNT(*) FILTER (WHERE status = 'called')::int AS called,
       COUNT(*) FILTER (WHERE status = 'in_service')::int AS in_service,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
       COUNT(*) FILTER (WHERE priority = 'urgent'
         AND status IN ('waiting', 'called', 'in_service'))::int
         AS urgent_active
     FROM patient_queue
     WHERE hospital_id = $1
       AND queue_date = COALESCE($2::date, CURRENT_DATE)`,
    [hospitalId, date],
  );

  res.json({ data: result.rows[0] });
});

// POST /api/queue
exports.createQueueEntry = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);

  if (!canUseHospital(req, hospitalId)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const patientId = validateOptionalId(req.body.patientId, "Patient ID");

  if (!patientId) {
    return res.status(400).json({ message: "Patient ID is required." });
  }

  const department = validateText(req.body.department, "Department", 120);
  const priority = validatePriority(req.body.priority || "normal");
  const notes = String(req.body.notes || "").trim() || null;
  const assignedTo = validateOptionalId(
    req.body.assignedTo,
    "Assigned staff ID",
  );

  // Confirm the patient belongs to the selected hospital.
  // The hospital relationship is checked dynamically because patient
  // schemas may differ between hospital deployments.
  const patientColumns = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'patients'`,
  );

  const patientColumnNames = new Set(
    patientColumns.rows.map((row) => row.column_name),
  );

  if (!patientColumnNames.has("id")) {
    return res.status(500).json({
      message: "The patients table does not have the expected ID column.",
    });
  }

  let patientCheck;

  if (patientColumnNames.has("hospital_id")) {
    patientCheck = await pool.query(
      "SELECT id FROM patients WHERE id = $1 AND hospital_id = $2",
      [patientId, hospitalId],
    );
  } else {
    // Legacy patient tables without hospital_id cannot be safely
    // cross-checked by hospital; still verify the patient exists.
    patientCheck = await pool.query("SELECT id FROM patients WHERE id = $1", [
      patientId,
    ]);
  }

  if (!patientCheck.rowCount) {
    return res.status(404).json({
      message: "Patient not found for this hospital.",
    });
  }

  if (assignedTo) {
    const staffCheck = await pool.query("SELECT id FROM users WHERE id = $1", [
      assignedTo,
    ]);

    if (!staffCheck.rowCount) {
      return res.status(400).json({
        message: "Assigned staff account was not found.",
      });
    }
  }

  // A transaction and advisory lock prevent concurrent registrations
  // from receiving the same daily queue number.
  const client = await pool.connect();

  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext(CURRENT_DATE::text))",
      [hospitalId],
    );

    const numberResult = await client.query(
      `SELECT COALESCE(MAX(queue_number), 0)::int + 1 AS next_number
       FROM patient_queue
       WHERE hospital_id = $1
         AND queue_date = CURRENT_DATE`,
      [hospitalId],
    );

    const queueNumber = numberResult.rows[0].next_number;
    const queueCode = `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(queueNumber).padStart(3, "0")}`;

    const inserted = await client.query(
      `INSERT INTO patient_queue (
         hospital_id, patient_id, queue_date, queue_number,
         queue_code, department, priority, status, assigned_to,
         notes, created_by
       )
       VALUES (
         $1, $2, CURRENT_DATE, $3, $4, $5, $6, 'waiting',
         $7, $8, $9
       )
       RETURNING *`,
      [
        hospitalId,
        patientId,
        queueNumber,
        queueCode,
        department,
        priority,
        assignedTo,
        notes,
        req.user.id,
      ],
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Patient added to the queue successfully.",
      data: inserted.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// PUT /api/queue/:id
exports.updateQueueEntry = asyncHandler(async (req, res) => {
  const hospitalId = getScopedHospitalId(req);

  if (!hospitalId) {
    return res.status(400).json({ message: "Select a hospital first." });
  }

  const { id } = req.params;
  const department = validateText(req.body.department, "Department", 120);
  const priority = validatePriority(req.body.priority);
  const assignedTo = validateOptionalId(
    req.body.assignedTo,
    "Assigned staff ID",
  );
  const notes = String(req.body.notes || "").trim() || null;

  const result = await pool.query(
    `UPDATE patient_queue
     SET department = $1,
         priority = $2,
         assigned_to = $3,
         notes = $4,
         updated_at = NOW()
     WHERE id = $5 AND hospital_id = $6
       AND status NOT IN ('completed', 'cancelled')
     RETURNING *`,
    [department, priority, assignedTo, notes, id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      message: "Active queue entry not found.",
    });
  }

  res.json({
    message: "Queue entry updated successfully.",
    data: result.rows[0],
  });
});

// PATCH /api/queue/:id/status
exports.updateQueueStatus = asyncHandler(async (req, res) => {
  const hospitalId = getScopedHospitalId(req);

  if (!hospitalId) {
    return res.status(400).json({ message: "Select a hospital first." });
  }

  const status = validateStatus(req.body.status);

  const result = await pool.query(
    `UPDATE patient_queue
     SET status = $1,
         called_at = CASE
           WHEN $1 = 'called' AND called_at IS NULL THEN NOW()
           ELSE called_at
         END,
         service_started_at = CASE
           WHEN $1 = 'in_service' AND service_started_at IS NULL THEN NOW()
           ELSE service_started_at
         END,
         completed_at = CASE
           WHEN $1 = 'completed' THEN NOW()
           WHEN $1 <> 'completed' THEN NULL
           ELSE completed_at
         END,
         updated_at = NOW()
     WHERE id = $2 AND hospital_id = $3
     RETURNING *`,
    [status, req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({ message: "Queue entry not found." });
  }

  res.json({
    message: "Queue status updated successfully.",
    data: result.rows[0],
  });
});

// DELETE /api/queue/:id
// Cancellation is a soft delete so the queue history is preserved.
exports.cancelQueueEntry = asyncHandler(async (req, res) => {
  const hospitalId = getScopedHospitalId(req);

  if (!hospitalId) {
    return res.status(400).json({ message: "Select a hospital first." });
  }

  const result = await pool.query(
    `UPDATE patient_queue
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
       AND status NOT IN ('completed', 'cancelled')
     RETURNING id`,
    [req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      message: "Active queue entry not found.",
    });
  }

  res.json({ message: "Queue entry cancelled successfully." });
});

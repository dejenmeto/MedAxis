const { pool } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const ALLOWED_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "overdue",
  "waived",
];

const ALLOWED_PRIORITIES = ["low", "medium", "high", "critical"];

function getHospitalId(req, res) {
  const id = req.user?.hospitalId;

  if (!id) {
    res.status(400).json({
      success: false,
      message: "A hospital must be associated with your account.",
    });
    return null;
  }

  return id;
}

function getUserId(req) {
  return req.user?.id || null;
}

function parsePagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );

  return { page, limit, offset: (page - 1) * limit };
}

function sendError(res, error) {
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A conflicting record already exists.",
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "A referenced user or hospital does not exist.",
    });
  }

  if (error.code === "22P02" || error.code === "22007") {
    return res.status(400).json({
      success: false,
      message: "One or more supplied values are invalid.",
    });
  }

  console.error("Audit & Compliance error:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected Audit & Compliance error occurred.",
  });
}

// GET /api/audit-compliance/summary
exports.summary = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const [checks, logs] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (
           WHERE due_date < CURRENT_DATE
             AND status NOT IN ('completed', 'waived')
         )::int AS overdue
       FROM compliance_checks
       WHERE hospital_id = $1`,
      [hospitalId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs
       WHERE hospital_id = $1`,
      [hospitalId],
    ),
  ]);

  res.json({
    success: true,
    data: {
      compliance: checks.rows[0],
      auditEvents: logs.rows[0].total,
    },
  });
});

// GET /api/audit-compliance/logs
// Audit logs are read-only through this API.
exports.listLogs = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const { page, limit, offset } = parsePagination(req);
  const search = String(req.query.search || "").trim();
  const action = String(req.query.action || "").trim();
  const entityType = String(req.query.entity_type || "").trim();

  const conditions = ["hospital_id = $1"];
  const values = [hospitalId];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(action ILIKE $${values.length}
        OR entity_type ILIKE $${values.length}
        OR entity_id::text ILIKE $${values.length}
        OR user_id::text ILIKE $${values.length})`,
    );
  }

  if (action) {
    values.push(action);
    conditions.push(`action = $${values.length}`);
  }

  if (entityType) {
    values.push(entityType);
    conditions.push(`entity_type = $${values.length}`);
  }

  const where = conditions.join(" AND ");

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT
         id, user_id, action, entity_type, entity_id,
         old_values, new_values, ip_address, user_agent, created_at
       FROM audit_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs
       WHERE ${where}`,
      values,
    ),
  ]);

  res.json({
    success: true,
    data: rows.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  });
});

// GET /api/audit-compliance/checks
exports.listChecks = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const { page, limit, offset } = parsePagination(req);
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();
  const priority = String(req.query.priority || "").trim();

  const conditions = ["c.hospital_id = $1"];
  const values = [hospitalId];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(c.title ILIKE $${values.length}
        OR c.category ILIKE $${values.length}
        OR COALESCE(c.description, '') ILIKE $${values.length})`,
    );
  }

  if (status && ALLOWED_STATUSES.includes(status)) {
    values.push(status);
    conditions.push(`c.status = $${values.length}`);
  }

  if (priority && ALLOWED_PRIORITIES.includes(priority)) {
    values.push(priority);
    conditions.push(`c.priority = $${values.length}`);
  }

  const where = conditions.join(" AND ");

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT
         c.id, c.title, c.category, c.description, c.status,
         c.priority, c.due_date, c.assigned_to, c.notes,
         c.created_by, c.completed_at, c.created_at, c.updated_at
       FROM compliance_checks c
       WHERE ${where}
       ORDER BY
         CASE WHEN c.due_date < CURRENT_DATE
                   AND c.status NOT IN ('completed', 'waived')
              THEN 0 ELSE 1 END,
         c.due_date ASC NULLS LAST,
         c.created_at DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM compliance_checks c
       WHERE ${where}`,
      values,
    ),
  ]);

  res.json({
    success: true,
    data: rows.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  });
});

// POST /api/audit-compliance/checks
exports.createCheck = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const {
    title,
    category,
    description = null,
    status = "pending",
    priority = "medium",
    due_date = null,
    assigned_to = null,
    notes = null,
  } = req.body;

  if (!String(title || "").trim() || !String(category || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "Title and category are required.",
    });
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid compliance status.",
    });
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid priority.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO compliance_checks (
         hospital_id, title, category, description, status,
         priority, due_date, assigned_to, notes, created_by,
         completed_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         CASE WHEN $5::varchar = 'completed' THEN NOW() ELSE NULL END
       )
       RETURNING *`,
      [
        hospitalId,
        String(title).trim(),
        String(category).trim(),
        description,
        status,
        priority,
        due_date || null,
        assigned_to || null,
        notes,
        getUserId(req),
      ],
    );

    res.status(201).json({
      success: true,
      message: "Compliance check created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
});

// PUT /api/audit-compliance/checks/:id
exports.updateCheck = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const {
    title,
    category,
    description,
    status,
    priority,
    due_date,
    assigned_to,
    notes,
  } = req.body;

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid compliance status.",
    });
  }

  if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid priority.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE compliance_checks
       SET
         title = COALESCE($3, title),
         category = COALESCE($4, category),
         description = COALESCE($5, description),
         status = COALESCE($6, status),
         priority = COALESCE($7, priority),
         due_date = CASE WHEN $8::boolean THEN $9::date ELSE due_date END,
         assigned_to = CASE WHEN $10::boolean THEN $11::bigint ELSE assigned_to END,
         notes = COALESCE($12, notes),
         completed_at = CASE
           WHEN COALESCE($6, status) = 'completed'
             THEN COALESCE(completed_at, NOW())
           WHEN COALESCE($6, status) <> 'completed'
             THEN NULL
           ELSE completed_at
         END,
         updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2
       RETURNING *`,
      [
        req.params.id,
        hospitalId,
        title === undefined ? null : String(title).trim(),
        category === undefined ? null : String(category).trim(),
        description === undefined ? null : description,
        status === undefined ? null : status,
        priority === undefined ? null : priority,
        due_date !== undefined,
        due_date || null,
        assigned_to !== undefined,
        assigned_to || null,
        notes === undefined ? null : notes,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Compliance check not found.",
      });
    }

    res.json({
      success: true,
      message: "Compliance check updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
});

// DELETE /api/audit-compliance/checks/:id
exports.deleteCheck = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const result = await pool.query(
    `DELETE FROM compliance_checks
     WHERE id = $1 AND hospital_id = $2
     RETURNING id`,
    [req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Compliance check not found.",
    });
  }

  res.json({
    success: true,
    message: "Compliance check deleted successfully.",
  });
});

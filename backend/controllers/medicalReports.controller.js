const crypto = require("crypto");
const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const REPORT_TYPES = [
  "general",
  "laboratory",
  "radiology",
  "discharge",
  "surgical",
  "consultation",
  "referral",
  "other",
];

const WRITABLE_ROLES = [
  "super_admin",
  "hospital_admin",
  "doctor",
  "nurse",
  "lab_technician",
  "radiologist",
];

function hospitalId(req) {
  const id = req.user?.hospitalId;
  if (!id) {
    const error = new Error("Your account is not linked to a hospital.");
    error.statusCode = 403;
    throw error;
  }
  return id;
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function canWrite(req) {
  if (!WRITABLE_ROLES.includes(req.user?.role)) {
    throw httpError(
      "You do not have permission to modify medical reports.",
      403,
    );
  }
}

function validateReport(body, partial = false) {
  const { report_type, title, findings, impression, report_date } = body;

  if (!partial || report_type !== undefined) {
    if (!REPORT_TYPES.includes(report_type)) {
      throw httpError("Select a valid report type.");
    }
  }

  if (!partial || title !== undefined) {
    if (!String(title || "").trim())
      throw httpError("Report title is required.");
  }

  if (!partial || findings !== undefined) {
    if (!String(findings || "").trim())
      throw httpError("Report findings are required.");
  }

  if (!partial || impression !== undefined) {
    if (!String(impression || "").trim()) {
      throw httpError("Report impression is required.");
    }
  }

  if (report_date && Number.isNaN(Date.parse(report_date))) {
    throw httpError("Enter a valid report date.");
  }
}

exports.listReports = asyncHandler(async (req, res) => {
  const hid = hospitalId(req);
  const values = [hid];
  const conditions = ["r.hospital_id = $1"];

  const search = String(req.query.search || "").trim();
  if (search) {
    values.push(`%${search}%`);
    const p = `$${values.length}`;
    conditions.push(
      `(r.report_code ILIKE ${p} OR r.title ILIKE ${p} OR r.report_type ILIKE ${p} OR CAST(r.patient_id AS TEXT) ILIKE ${p})`,
    );
  }

  if (req.query.type && REPORT_TYPES.includes(req.query.type)) {
    values.push(req.query.type);
    conditions.push(`r.report_type = $${values.length}`);
  }

  if (req.query.status === "draft" || req.query.status === "final") {
    values.push(req.query.status);
    conditions.push(`r.status = $${values.length}`);
  }

  if (req.query.patientId) {
    values.push(req.query.patientId);
    conditions.push(`r.patient_id = $${values.length}`);
  }

  const archived = req.query.archived === "true";
  conditions.push(`r.is_archived = ${archived}`);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const where = conditions.join(" AND ");

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM medical_reports r WHERE ${where}`,
    values,
  );

  values.push(limit, (page - 1) * limit);
  const result = await pool.query(
    `SELECT r.*
       FROM medical_reports r
      WHERE ${where}
      ORDER BY r.report_date DESC, r.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  res.json({
    data: result.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  });
});

exports.getReport = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM medical_reports
      WHERE id = $1 AND hospital_id = $2`,
    [req.params.id, hospitalId(req)],
  );

  if (!result.rows.length) throw httpError("Medical report not found.", 404);
  res.json({ data: result.rows[0] });
});

exports.createReport = asyncHandler(async (req, res) => {
  canWrite(req);
  const hid = hospitalId(req);
  validateReport(req.body);

  const patient = await pool.query(
    "SELECT id FROM patients WHERE id = $1 AND hospital_id = $2",
    [req.body.patient_id, hid],
  );

  if (!patient.rows.length)
    throw httpError("Patient not found in your hospital.", 404);

  const reportCode = `MR-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const result = await pool.query(
    `INSERT INTO medical_reports (
       hospital_id, patient_id, report_code, report_type, title,
       clinical_history, findings, impression, recommendations,
       report_date, prepared_by
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       COALESCE($10::date, CURRENT_DATE), $11
     )
     RETURNING *`,
    [
      hid,
      req.body.patient_id,
      reportCode,
      req.body.report_type,
      String(req.body.title).trim(),
      req.body.clinical_history || null,
      String(req.body.findings).trim(),
      String(req.body.impression).trim(),
      req.body.recommendations || null,
      req.body.report_date || null,
      req.user.id,
    ],
  );

  res
    .status(201)
    .json({ message: "Medical report created.", data: result.rows[0] });
});

exports.updateReport = asyncHandler(async (req, res) => {
  canWrite(req);
  validateReport(req.body, true);

  const current = await pool.query(
    `SELECT * FROM medical_reports
      WHERE id = $1 AND hospital_id = $2 AND is_archived = FALSE`,
    [req.params.id, hospitalId(req)],
  );

  if (!current.rows.length) throw httpError("Medical report not found.", 404);

  if (current.rows[0].status === "final") {
    throw httpError(
      "Final reports cannot be edited. Create a new report if a correction is required.",
      409,
    );
  }

  const old = current.rows[0];
  const b = req.body;

  const result = await pool.query(
    `UPDATE medical_reports SET
       report_type = $3,
       title = $4,
       clinical_history = $5,
       findings = $6,
       impression = $7,
       recommendations = $8,
       report_date = $9,
       updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
     RETURNING *`,
    [
      req.params.id,
      hospitalId(req),
      b.report_type ?? old.report_type,
      b.title === undefined ? old.title : String(b.title).trim(),
      b.clinical_history === undefined
        ? old.clinical_history
        : b.clinical_history || null,
      b.findings === undefined ? old.findings : String(b.findings).trim(),
      b.impression === undefined ? old.impression : String(b.impression).trim(),
      b.recommendations === undefined
        ? old.recommendations
        : b.recommendations || null,
      b.report_date === undefined ? old.report_date : b.report_date || null,
    ],
  );

  res.json({ message: "Medical report updated.", data: result.rows[0] });
});

exports.finalizeReport = asyncHandler(async (req, res) => {
  canWrite(req);

  const result = await pool.query(
    `UPDATE medical_reports
        SET status = 'final', finalized_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND hospital_id = $2
        AND is_archived = FALSE AND status = 'draft'
      RETURNING *`,
    [req.params.id, hospitalId(req)],
  );

  if (!result.rows.length) {
    throw httpError(
      "Draft report not found, or it has already been finalized.",
      409,
    );
  }

  res.json({ message: "Report finalized.", data: result.rows[0] });
});

exports.archiveReport = asyncHandler(async (req, res) => {
  canWrite(req);

  const result = await pool.query(
    `UPDATE medical_reports
        SET is_archived = TRUE, archived_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND hospital_id = $2 AND is_archived = FALSE
      RETURNING id`,
    [req.params.id, hospitalId(req)],
  );

  if (!result.rows.length) throw httpError("Report not found.", 404);
  res.json({ message: "Medical report archived." });
});

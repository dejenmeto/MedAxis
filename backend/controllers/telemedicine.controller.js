const crypto = require("crypto");
const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

const MODES = ["video", "phone"];

const getHospitalId = (req) => {
  const id = req.user?.hospitalId;

  if (!id) {
    const error = new Error("Your account is not assigned to a hospital.");
    error.statusCode = 403;
    throw error;
  }

  return id;
};

const getActorId = (req) => req.user?.id || null;

const canManageAll = (req) =>
  ["super_admin", "hospital_admin", "receptionist"].includes(req.user?.role);

const canWriteConsultation = (req) =>
  ["super_admin", "hospital_admin", "doctor", "receptionist"].includes(
    req.user?.role,
  );

const handleError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const listConsultations = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);
  const {
    search = "",
    status = "",
    doctorId = "",
    patientId = "",
    from = "",
    to = "",
    page = "1",
    limit = "10",
  } = req.query;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));

  const conditions = ["c.hospital_id = $1"];
  const values = [hospitalId];

  const addFilter = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (search.trim()) {
    values.push(`%${search.trim()}%`);
    const p = `$${values.length}`;
    conditions.push(
      `(c.consultation_code ILIKE ${p}
        OR COALESCE(c.patient_name, '') ILIKE ${p}
        OR COALESCE(c.doctor_name, '') ILIKE ${p})`,
    );
  }

  if (status && STATUSES.includes(status)) {
    addFilter("c.status = ?", status);
  }

  if (doctorId) {
    addFilter("c.doctor_staff_id = ?", doctorId);
  }

  if (patientId) {
    addFilter("c.patient_id = ?", patientId);
  }

  if (from) {
    addFilter("c.scheduled_at >= ?::date", from);
  }

  if (to) {
    addFilter("c.scheduled_at < (?::date + INTERVAL '1 day')", to);
  }

  // Doctors see only consultations assigned to their staff record.
  // This assumes req.user.id maps to staff_profiles.id for doctor accounts.
  if (req.user.role === "doctor") {
    addFilter("c.doctor_staff_id = ?", req.user.id);
  }

  const where = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM telemedicine_consultations c
     WHERE ${where}`,
    values,
  );

  const total = countResult.rows[0].total;

  const dataValues = [...values, pageSize, (pageNumber - 1) * pageSize];

  const result = await pool.query(
    `SELECT c.*
     FROM telemedicine_consultations c
     WHERE ${where}
     ORDER BY c.scheduled_at DESC, c.id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    dataValues,
  );

  res.json({
    data: result.rows,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);

  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (
         WHERE status IN ('scheduled', 'confirmed')
           AND scheduled_at >= NOW()
       )::int AS upcoming,
       COUNT(*) FILTER (
         WHERE status = 'in_progress'
       )::int AS in_progress,
       COUNT(*) FILTER (
         WHERE status = 'completed'
       )::int AS completed,
       COUNT(*) FILTER (
         WHERE status = 'cancelled'
       )::int AS cancelled
     FROM telemedicine_consultations
     WHERE hospital_id = $1`,
    [hospitalId],
  );

  res.json(result.rows[0]);
});

const createConsultation = asyncHandler(async (req, res) => {
  if (!canWriteConsultation(req)) {
    throw handleError("You are not authorized to schedule consultations.", 403);
  }

  const hospitalId = getHospitalId(req);
  const {
    patient_id,
    doctor_staff_id,
    patient_name,
    doctor_name,
    consultation_mode = "video",
    scheduled_at,
    duration_minutes = 30,
    meeting_url,
  } = req.body;

  if (!patient_id || !doctor_staff_id || !scheduled_at) {
    throw handleError("Patient, doctor, and scheduled date are required.");
  }

  if (!MODES.includes(consultation_mode)) {
    throw handleError("Invalid consultation mode.");
  }

  const date = new Date(scheduled_at);
  if (Number.isNaN(date.getTime())) {
    throw handleError("Please provide a valid consultation date.");
  }

  const duration = Number(duration_minutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    throw handleError("Duration must be between 5 and 240 minutes.");
  }

  // Verify that the patient and doctor belong to this hospital.
  const [patientResult, doctorResult] = await Promise.all([
    pool.query("SELECT id FROM patients WHERE id = $1 AND hospital_id = $2", [
      patient_id,
      hospitalId,
    ]),
    pool.query(
      `SELECT id
   FROM staff_profiles
   WHERE id = $1
     AND hospital_id = $2`,
      [doctor_staff_id, hospitalId],
    ),
  ]);

  if (!patientResult.rowCount) {
    throw handleError("Patient not found in this hospital.", 404);
  }

  if (!doctorResult.rowCount) {
    throw handleError("Doctor/staff record not found in this hospital.", 404);
  }

  const code = `TM-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  const result = await pool.query(
    `INSERT INTO telemedicine_consultations (
       hospital_id, consultation_code, patient_id, doctor_staff_id,
       patient_name, doctor_name, consultation_mode, scheduled_at,
       duration_minutes, meeting_url, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      hospitalId,
      code,
      patient_id,
      doctor_staff_id,
      patient_name || null,
      doctor_name || null,
      consultation_mode,
      date.toISOString(),
      duration,
      meeting_url || null,
      getActorId(req),
    ],
  );

  res.status(201).json({
    message: "Telemedicine consultation scheduled successfully.",
    data: result.rows[0],
  });
});

const updateConsultation = asyncHandler(async (req, res) => {
  if (!canWriteConsultation(req)) {
    throw handleError("You are not authorized to edit consultations.", 403);
  }

  const hospitalId = getHospitalId(req);
  const { id } = req.params;
  const {
    consultation_mode,
    scheduled_at,
    duration_minutes,
    meeting_url,
    consultation_notes,
    follow_up_instructions,
  } = req.body;

  if (consultation_mode && !MODES.includes(consultation_mode)) {
    throw handleError("Invalid consultation mode.");
  }

  if (duration_minutes !== undefined) {
    const duration = Number(duration_minutes);
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      throw handleError("Duration must be between 5 and 240 minutes.");
    }
  }

  const result = await pool.query(
    `UPDATE telemedicine_consultations
     SET consultation_mode = COALESCE($1, consultation_mode),
         scheduled_at = COALESCE($2::timestamptz, scheduled_at),
         duration_minutes = COALESCE($3::int, duration_minutes),
         meeting_url = COALESCE($4, meeting_url),
         consultation_notes = COALESCE($5, consultation_notes),
         follow_up_instructions = COALESCE($6, follow_up_instructions),
         updated_by = $7,
         updated_at = NOW()
     WHERE id = $8 AND hospital_id = $9
       AND status NOT IN ('completed', 'cancelled')
     RETURNING *`,
    [
      consultation_mode || null,
      scheduled_at || null,
      duration_minutes ?? null,
      meeting_url ?? null,
      consultation_notes ?? null,
      follow_up_instructions ?? null,
      getActorId(req),
      id,
      hospitalId,
    ],
  );

  if (!result.rowCount) {
    throw handleError(
      "Consultation not found or it can no longer be edited.",
      404,
    );
  }

  res.json({
    message: "Consultation updated successfully.",
    data: result.rows[0],
  });
});

const updateConsultationStatus = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    throw handleError("Invalid consultation status.");
  }

  const result = await pool.query(
    `UPDATE telemedicine_consultations
     SET status = $1,
         updated_by = $2,
         updated_at = NOW()
     WHERE id = $3 AND hospital_id = $4
     RETURNING *`,
    [status, getActorId(req), id, hospitalId],
  );

  if (!result.rowCount) {
    throw handleError("Consultation not found.", 404);
  }

  res.json({
    message: "Consultation status updated successfully.",
    data: result.rows[0],
  });
});

module.exports = {
  listConsultations,
  getDashboard,
  createConsultation,
  updateConsultation,
  updateConsultationStatus,
};

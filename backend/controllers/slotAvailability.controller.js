const pool = require("../config/database");

const SLOT_STATUSES = ["available", "booked", "blocked", "cancelled"];

const MANAGE_ROLES = ["super_admin", "hospital_admin", "receptionist"];

const READ_ROLES = [...MANAGE_ROLES, "doctor", "nurse"];

// This module expects your authenticate middleware to set req.user.
function requireUser(req, res) {
  if (!req.user?.id || !req.user?.role) {
    res.status(401).json({ message: "Authentication required." });
    return false;
  }

  return true;
}

function canManage(req) {
  return MANAGE_ROLES.includes(req.user?.role);
}

function getHospitalId(req) {
  return req.user?.hospitalId || null;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value || ""));
}

function handleDatabaseError(error, res) {
  // PostgreSQL exclusion constraint: overlapping slots.
  if (error.code === "23P01") {
    return res.status(409).json({
      message: "This doctor already has an overlapping slot.",
    });
  }

  // Foreign key violation.
  if (error.code === "23503") {
    return res.status(400).json({
      message:
        "A selected hospital, doctor, patient, or user record does not exist.",
    });
  }

  // Check constraint violation.
  if (error.code === "23514") {
    return res.status(400).json({
      message: "The slot data does not satisfy the database rules.",
    });
  }

  console.error("Slot availability error:", error);

  return res.status(500).json({
    message: "An unexpected error occurred while processing the slot.",
  });
}

// GET /api/slot-availability
async function listSlots(req, res) {
  if (!requireUser(req, res)) return;

  if (!READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const {
    date,
    from,
    to,
    doctor_staff_id,
    status,
    page = "1",
    limit = "20",
  } = req.query;

  if (date && !isValidDate(date)) {
    return res.status(400).json({ message: "Invalid date format." });
  }

  if (status && !SLOT_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid slot status." });
  }

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const offset = (pageNumber - 1) * pageSize;

  const values = [];
  const conditions = [];

  function addCondition(sql, value) {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  }

  const hospitalId = getHospitalId(req);

  if (hospitalId) {
    addCondition("s.hospital_id = ?", hospitalId);
  }

  // A doctor can see only their own slots when their staff ID is supplied
  // through the authenticated account mapping.
  if (req.user.role === "doctor") {
    const staffResult = await pool.query(
      `SELECT id
       FROM staff_profiles
       WHERE user_id = $1
         AND ($2::bigint IS NULL OR hospital_id = $2)
       LIMIT 1`,
      [req.user.id, hospitalId],
    );

    if (!staffResult.rows.length) {
      return res.json({
        data: [],
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: 0,
          pages: 0,
        },
      });
    }

    addCondition("s.doctor_staff_id = ?", staffResult.rows[0].id);
  } else if (doctor_staff_id) {
    addCondition("s.doctor_staff_id = ?", doctor_staff_id);
  }

  if (date) addCondition("s.slot_date = ?::date", date);
  if (from) addCondition("s.slot_date >= ?::date", from);
  if (to) addCondition("s.slot_date <= ?::date", to);
  if (status) addCondition("s.status = ?", status);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM appointment_slots s
     ${whereClause}`,
    values,
  );

  const total = countResult.rows[0].total;

  const listValues = [...values, pageSize, offset];

  const result = await pool.query(
    `SELECT
       s.id,
       s.hospital_id,
       s.doctor_staff_id,
       s.patient_id,
       s.slot_date,
       s.start_time,
       s.end_time,
       s.status,
       s.notes,
       s.created_at,
       s.updated_at,
       CONCAT_WS(' ', u.first_name, u.last_name) AS doctor_name
     FROM appointment_slots s
     LEFT JOIN staff_profiles sp ON sp.id = s.doctor_staff_id
     LEFT JOIN users u ON u.id = sp.user_id
     ${whereClause}
     ORDER BY s.slot_date DESC, s.start_time ASC
     LIMIT $${listValues.length - 1}
     OFFSET $${listValues.length}`,
    listValues,
  );

  return res.json({
    data: result.rows,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    },
  });
}

// POST /api/slot-availability

async function createSlot(req, res) {
  if (!requireUser(req, res)) return;

  if (!canManage(req)) {
    return res.status(403).json({
      message: "You do not have permission to create slots.",
    });
  }

  const {
    doctor_staff_id,
    slot_date,
    start_time,
    end_time,
    status = "available",
    notes = "",
  } = req.body;

  if (
    !doctor_staff_id ||
    !/^\d+$/.test(String(doctor_staff_id)) ||
    !isValidDate(slot_date) ||
    !isValidTime(start_time) ||
    !isValidTime(end_time)
  ) {
    return res.status(400).json({
      message:
        "Invalid or missing doctor staff ID, date, start time, or end time.",
      received: {
        doctor_staff_id: doctor_staff_id ?? null,
        slot_date: slot_date ?? null,
        start_time: start_time ?? null,
        end_time: end_time ?? null,
      },
    });
  }

  if (
    !SLOT_STATUSES.includes(status) ||
    !["available", "blocked"].includes(status)
  ) {
    return res.status(400).json({
      message: "New slots can only be available or blocked.",
      receivedStatus: status,
    });
  }

  if (end_time <= start_time) {
    return res.status(400).json({
      message: "End time must be later than start time.",
    });
  }
}

// Keep the remainder of your existing createSlot function unchanged.

// PATCH /api/slot-availability/:id
async function updateSlot(req, res) {
  if (!requireUser(req, res)) return;

  if (!canManage(req)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const { id } = req.params;
  const { slot_date, start_time, end_time, status, notes = "" } = req.body;

  if (
    !isValidDate(slot_date) ||
    !isValidTime(start_time) ||
    !isValidTime(end_time) ||
    !SLOT_STATUSES.includes(status)
  ) {
    return res.status(400).json({
      message: "Provide a valid date, time range, and status.",
    });
  }

  if (end_time <= start_time) {
    return res.status(400).json({
      message: "End time must be later than start time.",
    });
  }

  try {
    const hospitalId = getHospitalId(req);

    const result = await pool.query(
      `UPDATE appointment_slots
       SET slot_date = $1::date,
           start_time = $2::time,
           end_time = $3::time,
           status = $4,
           notes = $5,
           updated_at = NOW()
       WHERE id = $6
         AND hospital_id = $7
         AND (
           status <> 'booked'
           OR $4 = 'booked'
         )
       RETURNING *`,
      [
        slot_date,
        start_time,
        end_time,
        status,
        notes.trim() || null,
        id,
        hospitalId,
      ],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Slot not found, or a booked slot cannot be edited this way.",
      });
    }

    return res.json({
      message: "Appointment slot updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
}

// POST /api/slot-availability/:id/book
async function bookSlot(req, res) {
  if (!requireUser(req, res)) return;

  if (!canManage(req)) {
    return res.status(403).json({
      message: "Only authorized scheduling staff can book a slot.",
    });
  }

  const { id } = req.params;
  const { patient_id } = req.body;

  if (!patient_id) {
    return res.status(400).json({
      message: "A patient ID is required to book this slot.",
    });
  }

  try {
    const hospitalId = getHospitalId(req);

    const patientResult = await pool.query(
      `SELECT id
       FROM patients
       WHERE id = $1
         AND hospital_id = $2
       LIMIT 1`,
      [patient_id, hospitalId],
    );

    if (!patientResult.rows.length) {
      return res.status(400).json({
        message: "Patient not found in your hospital.",
      });
    }

    // Conditional update prevents two requests from booking the same slot.
    const result = await pool.query(
      `UPDATE appointment_slots
       SET status = 'booked',
           patient_id = $1,
           updated_at = NOW()
       WHERE id = $2
         AND hospital_id = $3
         AND status = 'available'
         AND slot_date >= CURRENT_DATE
       RETURNING *`,
      [patient_id, id, hospitalId],
    );

    if (!result.rows.length) {
      return res.status(409).json({
        message:
          "This slot is no longer available, does not exist, or is in the past.",
      });
    }

    return res.json({
      message: "Slot booked successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
}

// PATCH /api/slot-availability/:id/cancel
async function cancelSlot(req, res) {
  if (!requireUser(req, res)) return;

  if (!canManage(req)) {
    return res.status(403).json({ message: "Access denied." });
  }

  try {
    const result = await pool.query(
      `UPDATE appointment_slots
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1
         AND hospital_id = $2
         AND status IN ('available', 'booked', 'blocked')
       RETURNING *`,
      [req.params.id, getHospitalId(req)],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Slot not found or already cancelled.",
      });
    }

    return res.json({
      message: "Slot cancelled successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
}

module.exports = {
  listSlots,
  createSlot,
  updateSlot,
  bookSlot,
  cancelSlot,
};

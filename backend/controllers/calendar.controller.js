const pool = require("../config/database");

const EVENT_TYPES = [
  "appointment",
  "meeting",
  "staff_shift",
  "procedure",
  "maintenance",
  "other",
];

const EVENT_STATUSES = ["scheduled", "completed", "cancelled"];

const MANAGE_ROLES = ["super_admin", "hospital_admin", "receptionist"];

const READ_ROLES = [
  ...MANAGE_ROLES,
  "doctor",
  "nurse",
  "lab_technician",
  "radiologist",
  "pharmacist",
  "accountant",
];

function canRead(req) {
  return READ_ROLES.includes(req.user?.role);
}

function canManage(req) {
  return MANAGE_ROLES.includes(req.user?.role);
}

function getHospitalId(req) {
  return req.user?.hospitalId || null;
}

function sendError(res, error) {
  console.error("Calendar API error:", error);

  if (error.code === "23503") {
    return res.status(400).json({
      message: "The selected staff member, patient, or user does not exist.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      message: "The calendar event contains invalid values.",
    });
  }

  return res.status(500).json({
    message: "An unexpected calendar error occurred.",
  });
}

function validDate(value) {
  return value && !Number.isNaN(Date.parse(value));
}

// GET /api/calendar
async function listEvents(req, res) {
  try {
    if (!canRead(req)) {
      return res.status(403).json({
        message: "You do not have permission to view the calendar.",
      });
    }

    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(400).json({
        message: "Your account must be assigned to a hospital.",
      });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const values = [hospitalId];
    const conditions = ["e.hospital_id = $1"];

    if (req.query.from) {
      if (!validDate(req.query.from)) {
        return res.status(400).json({
          message: "Invalid start date filter.",
        });
      }

      values.push(req.query.from);
      conditions.push(`e.end_at >= $${values.length}::timestamptz`);
    }

    if (req.query.to) {
      if (!validDate(req.query.to)) {
        return res.status(400).json({
          message: "Invalid end date filter.",
        });
      }

      values.push(req.query.to);
      conditions.push(`e.start_at <= $${values.length}::timestamptz`);
    }

    if (req.query.status && EVENT_STATUSES.includes(req.query.status)) {
      values.push(req.query.status);
      conditions.push(`e.status = $${values.length}`);
    }

    if (req.query.event_type && EVENT_TYPES.includes(req.query.event_type)) {
      values.push(req.query.event_type);
      conditions.push(`e.event_type = $${values.length}`);
    }

    if (req.query.search) {
      values.push(`%${String(req.query.search).trim()}%`);
      conditions.push(
        `(e.title ILIKE $${values.length}
          OR COALESCE(e.description, '') ILIKE $${values.length}
          OR COALESCE(e.location, '') ILIKE $${values.length})`,
      );
    }

    const where = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM hospital_calendar_events e
       WHERE ${where}`,
      values,
    );

    const dataValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT
          e.id,
          e.hospital_id,
          e.title,
          e.description,
          e.event_type,
          e.start_at,
          e.end_at,
          e.status,
          e.doctor_staff_id,
          e.patient_id,
          e.location,
          e.created_by,
          e.created_at,
          e.updated_at
       FROM hospital_calendar_events e
       WHERE ${where}
       ORDER BY e.start_at ASC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      dataValues,
    );

    return res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        pages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/calendar
async function createEvent(req, res) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        message: "You do not have permission to create calendar events.",
      });
    }

    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(400).json({
        message: "Your account must be assigned to a hospital.",
      });
    }

    const {
      title,
      description = "",
      event_type = "other",
      start_at,
      end_at,
      status = "scheduled",
      doctor_staff_id = null,
      patient_id = null,
      location = "",
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        message: "Event title is required.",
      });
    }

    if (String(title).trim().length > 200) {
      return res.status(400).json({
        message: "Event title cannot exceed 200 characters.",
      });
    }

    if (
      !validDate(start_at) ||
      !validDate(end_at) ||
      new Date(end_at) <= new Date(start_at)
    ) {
      return res.status(400).json({
        message: "Provide valid start and end times. End must be later.",
      });
    }

    if (!EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({
        message: "Invalid event type.",
      });
    }

    if (!EVENT_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid event status.",
      });
    }

    const result = await pool.query(
      `INSERT INTO hospital_calendar_events (
          hospital_id,
          title,
          description,
          event_type,
          start_at,
          end_at,
          status,
          doctor_staff_id,
          patient_id,
          location,
          created_by
       )
       VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11
       )
       RETURNING *`,
      [
        hospitalId,
        String(title).trim(),
        description || null,
        event_type,
        start_at,
        end_at,
        status,
        doctor_staff_id || null,
        patient_id || null,
        location || null,
        req.user.id,
      ],
    );

    return res.status(201).json({
      message: "Calendar event created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// PATCH /api/calendar/:id
async function updateEvent(req, res) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        message: "You do not have permission to update calendar events.",
      });
    }

    const hospitalId = getHospitalId(req);
    const { id } = req.params;

    if (!hospitalId) {
      return res.status(400).json({
        message: "Your account must be assigned to a hospital.",
      });
    }

    const {
      title,
      description,
      event_type,
      start_at,
      end_at,
      status,
      doctor_staff_id,
      patient_id,
      location,
    } = req.body;

    const existing = await pool.query(
      `SELECT *
       FROM hospital_calendar_events
       WHERE id = $1 AND hospital_id = $2`,
      [id, hospitalId],
    );

    if (!existing.rowCount) {
      return res.status(404).json({
        message: "Calendar event not found.",
      });
    }

    const old = existing.rows[0];

    const next = {
      title: title === undefined ? old.title : String(title).trim(),
      description:
        description === undefined ? old.description : description || null,
      event_type: event_type === undefined ? old.event_type : event_type,
      start_at: start_at === undefined ? old.start_at : start_at,
      end_at: end_at === undefined ? old.end_at : end_at,
      status: status === undefined ? old.status : status,
      doctor_staff_id:
        doctor_staff_id === undefined
          ? old.doctor_staff_id
          : doctor_staff_id || null,
      patient_id:
        patient_id === undefined ? old.patient_id : patient_id || null,
      location: location === undefined ? old.location : location || null,
    };

    if (!next.title || next.title.length > 200) {
      return res.status(400).json({
        message: "Enter a valid event title (maximum 200 characters).",
      });
    }

    if (
      !validDate(next.start_at) ||
      !validDate(next.end_at) ||
      new Date(next.end_at) <= new Date(next.start_at)
    ) {
      return res.status(400).json({
        message: "The event end time must be later than its start time.",
      });
    }

    if (
      !EVENT_TYPES.includes(next.event_type) ||
      !EVENT_STATUSES.includes(next.status)
    ) {
      return res.status(400).json({
        message: "Invalid event type or status.",
      });
    }

    const result = await pool.query(
      `UPDATE hospital_calendar_events
       SET title = $3,
           description = $4,
           event_type = $5,
           start_at = $6,
           end_at = $7,
           status = $8,
           doctor_staff_id = $9,
           patient_id = $10,
           location = $11,
           updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2
       RETURNING *`,
      [
        id,
        hospitalId,
        next.title,
        next.description,
        next.event_type,
        next.start_at,
        next.end_at,
        next.status,
        next.doctor_staff_id,
        next.patient_id,
        next.location,
      ],
    );

    return res.json({
      message: "Calendar event updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// DELETE /api/calendar/:id
// Archive events by cancelling them rather than permanently deleting history.
async function cancelEvent(req, res) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        message: "You do not have permission to cancel calendar events.",
      });
    }

    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(400).json({
        message: "Your account must be assigned to a hospital.",
      });
    }

    const result = await pool.query(
      `UPDATE hospital_calendar_events
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2
       RETURNING id`,
      [req.params.id, hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Calendar event not found.",
      });
    }

    return res.json({
      message: "Calendar event cancelled successfully.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  cancelEvent,
};

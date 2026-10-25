const pool = require("../config/database");

const feedbackTypes = [
  "complaint",
  "compliment",
  "suggestion",
  "service_concern",
];

const priorities = ["low", "medium", "high", "urgent"];

const statuses = [
  "received",
  "under_review",
  "investigating",
  "awaiting_response",
  "resolved",
  "closed",
];

const noteTypes = [
  "investigation",
  "contact_attempt",
  "decision",
  "resolution",
  "other",
];

const caseFields = [
  "reference_number",
  "patient_id",
  "feedback_type",
  "category",
  "subject",
  "description",
  "department",
  "priority",
  "status",
  "submitted_by_name",
  "submitted_by_contact",
  "confidential",
  "resolution_summary",
];

function getHospitalId(req, res) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    res.status(403).json({
      message: "Your account must be assigned to a hospital.",
    });
    return null;
  }

  return hospitalId;
}

function pick(body, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
}

// GET /api/patient-feedback
exports.listFeedback = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const type = String(req.query.type || "").trim();
    const priority = String(req.query.priority || "").trim();

    const values = [hospitalId];
    let where = "WHERE hospital_id = $1";

    if (search) {
      values.push(`%${search}%`);
      const p = values.length;
      where += ` AND (
        reference_number ILIKE $${p}
        OR subject ILIKE $${p}
        OR category ILIKE $${p}
        OR COALESCE(department, '') ILIKE $${p}
      )`;
    }

    if (statuses.includes(status)) {
      values.push(status);
      where += ` AND status = $${values.length}`;
    }

    if (feedbackTypes.includes(type)) {
      values.push(type);
      where += ` AND feedback_type = $${values.length}`;
    }

    if (priorities.includes(priority)) {
      values.push(priority);
      where += ` AND priority = $${values.length}`;
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM patient_feedback ${where}`,
      values,
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT *
       FROM patient_feedback
       ${where}
       ORDER BY received_at DESC, id DESC
       LIMIT $${dataValues.length - 1}
       OFFSET $${dataValues.length}`,
      dataValues,
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
  } catch (error) {
    console.error("List patient feedback error:", error);
    res.status(500).json({ message: "Unable to load patient feedback." });
  }
};

// POST /api/patient-feedback
exports.createFeedback = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const data = pick(req.body, caseFields);

  if (
    !data.reference_number?.trim() ||
    !data.category?.trim() ||
    !data.subject?.trim() ||
    !data.description?.trim()
  ) {
    return res.status(400).json({
      message:
        "Reference number, category, subject, and description are required.",
    });
  }

  if (data.feedback_type && !feedbackTypes.includes(data.feedback_type)) {
    return res.status(400).json({ message: "Invalid feedback type." });
  }

  if (data.priority && !priorities.includes(data.priority)) {
    return res.status(400).json({ message: "Invalid priority." });
  }

  if (data.status && !statuses.includes(data.status)) {
    return res.status(400).json({ message: "Invalid feedback status." });
  }

  try {
    if (data.patient_id) {
      const patient = await pool.query(
        "SELECT id FROM patients WHERE id = $1 AND hospital_id = $2",
        [data.patient_id, hospitalId],
      );

      if (!patient.rowCount) {
        return res.status(400).json({
          message: "The selected patient does not belong to this hospital.",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO patient_feedback (
        hospital_id, reference_number, patient_id, feedback_type,
        category, subject, description, department, priority, status,
        submitted_by_name, submitted_by_contact, confidential,
        resolution_summary, created_by, updated_by
      )
      VALUES (
        $1,$2,$3,COALESCE($4,'complaint'),$5,$6,$7,$8,
        COALESCE($9,'medium'),COALESCE($10,'received'),
        $11,$12,COALESCE($13,FALSE),$14,$15,$15
      )
      RETURNING *`,
      [
        hospitalId,
        data.reference_number.trim(),
        data.patient_id || null,
        data.feedback_type || null,
        data.category.trim(),
        data.subject.trim(),
        data.description.trim(),
        data.department || null,
        data.priority || null,
        data.status || null,
        data.submitted_by_name || null,
        data.submitted_by_contact || null,
        data.confidential ?? null,
        data.resolution_summary || null,
        req.user?.id || null,
      ],
    );

    res.status(201).json({
      message: "Feedback recorded successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "That reference number already exists in this hospital.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({ message: "A selected record is invalid." });
    }

    console.error("Create patient feedback error:", error);
    res.status(500).json({ message: "Unable to record feedback." });
  }
};

// PATCH /api/patient-feedback/:id
exports.updateFeedback = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const data = pick(
    req.body,
    caseFields.filter((field) => field !== "reference_number"),
  );

  if (!Object.keys(data).length) {
    return res.status(400).json({ message: "No editable fields provided." });
  }

  if (data.feedback_type && !feedbackTypes.includes(data.feedback_type)) {
    return res.status(400).json({ message: "Invalid feedback type." });
  }

  if (data.priority && !priorities.includes(data.priority)) {
    return res.status(400).json({ message: "Invalid priority." });
  }

  if (data.status && !statuses.includes(data.status)) {
    return res.status(400).json({ message: "Invalid feedback status." });
  }

  try {
    if (data.patient_id === "") data.patient_id = null;

    if (data.patient_id) {
      const patient = await pool.query(
        "SELECT id FROM patients WHERE id = $1 AND hospital_id = $2",
        [data.patient_id, hospitalId],
      );

      if (!patient.rowCount) {
        return res.status(400).json({
          message: "The selected patient does not belong to this hospital.",
        });
      }
    }

    const fields = Object.keys(data);
    const values = fields.map((field) =>
      data[field] === "" ? null : data[field],
    );

    const assignments = fields.map(
      (field, index) => `${field} = $${index + 1}`,
    );

    if (fields.includes("status")) {
      const statusParameter = fields.indexOf("status") + 1;
      assignments.push(
        `resolved_at = CASE
          WHEN $${statusParameter} IN ('resolved', 'closed')
            THEN COALESCE(resolved_at, NOW())
          ELSE NULL
        END`,
      );
    }

    assignments.push("updated_by = $" + (values.length + 1));
    values.push(req.user?.id || null);
    values.push(req.params.id, hospitalId);

    const result = await pool.query(
      `UPDATE patient_feedback
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND hospital_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Feedback record not found." });
    }

    res.json({
      message: "Feedback record updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ message: "A selected record is invalid." });
    }

    console.error("Update patient feedback error:", error);
    res.status(500).json({ message: "Unable to update feedback." });
  }
};

// GET /api/patient-feedback/:id/notes
exports.listNotes = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const parent = await pool.query(
      `SELECT id FROM patient_feedback
       WHERE id = $1 AND hospital_id = $2`,
      [req.params.id, hospitalId],
    );

    if (!parent.rowCount) {
      return res.status(404).json({ message: "Feedback record not found." });
    }

    const result = await pool.query(
      `SELECT *
       FROM patient_feedback_notes
       WHERE feedback_id = $1 AND hospital_id = $2
       ORDER BY created_at DESC`,
      [req.params.id, hospitalId],
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error("List feedback notes error:", error);
    res.status(500).json({ message: "Unable to load investigation notes." });
  }
};

// POST /api/patient-feedback/:id/notes
exports.createNote = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const { note_type = "investigation", note, is_internal = true } = req.body;

  if (!note?.trim()) {
    return res.status(400).json({ message: "Note text is required." });
  }

  if (!noteTypes.includes(note_type)) {
    return res.status(400).json({ message: "Invalid note type." });
  }

  try {
    const parent = await pool.query(
      `SELECT id FROM patient_feedback
       WHERE id = $1 AND hospital_id = $2`,
      [req.params.id, hospitalId],
    );

    if (!parent.rowCount) {
      return res.status(404).json({ message: "Feedback record not found." });
    }

    const result = await pool.query(
      `INSERT INTO patient_feedback_notes (
        hospital_id, feedback_id, note_type, note, is_internal, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        hospitalId,
        req.params.id,
        note_type,
        note.trim(),
        Boolean(is_internal),
        req.user?.id || null,
      ],
    );

    res.status(201).json({
      message: "Investigation note added.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create feedback note error:", error);
    res.status(500).json({ message: "Unable to add investigation note." });
  }
};

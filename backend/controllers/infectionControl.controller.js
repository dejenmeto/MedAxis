const pool = require("../config/database");

const caseStatuses = [
  "reported",
  "under_review",
  "confirmed",
  "monitoring",
  "resolved",
  "closed",
];

const severities = ["low", "moderate", "high", "critical"];

const actionStatuses = ["pending", "in_progress", "completed", "cancelled"];

function hospitalIdFrom(req, res) {
  const id = req.user?.hospitalId;

  if (!id) {
    res.status(403).json({
      message: "Your account must be assigned to a hospital.",
    });
    return null;
  }

  return id;
}

function pick(body, allowed) {
  return Object.fromEntries(
    allowed
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}

const caseFields = [
  "case_number",
  "patient_id",
  "infection_type",
  "suspected_source",
  "department",
  "detected_at",
  "severity",
  "isolation_required",
  "isolation_precautions",
  "status",
  "outcome_notes",
  "assigned_to",
];

function normalizeOptionalIds(data) {
  for (const key of ["patient_id", "assigned_to"]) {
    if (data[key] === "") data[key] = null;
  }
  return data;
}

// GET /api/infection-control/cases
exports.listCases = async (req, res) => {
  const hospitalId = hospitalIdFrom(req, res);
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
    const severity = String(req.query.severity || "").trim();

    const values = [hospitalId];
    let where = "WHERE c.hospital_id = $1";

    if (search) {
      values.push(`%${search}%`);
      const p = values.length;
      where += ` AND (
        c.case_number ILIKE $${p}
        OR c.infection_type ILIKE $${p}
        OR COALESCE(c.department, '') ILIKE $${p}
        OR COALESCE(c.suspected_source, '') ILIKE $${p}
      )`;
    }

    if (caseStatuses.includes(status)) {
      values.push(status);
      where += ` AND c.status = $${values.length}`;
    }

    if (severities.includes(severity)) {
      values.push(severity);
      where += ` AND c.severity = $${values.length}`;
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM infection_control_cases c ${where}`,
      values,
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT c.*,
              p.id AS linked_patient_id,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name
       FROM infection_control_cases c
       LEFT JOIN patients p
         ON p.id = c.patient_id
       ${where}
       ORDER BY c.detected_at DESC, c.id DESC
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
    console.error("Infection case list error:", error);
    res
      .status(500)
      .json({ message: "Unable to load infection-control cases." });
  }
};

// POST /api/infection-control/cases
exports.createCase = async (req, res) => {
  const hospitalId = hospitalIdFrom(req, res);
  if (!hospitalId) return;

  const data = normalizeOptionalIds(pick(req.body, caseFields));

  if (!data.case_number?.trim() || !data.infection_type?.trim()) {
    return res.status(400).json({
      message: "Case number and infection type are required.",
    });
  }

  if (data.severity && !severities.includes(data.severity)) {
    return res.status(400).json({ message: "Invalid severity." });
  }

  if (data.status && !caseStatuses.includes(data.status)) {
    return res.status(400).json({ message: "Invalid case status." });
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
      `INSERT INTO infection_control_cases (
        hospital_id, case_number, patient_id, infection_type,
        suspected_source, department, detected_at, severity,
        isolation_required, isolation_precautions, status,
        outcome_notes, reported_by, assigned_to
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),
        COALESCE($8,'moderate'),COALESCE($9,FALSE),$10,
        COALESCE($11,'reported'),$12,$13,$14
      )
      RETURNING *`,
      [
        hospitalId,
        data.case_number.trim(),
        data.patient_id || null,
        data.infection_type.trim(),
        data.suspected_source || null,
        data.department || null,
        data.detected_at || null,
        data.severity || null,
        data.isolation_required ?? null,
        data.isolation_precautions || null,
        data.status || null,
        data.outcome_notes || null,
        req.user?.id || null,
        data.assigned_to || null,
      ],
    );

    res.status(201).json({
      message: "Infection-control case recorded.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "That case number already exists in this hospital.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        message: "A selected patient or staff member is invalid.",
      });
    }

    console.error("Create infection case error:", error);
    res.status(500).json({ message: "Unable to record the infection case." });
  }
};

// PATCH /api/infection-control/cases/:id
exports.updateCase = async (req, res) => {
  const hospitalId = hospitalIdFrom(req, res);
  if (!hospitalId) return;

  const data = normalizeOptionalIds(pick(req.body, caseFields));

  if (!Object.keys(data).length) {
    return res.status(400).json({ message: "No editable fields provided." });
  }

  if (data.severity && !severities.includes(data.severity)) {
    return res.status(400).json({ message: "Invalid severity." });
  }

  if (data.status && !caseStatuses.includes(data.status)) {
    return res.status(400).json({ message: "Invalid case status." });
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

    const fields = Object.keys(data);
    const values = fields.map((field) =>
      data[field] === "" ? null : data[field],
    );

    values.push(req.params.id, hospitalId);

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

    const result = await pool.query(
      `UPDATE infection_control_cases
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND hospital_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Infection case not found." });
    }

    res.json({
      message: "Infection-control case updated.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ message: "A selected record is invalid." });
    }

    console.error("Update infection case error:", error);
    res.status(500).json({ message: "Unable to update the infection case." });
  }
};

// GET /api/infection-control/actions
exports.listActions = async (req, res) => {
  const hospitalId = hospitalIdFrom(req, res);
  if (!hospitalId) return;

  try {
    const status = String(req.query.status || "").trim();
    const values = [hospitalId];
    let where = "WHERE a.hospital_id = $1";

    if (actionStatuses.includes(status)) {
      values.push(status);
      where += ` AND a.status = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT a.*, c.case_number, c.infection_type
       FROM infection_control_actions a
       JOIN infection_control_cases c
         ON c.id = a.case_id AND c.hospital_id = a.hospital_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT 200`,
      values,
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error("Infection action list error:", error);
    res
      .status(500)
      .json({ message: "Unable to load infection-control actions." });
  }
};

// POST /api/infection-control/actions
exports.createAction = async (req, res) => {
  const hospitalId = hospitalIdFrom(req, res);
  if (!hospitalId) return;

  const { case_id, action_title, action_description, assigned_to, due_date } =
    req.body;

  if (!case_id || !action_title?.trim()) {
    return res.status(400).json({
      message: "Case and action title are required.",
    });
  }

  try {
    const caseResult = await pool.query(
      `SELECT id FROM infection_control_cases
       WHERE id = $1 AND hospital_id = $2`,
      [case_id, hospitalId],
    );

    if (!caseResult.rowCount) {
      return res.status(400).json({
        message: "The selected case was not found in this hospital.",
      });
    }

    const result = await pool.query(
      `INSERT INTO infection_control_actions (
        hospital_id, case_id, action_title, action_description,
        assigned_to, due_date, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        hospitalId,
        case_id,
        action_title.trim(),
        action_description || null,
        assigned_to || null,
        due_date || null,
        req.user?.id || null,
      ],
    );

    res.status(201).json({
      message: "Preventive action recorded.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ message: "A selected record is invalid." });
    }

    console.error("Create infection action error:", error);
    res.status(500).json({ message: "Unable to create preventive action." });
  }
};

// PATCH /api/infection-control/actions/:id
exports.updateAction = async (req, res) => {
  const hospitalId = hospitalIdFrom(req, res);
  if (!hospitalId) return;

  const allowed = [
    "action_title",
    "action_description",
    "assigned_to",
    "due_date",
    "status",
    "completion_notes",
  ];
  const data = pick(req.body, allowed);

  if (!Object.keys(data).length) {
    return res.status(400).json({ message: "No editable fields provided." });
  }

  if (data.status && !actionStatuses.includes(data.status)) {
    return res.status(400).json({ message: "Invalid action status." });
  }

  if (data.assigned_to === "") data.assigned_to = null;

  try {
    const fields = Object.keys(data);
    const values = fields.map((field) =>
      data[field] === "" ? null : data[field],
    );
    values.push(req.params.id, hospitalId);

    const assignments = fields.map(
      (field, index) => `${field} = $${index + 1}`,
    );

    if (fields.includes("status")) {
      const statusParameter = fields.indexOf("status") + 1;
      assignments.push(
        `completed_at = CASE
          WHEN $${statusParameter} = 'completed'
            THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END`,
      );
    }

    const result = await pool.query(
      `UPDATE infection_control_actions
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND hospital_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Preventive action not found." });
    }

    res.json({
      message: "Preventive action updated.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update infection action error:", error);
    res.status(500).json({ message: "Unable to update preventive action." });
  }
};

const { query, pool } = require("../config/database");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES = ["outpatient", "inpatient", "emergency", "telemedicine"];

const ALLOWED_STATUSES = ["open", "completed", "cancelled"];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getHospitalId(req) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    throw httpError(403, "Your account has no active hospital.");
  }

  return hospitalId;
}

function getUserId(req) {
  return req.user?.id ?? null;
}

function validateUuid(id) {
  if (!UUID_PATTERN.test(String(id || ""))) {
    throw httpError(400, "A valid encounter UUID is required.");
  }
}

function sendError(res, error) {
  console.error("EMR error:", error);

  const status = error.status || 500;

  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? "An unexpected error occurred while processing the EMR request."
        : error.message,
  });
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
}

function makeEncounterNumber() {
  const date = new Date();
  const timestamp = date
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `ENC-${timestamp}-${random}`;
}

async function ensurePatient(client, hospitalId, patientId) {
  if (!/^\d+$/.test(String(patientId || ""))) {
    throw httpError(400, "A valid numeric patient_id is required.");
  }

  const result = await client.query(
    `SELECT id
       FROM patients
      WHERE id = $1
        AND hospital_id = $2
      LIMIT 1`,
    [patientId, hospitalId],
  );

  if (!result.rows.length) {
    throw httpError(400, "The patient does not exist in your hospital.");
  }
}

async function ensureClinician(client, hospitalId, clinicianId) {
  if (clinicianId === null || clinicianId === undefined || clinicianId === "") {
    return null;
  }

  if (!/^\d+$/.test(String(clinicianId))) {
    throw httpError(400, "clinician_id must be a valid numeric staff ID.");
  }

  const result = await client.query(
    `SELECT id
       FROM staff_profiles
      WHERE id = $1
        AND hospital_id = $2
      LIMIT 1`,
    [clinicianId, hospitalId],
  );

  if (!result.rows.length) {
    throw httpError(400, "The clinician does not exist in your hospital.");
  }

  return clinicianId;
}

const list = asyncRoute(async (req, res) => {
  const hospitalId = getHospitalId(req);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = ["e.hospital_id = $1"];
  const values = [hospitalId];

  function addFilter(sql, value) {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  }

  if (req.query.patient_id) {
    addFilter("e.patient_id = ?", req.query.patient_id);
  }

  if (req.query.clinician_id) {
    addFilter("e.clinician_id = ?", req.query.clinician_id);
  }

  if (req.query.status) {
    if (!ALLOWED_STATUSES.includes(req.query.status)) {
      throw httpError(400, "Invalid encounter status.");
    }
    addFilter("e.encounter_status = ?", req.query.status);
  }

  if (req.query.type) {
    if (!ALLOWED_TYPES.includes(req.query.type)) {
      throw httpError(400, "Invalid encounter type.");
    }
    addFilter("e.encounter_type = ?", req.query.type);
  }

  if (req.query.search) {
    values.push(`%${String(req.query.search).trim()}%`);
    const index = values.length;
    conditions.push(
      `(e.encounter_number ILIKE $${index}
        OR p.first_name ILIKE $${index}
        OR p.last_name ILIKE $${index}
        OR p.mr_number ILIKE $${index})`,
    );
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
       FROM encounters e
       JOIN patients p
         ON p.id = e.patient_id
        AND p.hospital_id = e.hospital_id
      WHERE ${whereClause}`,
    values,
  );

  const result = await query(
    `SELECT
        e.id,
        e.hospital_id,
        e.patient_id,
        e.clinician_id,
        e.encounter_number,
        e.encounter_type,
        e.chief_complaint,
        e.history_of_present_illness,
        e.examination_notes,
        e.assessment,
        e.plan,
        e.encounter_status,
        e.started_at,
        e.completed_at,
        e.created_at,
        e.updated_at,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.mr_number
       FROM encounters e
       JOIN patients p
         ON p.id = e.patient_id
        AND p.hospital_id = e.hospital_id
      WHERE ${whereClause}
      ORDER BY e.started_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return res.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  });
});

const getById = asyncRoute(async (req, res) => {
  const hospitalId = getHospitalId(req);
  validateUuid(req.params.id);

  const result = await query(
    `SELECT
        e.*,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.mr_number
       FROM encounters e
       JOIN patients p
         ON p.id = e.patient_id
        AND p.hospital_id = e.hospital_id
      WHERE e.id = $1
        AND e.hospital_id = $2
      LIMIT 1`,
    [req.params.id, hospitalId],
  );

  if (!result.rows.length) {
    throw httpError(404, "Encounter not found.");
  }

  const encounter = result.rows[0];

  const [vitals, diagnoses] = await Promise.all([
    query(
      `SELECT *
         FROM encounter_vitals
        WHERE encounter_id = $1
          AND hospital_id = $2
        ORDER BY measured_at DESC`,
      [req.params.id, hospitalId],
    ),
    query(
      `SELECT *
         FROM encounter_diagnoses
        WHERE encounter_id = $1
          AND hospital_id = $2
        ORDER BY diagnosed_at DESC`,
      [req.params.id, hospitalId],
    ),
  ]);

  return res.json({
    success: true,
    data: {
      ...encounter,
      vitals: vitals.rows,
      diagnoses: diagnoses.rows,
    },
  });
});

const create = asyncRoute(async (req, res) => {
  const hospitalId = getHospitalId(req);
  const {
    patient_id,
    clinician_id,
    encounter_type = "outpatient",
    chief_complaint = null,
    history_of_present_illness = null,
    examination_notes = null,
    assessment = null,
    plan = null,
  } = req.body;

  if (!patient_id) {
    throw httpError(400, "patient_id is required.");
  }

  if (!ALLOWED_TYPES.includes(encounter_type)) {
    throw httpError(400, "Invalid encounter_type.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensurePatient(client, hospitalId, patient_id);
    const validClinicianId = await ensureClinician(
      client,
      hospitalId,
      clinician_id,
    );

    const result = await client.query(
      `INSERT INTO encounters (
          hospital_id,
          patient_id,
          clinician_id,
          encounter_number,
          encounter_type,
          chief_complaint,
          history_of_present_illness,
          examination_notes,
          assessment,
          plan
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        hospitalId,
        patient_id,
        validClinicianId,
        makeEncounterNumber(),
        encounter_type,
        chief_complaint,
        history_of_present_illness,
        examination_notes,
        assessment,
        plan,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Encounter created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const update = asyncRoute(async (req, res) => {
  const hospitalId = getHospitalId(req);
  validateUuid(req.params.id);

  const allowedFields = [
    "clinician_id",
    "encounter_type",
    "chief_complaint",
    "history_of_present_illness",
    "examination_notes",
    "assessment",
    "plan",
    "encounter_status",
  ];

  const updates = [];
  const values = [req.params.id, hospitalId];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      const value = req.body[field];

      if (field === "encounter_type" && !ALLOWED_TYPES.includes(value)) {
        throw httpError(400, "Invalid encounter_type.");
      }

      if (field === "encounter_status" && !ALLOWED_STATUSES.includes(value)) {
        throw httpError(400, "Invalid encounter_status.");
      }

      if (field === "clinician_id" && value !== null && value !== "") {
        const client = await pool.connect();
        try {
          await ensureClinician(client, hospitalId, value);
        } finally {
          client.release();
        }
      }

      values.push(field === "clinician_id" && value === "" ? null : value);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (!updates.length) {
    throw httpError(400, "Provide at least one field to update.");
  }

  if (req.body.encounter_status === "completed") {
    updates.push("completed_at = COALESCE(completed_at, NOW())");
  } else if (req.body.encounter_status === "open") {
    updates.push("completed_at = NULL");
  }

  updates.push("updated_at = NOW()");

  const result = await query(
    `UPDATE encounters
        SET ${updates.join(", ")}
      WHERE id = $1
        AND hospital_id = $2
      RETURNING *`,
    values,
  );

  if (!result.rows.length) {
    throw httpError(404, "Encounter not found.");
  }

  return res.json({
    success: true,
    message: "Encounter updated successfully.",
    data: result.rows[0],
  });
});

const addVitals = asyncRoute(async (req, res) => {
  const hospitalId = getHospitalId(req);
  validateUuid(req.params.id);

  const fields = [
    "temperature_c",
    "systolic_bp",
    "diastolic_bp",
    "pulse_bpm",
    "respiratory_rate",
    "oxygen_saturation",
    "weight_kg",
    "height_cm",
    "pain_score",
    "notes",
  ];

  const valuesByField = fields.map((field) =>
    req.body[field] === "" || req.body[field] === undefined
      ? null
      : req.body[field],
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const encounter = await client.query(
      `SELECT id
         FROM encounters
        WHERE id = $1
          AND hospital_id = $2
        FOR UPDATE`,
      [req.params.id, hospitalId],
    );

    if (!encounter.rows.length) {
      throw httpError(404, "Encounter not found.");
    }

    const result = await client.query(
      `INSERT INTO encounter_vitals (
          hospital_id,
          encounter_id,
          recorded_by,
          temperature_c,
          systolic_bp,
          diastolic_bp,
          pulse_bpm,
          respiratory_rate,
          oxygen_saturation,
          weight_kg,
          height_cm,
          pain_score,
          notes
       )
       VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )
       RETURNING *`,
      [hospitalId, req.params.id, getUserId(req), ...valuesByField],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Vitals recorded successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const addDiagnosis = asyncRoute(async (req, res) => {
  const hospitalId = getHospitalId(req);
  validateUuid(req.params.id);

  const {
    diagnosis_code = null,
    diagnosis_name,
    diagnosis_type = "working",
    notes = null,
    diagnosed_by = null,
  } = req.body;

  if (!String(diagnosis_name || "").trim()) {
    throw httpError(400, "diagnosis_name is required.");
  }

  if (!["working", "final", "differential"].includes(diagnosis_type)) {
    throw httpError(400, "Invalid diagnosis_type.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const encounter = await client.query(
      `SELECT id
         FROM encounters
        WHERE id = $1
          AND hospital_id = $2`,
      [req.params.id, hospitalId],
    );

    if (!encounter.rows.length) {
      throw httpError(404, "Encounter not found.");
    }

    let validDiagnosedBy = diagnosed_by;

    if (validDiagnosedBy !== null && validDiagnosedBy !== "") {
      validDiagnosedBy = await ensureClinician(
        client,
        hospitalId,
        validDiagnosedBy,
      );
    } else {
      validDiagnosedBy = null;
    }

    const result = await client.query(
      `INSERT INTO encounter_diagnoses (
          hospital_id,
          encounter_id,
          diagnosis_code,
          diagnosis_name,
          diagnosis_type,
          notes,
          diagnosed_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        hospitalId,
        req.params.id,
        diagnosis_code,
        String(diagnosis_name).trim(),
        diagnosis_type,
        notes,
        validDiagnosedBy,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Diagnosis added successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

module.exports = {
  list,
  getById,
  create,
  update,
  addVitals,
  addDiagnosis,
};

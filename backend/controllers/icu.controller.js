const { pool } = require("../config/database");

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const hospitalId = (req) => req.user?.hospitalId;

const requireHospital = (req, res) => {
  if (!hospitalId(req)) {
    res.status(403).json({
      success: false,
      message: "Your account is not assigned to a hospital.",
    });
    return false;
  }
  return true;
};

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const isPositiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0;

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value),
  );

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const validEnum = (value, values) => values.includes(value);

const getPagination = (req) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  return { page, limit, offset: (page - 1) * limit };
};

const getRows = (result) => result.rows;

const UNIT_TYPES = ["general", "adult", "pediatric", "neonatal", "cardiac"];
const BED_STATUSES = [
  "available",
  "occupied",
  "maintenance",
  "reserved",
  "isolation",
];
const MONITORING_LEVELS = ["standard", "continuous", "advanced"];
const NOTE_TYPES = [
  "admission",
  "progress",
  "procedure",
  "handover",
  "consultation",
  "discharge",
];

async function hospitalRecordExists(client, table, id, hospital) {
  // Table names are internal constants supplied by the controller only.
  const result = await client.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND hospital_id = $2`,
    [id, hospital],
  );
  return result.rowCount > 0;
}

// -----------------------------------------------------------------------------
// ICU SUMMARY
// -----------------------------------------------------------------------------

exports.getSummary = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM icu_units
         WHERE hospital_id = $1 AND is_active = TRUE) AS total_units,
       (SELECT COUNT(*) FROM icu_beds
         WHERE hospital_id = $1 AND is_active = TRUE) AS total_beds,
       (SELECT COUNT(*) FROM icu_beds
         WHERE hospital_id = $1 AND is_active = TRUE
           AND bed_status = 'available') AS available_beds,
       (SELECT COUNT(*) FROM icu_stays
         WHERE hospital_id = $1 AND stay_status = 'active') AS active_stays,
       (SELECT COUNT(*) FROM icu_observations
         WHERE hospital_id = $1
           AND observed_at >= NOW() - INTERVAL '24 hours') AS observations_24h`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// UNITS
// -----------------------------------------------------------------------------

exports.listUnits = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT u.*,
       COUNT(DISTINCT b.id) FILTER (WHERE b.is_active) AS total_beds,
       COUNT(DISTINCT b.id) FILTER (
         WHERE b.is_active AND b.bed_status = 'available'
       ) AS available_beds
     FROM icu_units u
     LEFT JOIN icu_beds b
       ON b.unit_id = u.id AND b.hospital_id = u.hospital_id
     WHERE u.hospital_id = $1
     GROUP BY u.id
     ORDER BY u.unit_name`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: getRows(result) });
});

exports.createUnit = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const {
    unit_code,
    unit_name,
    unit_type = "general",
    department_id = null,
    floor_number = null,
    description = null,
  } = req.body;

  if (!hasText(unit_code) || !hasText(unit_name)) {
    return sendError(res, 400, "Unit code and unit name are required.");
  }
  if (!validEnum(unit_type, UNIT_TYPES)) {
    return sendError(res, 400, "Invalid ICU unit type.");
  }
  if (
    department_id !== null &&
    department_id !== "" &&
    !isPositiveId(department_id)
  ) {
    return sendError(res, 400, "Invalid department ID.");
  }

  const result = await pool.query(
    `INSERT INTO icu_units
       (hospital_id, department_id, unit_code, unit_name, unit_type,
        floor_number, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      hospitalId(req),
      department_id || null,
      unit_code.trim(),
      unit_name.trim(),
      unit_type,
      floor_number || null,
      description || null,
    ],
  );

  res.status(201).json({
    success: true,
    message: "ICU unit created.",
    data: result.rows[0],
  });
});

exports.updateUnit = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isPositiveId(req.params.id)) {
    return sendError(res, 400, "Invalid ICU unit ID.");
  }

  const {
    unit_code,
    unit_name,
    unit_type,
    department_id,
    floor_number,
    description,
    is_active,
  } = req.body;

  if (unit_type !== undefined && !validEnum(unit_type, UNIT_TYPES)) {
    return sendError(res, 400, "Invalid ICU unit type.");
  }

  const result = await pool.query(
    `UPDATE icu_units SET
       unit_code = COALESCE($3, unit_code),
       unit_name = COALESCE($4, unit_name),
       unit_type = COALESCE($5, unit_type),
       department_id = CASE WHEN $6 THEN $7 ELSE department_id END,
       floor_number = COALESCE($8, floor_number),
       description = COALESCE($9, description),
       is_active = COALESCE($10, is_active),
       updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
     RETURNING *`,
    [
      req.params.id,
      hospitalId(req),
      unit_code?.trim() || null,
      unit_name?.trim() || null,
      unit_type || null,
      department_id !== undefined,
      department_id || null,
      floor_number === undefined ? null : floor_number,
      description === undefined ? null : description,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  if (!result.rowCount) return sendError(res, 404, "ICU unit not found.");

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// BEDS
// -----------------------------------------------------------------------------

exports.listBeds = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { page, limit, offset } = getPagination(req);
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();
  const unitId = String(req.query.unit_id || "").trim();

  if (status && !validEnum(status, BED_STATUSES)) {
    return sendError(res, 400, "Invalid bed status filter.");
  }

  const values = [
    hospitalId(req),
    `%${search}%`,
    status || null,
    unitId || null,
  ];
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM icu_beds b
       JOIN icu_units u ON u.id = b.unit_id
      WHERE b.hospital_id = $1 AND b.is_active = TRUE
        AND (b.bed_code ILIKE $2 OR u.unit_name ILIKE $2)
        AND ($3::text IS NULL OR b.bed_status = $3)
        AND ($4::text IS NULL OR b.unit_id::text = $4)`,
    values,
  );

  const result = await pool.query(
    `SELECT b.*, u.unit_name, u.unit_code
       FROM icu_beds b
       JOIN icu_units u ON u.id = b.unit_id
      WHERE b.hospital_id = $1 AND b.is_active = TRUE
        AND (b.bed_code ILIKE $2 OR u.unit_name ILIKE $2)
        AND ($3::text IS NULL OR b.bed_status = $3)
        AND ($4::text IS NULL OR b.unit_id::text = $4)
      ORDER BY u.unit_name, b.bed_code
      LIMIT $5 OFFSET $6`,
    [...values, limit, offset],
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page, limit, total: count.rows[0].total },
  });
});

exports.createBed = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const {
    unit_id,
    bed_code,
    bed_status = "available",
    monitoring_level = "standard",
    equipment_notes = null,
  } = req.body;

  if (!isPositiveId(unit_id) || !hasText(bed_code)) {
    return sendError(res, 400, "A valid unit and bed code are required.");
  }

  if (bed_status !== "available") {
    return sendError(res, 400, "New beds must start as available.");
  }

  if (!validEnum(monitoring_level, MONITORING_LEVELS)) {
    return sendError(res, 400, "Invalid monitoring level.");
  }

  const unit = await pool.query(
    `SELECT id
       FROM icu_units
      WHERE id = $1
        AND hospital_id = $2
        AND is_active = TRUE`,
    [unit_id, hospitalId(req)],
  );

  if (!unit.rowCount) {
    return sendError(res, 404, "Active ICU unit not found.");
  }

  try {
    const result = await pool.query(
      `INSERT INTO icu_beds
         (hospital_id, unit_id, bed_code, bed_status,
          monitoring_level, equipment_notes)
       VALUES ($1, $2, $3, 'available', $4, $5)
       RETURNING *`,
      [
        hospitalId(req),
        unit_id,
        bed_code.trim(),
        monitoring_level,
        equipment_notes || null,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "ICU bed created.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return sendError(
        res,
        409,
        "This bed code already exists in your hospital. Use a different bed code.",
      );
    }

    throw error;
  }
});

exports.updateBed = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id)) return sendError(res, 400, "Invalid bed ID.");

  const { unit_id, bed_code, monitoring_level, equipment_notes, is_active } =
    req.body;

  if (
    monitoring_level !== undefined &&
    !validEnum(monitoring_level, MONITORING_LEVELS)
  ) {
    return sendError(res, 400, "Invalid monitoring level.");
  }

  const current = await pool.query(
    `SELECT * FROM icu_beds
      WHERE id = $1 AND hospital_id = $2`,
    [req.params.id, hospitalId(req)],
  );
  if (!current.rowCount) return sendError(res, 404, "ICU bed not found.");

  // Never deactivate or move an occupied bed.
  if (
    (is_active === false || unit_id !== undefined) &&
    current.rows[0].bed_status === "occupied"
  ) {
    return sendError(
      res,
      409,
      "An occupied bed cannot be deactivated or moved.",
    );
  }

  if (unit_id !== undefined) {
    if (!isPositiveId(unit_id)) return sendError(res, 400, "Invalid unit ID.");
    const unit = await pool.query(
      `SELECT id FROM icu_units
        WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
      [unit_id, hospitalId(req)],
    );
    if (!unit.rowCount)
      return sendError(res, 404, "Active ICU unit not found.");
  }

  const result = await pool.query(
    `UPDATE icu_beds SET
       unit_id = COALESCE($3, unit_id),
       bed_code = COALESCE($4, bed_code),
       monitoring_level = COALESCE($5, monitoring_level),
       equipment_notes = CASE WHEN $6 THEN $7 ELSE equipment_notes END,
       is_active = COALESCE($8, is_active),
       updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
     RETURNING *`,
    [
      req.params.id,
      hospitalId(req),
      unit_id || null,
      bed_code?.trim() || null,
      monitoring_level || null,
      equipment_notes !== undefined,
      equipment_notes || null,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// ICU STAYS
// -----------------------------------------------------------------------------

exports.listStays = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { page, limit, offset } = getPagination(req);
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();

  if (
    status &&
    !["active", "discharged", "transferred", "cancelled"].includes(status)
  ) {
    return sendError(res, 400, "Invalid ICU stay status.");
  }

  const values = [hospitalId(req), `%${search}%`, status || null];
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM icu_stays s
       JOIN patients p ON p.id = s.patient_id
      WHERE s.hospital_id = $1
        AND (s.stay_number ILIKE $2 OR s.admission_reason ILIKE $2)
        AND ($3::text IS NULL OR s.stay_status = $3)`,
    values,
  );

  const result = await pool.query(
    `SELECT s.*, b.bed_code, u.unit_name,
            p.id AS patient_id
       FROM icu_stays s
       JOIN patients p ON p.id = s.patient_id
       JOIN icu_beds b ON b.id = s.bed_id
       JOIN icu_units u ON u.id = b.unit_id
      WHERE s.hospital_id = $1
        AND (s.stay_number ILIKE $2 OR s.admission_reason ILIKE $2)
        AND ($3::text IS NULL OR s.stay_status = $3)
      ORDER BY s.admitted_at DESC
      LIMIT $4 OFFSET $5`,
    [...values, limit, offset],
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page, limit, total: count.rows[0].total },
  });
});

exports.getStay = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id))
    return sendError(res, 400, "Invalid ICU stay ID.");

  const result = await pool.query(
    `SELECT s.*, b.bed_code, u.unit_name
       FROM icu_stays s
       JOIN icu_beds b ON b.id = s.bed_id
       JOIN icu_units u ON u.id = b.unit_id
      WHERE s.id = $1 AND s.hospital_id = $2`,
    [req.params.id, hospitalId(req)],
  );

  if (!result.rowCount) return sendError(res, 404, "ICU stay not found.");

  const [observations, notes, transfers] = await Promise.all([
    pool.query(
      `SELECT * FROM icu_observations
        WHERE stay_id = $1 AND hospital_id = $2
        ORDER BY observed_at DESC LIMIT 100`,
      [req.params.id, hospitalId(req)],
    ),
    pool.query(
      `SELECT * FROM icu_clinical_notes
        WHERE stay_id = $1 AND hospital_id = $2
        ORDER BY created_at DESC LIMIT 100`,
      [req.params.id, hospitalId(req)],
    ),
    pool.query(
      `SELECT * FROM icu_transfers
        WHERE stay_id = $1 AND hospital_id = $2
        ORDER BY requested_at DESC`,
      [req.params.id, hospitalId(req)],
    ),
  ]);

  res.json({
    success: true,
    data: {
      ...result.rows[0],
      observations: observations.rows,
      notes: notes.rows,
      transfers: transfers.rows,
    },
  });
});

exports.createStay = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const {
    patient_id,
    admission_id = null,
    bed_id,
    attending_staff_id = null,
    stay_number,
    admission_reason,
    admission_diagnosis = null,
    clinical_summary = null,
  } = req.body;

  if (
    !isPositiveId(patient_id) ||
    !isUuid(bed_id) ||
    !hasText(stay_number) ||
    !hasText(admission_reason)
  ) {
    return sendError(
      res,
      400,
      "Patient, valid bed, stay number, and admission reason are required.",
    );
  }
  if (admission_id && !isUuid(admission_id)) {
    return sendError(res, 400, "Invalid linked inpatient admission ID.");
  }
  if (
    attending_staff_id !== null &&
    attending_staff_id !== "" &&
    !isPositiveId(attending_staff_id)
  ) {
    return sendError(res, 400, "Invalid attending staff ID.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const patient = await client.query(
      `SELECT id FROM patients WHERE id = $1`,
      [patient_id],
    );
    if (!patient.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Patient not found.");
    }

    const bedResult = await client.query(
      `SELECT b.*, u.is_active AS unit_active
         FROM icu_beds b
         JOIN icu_units u ON u.id = b.unit_id
        WHERE b.id = $1 AND b.hospital_id = $2
        FOR UPDATE OF b`,
      [bed_id, hospitalId(req)],
    );
    if (
      !bedResult.rowCount ||
      !bedResult.rows[0].is_active ||
      !bedResult.rows[0].unit_active
    ) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Active ICU bed not found.");
    }
    if (bedResult.rows[0].bed_status !== "available") {
      await client.query("ROLLBACK");
      return sendError(res, 409, "The selected ICU bed is not available.");
    }

    if (admission_id) {
      const admission = await client.query(
        `SELECT id FROM admissions
          WHERE id = $1 AND hospital_id = $2 AND patient_id = $3`,
        [admission_id, hospitalId(req), patient_id],
      );
      if (!admission.rowCount) {
        await client.query("ROLLBACK");
        return sendError(
          res,
          400,
          "Linked admission does not belong to this hospital and patient.",
        );
      }
    }

    if (attending_staff_id) {
      const staff = await client.query(
        `SELECT id FROM staff_profiles
          WHERE id = $1 AND hospital_id = $2`,
        [attending_staff_id, hospitalId(req)],
      );
      if (!staff.rowCount) {
        await client.query("ROLLBACK");
        return sendError(res, 400, "Attending staff member not found.");
      }
    }

    const stay = await client.query(
      `INSERT INTO icu_stays
         (hospital_id, patient_id, admission_id, bed_id,
          attending_staff_id, admitted_by, stay_number, admission_reason,
          admission_diagnosis, clinical_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        hospitalId(req),
        patient_id,
        admission_id,
        bed_id,
        attending_staff_id || null,
        req.user.id,
        stay_number.trim(),
        admission_reason.trim(),
        admission_diagnosis,
        clinical_summary,
      ],
    );

    await client.query(
      `UPDATE icu_beds SET bed_status = 'occupied', updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2`,
      [bed_id, hospitalId(req)],
    );

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: "ICU stay created.",
      data: stay.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return sendError(
        res,
        409,
        "Stay number is already used or bed is occupied.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
});

exports.updateStay = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id))
    return sendError(res, 400, "Invalid ICU stay ID.");

  const {
    attending_staff_id,
    admission_reason,
    admission_diagnosis,
    clinical_summary,
  } = req.body;

  if (
    attending_staff_id !== undefined &&
    attending_staff_id !== null &&
    attending_staff_id !== "" &&
    !isPositiveId(attending_staff_id)
  ) {
    return sendError(res, 400, "Invalid attending staff ID.");
  }

  if (attending_staff_id) {
    const staff = await pool.query(
      `SELECT id FROM staff_profiles
        WHERE id = $1 AND hospital_id = $2`,
      [attending_staff_id, hospitalId(req)],
    );
    if (!staff.rowCount)
      return sendError(res, 400, "Attending staff member not found.");
  }

  const result = await pool.query(
    `UPDATE icu_stays SET
       attending_staff_id = CASE WHEN $3 THEN $4 ELSE attending_staff_id END,
       admission_reason = COALESCE($5, admission_reason),
       admission_diagnosis = CASE WHEN $6 THEN $7 ELSE admission_diagnosis END,
       clinical_summary = CASE WHEN $8 THEN $9 ELSE clinical_summary END,
       updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2 AND stay_status = 'active'
     RETURNING *`,
    [
      req.params.id,
      hospitalId(req),
      attending_staff_id !== undefined,
      attending_staff_id || null,
      admission_reason?.trim() || null,
      admission_diagnosis !== undefined,
      admission_diagnosis || null,
      clinical_summary !== undefined,
      clinical_summary || null,
    ],
  );

  if (!result.rowCount) {
    return sendError(res, 404, "Active ICU stay not found.");
  }

  res.json({ success: true, data: result.rows[0] });
});

exports.dischargeStay = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id))
    return sendError(res, 400, "Invalid ICU stay ID.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stayResult = await client.query(
      `SELECT * FROM icu_stays
        WHERE id = $1 AND hospital_id = $2 AND stay_status = 'active'
        FOR UPDATE`,
      [req.params.id, hospitalId(req)],
    );

    if (!stayResult.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Active ICU stay not found.");
    }

    const stay = stayResult.rows[0];

    await client.query(
      `UPDATE icu_stays
          SET stay_status = 'discharged',
              discharged_at = NOW(),
              discharge_summary = $3,
              updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2`,
      [stay.id, hospitalId(req), req.body.discharge_summary || null],
    );

    await client.query(
      `UPDATE icu_beds SET bed_status = 'available', updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2`,
      [stay.bed_id, hospitalId(req)],
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "ICU stay discharged." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// -----------------------------------------------------------------------------
// VITAL-SIGN OBSERVATIONS
// -----------------------------------------------------------------------------

exports.listObservations = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.stayId))
    return sendError(res, 400, "Invalid ICU stay ID.");

  const stay = await pool.query(
    `SELECT id FROM icu_stays WHERE id = $1 AND hospital_id = $2`,
    [req.params.stayId, hospitalId(req)],
  );
  if (!stay.rowCount) return sendError(res, 404, "ICU stay not found.");

  const result = await pool.query(
    `SELECT * FROM icu_observations
      WHERE stay_id = $1 AND hospital_id = $2
      ORDER BY observed_at DESC`,
    [req.params.stayId, hospitalId(req)],
  );
  res.json({ success: true, data: result.rows });
});

exports.createObservation = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { stay_id, ...input } = req.body;
  if (!isUuid(stay_id))
    return sendError(res, 400, "A valid ICU stay is required.");

  const allowed = [
    "heart_rate",
    "respiratory_rate",
    "oxygen_saturation",
    "systolic_bp",
    "diastolic_bp",
    "temperature_c",
    "gcs_score",
    "pain_score",
    "urine_output_ml",
    "notes",
  ];

  for (const key of allowed) {
    if (input[key] !== undefined && input[key] !== null && key !== "notes") {
      if (input[key] === "" || !Number.isFinite(Number(input[key]))) {
        return sendError(res, 400, `${key} must be numeric.`);
      }
    }
  }

  const stay = await pool.query(
    `SELECT id FROM icu_stays
      WHERE id = $1 AND hospital_id = $2 AND stay_status = 'active'`,
    [stay_id, hospitalId(req)],
  );
  if (!stay.rowCount) return sendError(res, 404, "Active ICU stay not found.");

  const columns = allowed.filter((key) => input[key] !== undefined);
  const values = columns.map((key) => (input[key] === "" ? null : input[key]));

  const result = await pool.query(
    `INSERT INTO icu_observations
       (hospital_id, stay_id, recorded_by${columns.length ? `, ${columns.join(", ")}` : ""})
     VALUES ($1, $2, $3${columns.map((_, i) => `, $${i + 4}`).join("")})
     RETURNING *`,
    [hospitalId(req), stay_id, req.user.id, ...values],
  );

  res.status(201).json({
    success: true,
    message: "Observation recorded.",
    data: result.rows[0],
  });
});

exports.updateObservation = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id))
    return sendError(res, 400, "Invalid observation ID.");

  const allowed = [
    "heart_rate",
    "respiratory_rate",
    "oxygen_saturation",
    "systolic_bp",
    "diastolic_bp",
    "temperature_c",
    "gcs_score",
    "pain_score",
    "urine_output_ml",
    "notes",
  ];
  const keys = allowed.filter((key) => req.body[key] !== undefined);
  if (!keys.length)
    return sendError(res, 400, "No observation fields supplied.");

  for (const key of keys) {
    const value = req.body[key];
    if (
      value !== null &&
      value !== "" &&
      key !== "notes" &&
      !Number.isFinite(Number(value))
    ) {
      return sendError(res, 400, `${key} must be numeric.`);
    }
  }

  const sets = keys.map((key, i) => `${key} = $${i + 3}`);
  const values = keys.map((key) =>
    req.body[key] === "" ? null : req.body[key],
  );

  const result = await pool.query(
    `UPDATE icu_observations SET ${sets.join(", ")}
      WHERE id = $1 AND hospital_id = $2
      RETURNING *`,
    [req.params.id, hospitalId(req), ...values],
  );
  if (!result.rowCount) return sendError(res, 404, "Observation not found.");

  res.json({ success: true, data: result.rows[0] });
});

exports.deleteObservation = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id))
    return sendError(res, 400, "Invalid observation ID.");

  const result = await pool.query(
    `DELETE FROM icu_observations WHERE id = $1 AND hospital_id = $2 RETURNING id`,
    [req.params.id, hospitalId(req)],
  );
  if (!result.rowCount) return sendError(res, 404, "Observation not found.");

  res.json({ success: true, message: "Observation deleted." });
});

// -----------------------------------------------------------------------------
// CLINICAL NOTES
// -----------------------------------------------------------------------------

exports.listNotes = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.stayId))
    return sendError(res, 400, "Invalid ICU stay ID.");

  const result = await pool.query(
    `SELECT n.* FROM icu_clinical_notes n
      JOIN icu_stays s ON s.id = n.stay_id
      WHERE n.stay_id = $1 AND n.hospital_id = $2 AND s.hospital_id = $2
      ORDER BY n.created_at DESC`,
    [req.params.stayId, hospitalId(req)],
  );
  res.json({ success: true, data: result.rows });
});

exports.createNote = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { stay_id, note_type = "progress", note_text } = req.body;
  if (!isUuid(stay_id) || !hasText(note_text)) {
    return sendError(res, 400, "ICU stay and note text are required.");
  }
  if (!validEnum(note_type, NOTE_TYPES)) {
    return sendError(res, 400, "Invalid note type.");
  }

  const stay = await pool.query(
    `SELECT id FROM icu_stays
      WHERE id = $1 AND hospital_id = $2 AND stay_status = 'active'`,
    [stay_id, hospitalId(req)],
  );
  if (!stay.rowCount) return sendError(res, 404, "Active ICU stay not found.");

  const result = await pool.query(
    `INSERT INTO icu_clinical_notes
       (hospital_id, stay_id, author_id, note_type, note_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [hospitalId(req), stay_id, req.user.id, note_type, note_text.trim()],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

exports.updateNote = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id)) return sendError(res, 400, "Invalid note ID.");

  const { note_type, note_text } = req.body;
  if (note_type !== undefined && !validEnum(note_type, NOTE_TYPES)) {
    return sendError(res, 400, "Invalid note type.");
  }
  if (note_text !== undefined && !hasText(note_text)) {
    return sendError(res, 400, "Note text cannot be empty.");
  }

  const result = await pool.query(
    `UPDATE icu_clinical_notes SET
       note_type = COALESCE($3, note_type),
       note_text = COALESCE($4, note_text),
       updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
     RETURNING *`,
    [
      req.params.id,
      hospitalId(req),
      note_type || null,
      note_text?.trim() || null,
    ],
  );
  if (!result.rowCount) return sendError(res, 404, "Clinical note not found.");

  res.json({ success: true, data: result.rows[0] });
});

exports.deleteNote = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!isUuid(req.params.id)) return sendError(res, 400, "Invalid note ID.");

  const result = await pool.query(
    `DELETE FROM icu_clinical_notes WHERE id = $1 AND hospital_id = $2 RETURNING id`,
    [req.params.id, hospitalId(req)],
  );
  if (!result.rowCount) return sendError(res, 404, "Clinical note not found.");

  res.json({ success: true, message: "Clinical note deleted." });
});

// -----------------------------------------------------------------------------
// BED TRANSFERS
// -----------------------------------------------------------------------------

exports.listTransfers = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT t.*, fb.bed_code AS from_bed_code, tb.bed_code AS to_bed_code
       FROM icu_transfers t
       JOIN icu_beds fb ON fb.id = t.from_bed_id
       JOIN icu_beds tb ON tb.id = t.to_bed_id
      WHERE t.hospital_id = $1
      ORDER BY t.requested_at DESC`,
    [hospitalId(req)],
  );
  res.json({ success: true, data: result.rows });
});

exports.createTransfer = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { stay_id, to_bed_id, transfer_reason, notes = null } = req.body;
  if (!isUuid(stay_id) || !isUuid(to_bed_id) || !hasText(transfer_reason)) {
    return sendError(
      res,
      400,
      "Stay, destination bed, and reason are required.",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stayResult = await client.query(
      `SELECT * FROM icu_stays
        WHERE id = $1 AND hospital_id = $2 AND stay_status = 'active'
        FOR UPDATE`,
      [stay_id, hospitalId(req)],
    );
    if (!stayResult.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Active ICU stay not found.");
    }
    const stay = stayResult.rows[0];

    if (stay.bed_id === to_bed_id) {
      await client.query("ROLLBACK");
      return sendError(res, 400, "Destination bed must be different.");
    }

    const bedResult = await client.query(
      `SELECT * FROM icu_beds
        WHERE id = $1 AND hospital_id = $2
        FOR UPDATE`,
      [to_bed_id, hospitalId(req)],
    );
    if (!bedResult.rowCount || !bedResult.rows[0].is_active) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Active destination bed not found.");
    }
    if (bedResult.rows[0].bed_status !== "available") {
      await client.query("ROLLBACK");
      return sendError(res, 409, "Destination bed is not available.");
    }

    const transfer = await client.query(
      `INSERT INTO icu_transfers
         (hospital_id, stay_id, from_bed_id, to_bed_id,
          requested_by, transfer_reason, transfer_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,'completed',$7)
       RETURNING *`,
      [
        hospitalId(req),
        stay_id,
        stay.bed_id,
        to_bed_id,
        req.user.id,
        transfer_reason.trim(),
        notes,
      ],
    );

    await client.query(
      `UPDATE icu_beds SET bed_status = 'available', updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2`,
      [stay.bed_id, hospitalId(req)],
    );
    await client.query(
      `UPDATE icu_beds SET bed_status = 'occupied', updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2`,
      [to_bed_id, hospitalId(req)],
    );
    await client.query(
      `UPDATE icu_stays SET bed_id = $3, updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2`,
      [stay_id, hospitalId(req), to_bed_id],
    );
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Bed transfer completed.",
      data: transfer.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

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

const enums = {
  pregnancy_type: ["singleton", "multiple"],
  risk_level: ["low", "moderate", "high", "critical"],
  pregnancy_status: [
    "antenatal",
    "in_labor",
    "delivered",
    "postpartum",
    "pregnancy_loss",
    "cancelled",
  ],
  labor_status: ["active", "completed", "transferred", "cancelled"],
  membrane_status: ["intact", "ruptured", "unknown"],
  delivery_method: ["vaginal", "assisted_vaginal", "cesarean", "other"],
  delivery_outcome: ["live_birth", "stillbirth", "mixed", "pregnancy_loss"],
  sex: ["female", "male", "indeterminate", "unknown"],
  feeding_method: ["breastfeeding", "formula", "mixed", "not_started", "other"],
  newborn_status: ["stable", "observation", "nicu", "transferred", "deceased"],
  visit_type: ["maternal", "newborn", "combined"],
};

const positiveIntegerFields = new Set([
  "gravida",
  "para",
  "abortions",
  "living_children",
  "gestational_age_weeks",
  "gestational_age_days",
  "visit_number",
  "fetal_heart_rate",
  "contraction_frequency_per_10_min",
  "contraction_duration_seconds",
  "maternal_pulse",
  "newborn_number",
  "birth_weight_grams",
]);

const uuidFields = new Set([
  "admission_id",
  "maternity_record_id",
  "labor_record_id",
  "delivery_id",
  "newborn_id",
]);

const bigintFields = new Set([
  "patient_id",
  "assigned_staff_id",
  "attending_staff_id",
  "attended_by",
  "recorded_by",
  "created_by",
]);

const commonTextFields = [
  "notes",
  "clinical_notes",
  "assessment",
  "treatment_plan",
  "examination_findings",
  "symptoms",
  "danger_signs",
  "medical_history",
  "obstetric_history",
  "allergies",
  "induction_method",
  "analgesia_method",
  "complications",
  "maternal_complications",
  "newborn_complications",
  "delivery_notes",
  "resuscitation_details",
  "congenital_conditions",
  "maternal_assessment",
  "maternal_treatment_plan",
  "newborn_assessment",
  "newborn_feeding_notes",
  "counseling_notes",
  "presentation",
  "urine_protein",
  "urine_glucose",
  "blood_group",
  "rhesus_factor",
];

const resources = {
  pregnancies: {
    table: "maternity_records",
    idType: "uuid",
    required: ["patient_id", "pregnancy_number"],
    fields: [
      "patient_id",
      "admission_id",
      "pregnancy_number",
      "gravida",
      "para",
      "abortions",
      "living_children",
      "last_menstrual_period",
      "estimated_delivery_date",
      "actual_delivery_date",
      "gestational_age_weeks",
      "gestational_age_days",
      "pregnancy_type",
      "blood_group",
      "rhesus_factor",
      "risk_level",
      "pregnancy_status",
      "medical_history",
      "obstetric_history",
      "allergies",
      "notes",
      "assigned_staff_id",
    ],
    text: ["pregnancy_number", ...commonTextFields],
  },
  "antenatal-visits": {
    table: "antenatal_visits",
    idType: "uuid",
    required: ["maternity_record_id", "visit_number"],
    fields: [
      "maternity_record_id",
      "visit_number",
      "visit_date",
      "gestational_age_weeks",
      "gestational_age_days",
      "systolic_bp",
      "diastolic_bp",
      "weight_kg",
      "temperature_c",
      "fetal_heart_rate",
      "fundal_height_cm",
      "urine_protein",
      "urine_glucose",
      "hemoglobin_g_dl",
      "symptoms",
      "examination_findings",
      "assessment",
      "treatment_plan",
      "danger_signs",
      "next_visit_date",
      "attended_by",
    ],
    text: commonTextFields,
  },
  labor: {
    table: "labor_records",
    idType: "uuid",
    required: ["maternity_record_id", "labor_number"],
    fields: [
      "maternity_record_id",
      "admission_id",
      "labor_number",
      "labor_onset_at",
      "membrane_rupture_at",
      "full_dilation_at",
      "delivery_started_at",
      "labor_completed_at",
      "labor_status",
      "presentation",
      "induction_method",
      "analgesia_method",
      "membrane_status",
      "complications",
      "clinical_notes",
      "attending_staff_id",
    ],
    text: ["labor_number", ...commonTextFields],
  },
  "fetal-observations": {
    table: "fetal_observations",
    idType: "uuid",
    required: ["labor_record_id"],
    fields: [
      "labor_record_id",
      "observed_at",
      "fetal_heart_rate",
      "contraction_frequency_per_10_min",
      "contraction_duration_seconds",
      "cervical_dilation_cm",
      "cervical_effacement_percent",
      "fetal_station",
      "maternal_systolic_bp",
      "maternal_diastolic_bp",
      "maternal_pulse",
      "notes",
    ],
    text: commonTextFields,
  },
  deliveries: {
    table: "delivery_records",
    idType: "uuid",
    required: [
      "maternity_record_id",
      "labor_record_id",
      "delivery_number",
      "delivery_method",
      "delivery_outcome",
    ],
    fields: [
      "maternity_record_id",
      "labor_record_id",
      "delivery_number",
      "delivery_at",
      "delivery_method",
      "delivery_outcome",
      "placenta_delivered_at",
      "placenta_complete",
      "blood_loss_ml",
      "episiotomy_performed",
      "perineal_tear_degree",
      "maternal_complications",
      "newborn_complications",
      "delivery_notes",
      "attending_staff_id",
    ],
    text: ["delivery_number", ...commonTextFields],
  },
  newborns: {
    table: "newborn_records",
    idType: "uuid",
    required: ["delivery_id", "maternity_record_id"],
    fields: [
      "delivery_id",
      "maternity_record_id",
      "patient_id",
      "newborn_number",
      "newborn_identifier",
      "date_of_birth",
      "sex",
      "birth_weight_grams",
      "length_cm",
      "head_circumference_cm",
      "apgar_1_min",
      "apgar_5_min",
      "apgar_10_min",
      "resuscitation_required",
      "resuscitation_details",
      "feeding_method",
      "newborn_status",
      "congenital_conditions",
      "clinical_notes",
    ],
    text: ["newborn_identifier", ...commonTextFields],
  },
  "postnatal-visits": {
    table: "postnatal_visits",
    idType: "uuid",
    required: ["maternity_record_id", "visit_number", "visit_type"],
    fields: [
      "maternity_record_id",
      "newborn_id",
      "visit_number",
      "visit_type",
      "visit_at",
      "next_visit_date",
      "maternal_systolic_bp",
      "maternal_diastolic_bp",
      "maternal_temperature_c",
      "maternal_assessment",
      "maternal_treatment_plan",
      "newborn_assessment",
      "newborn_feeding_notes",
      "danger_signs",
      "counseling_notes",
      "attended_by",
    ],
    text: commonTextFields,
  },
};

function normalizeInput(body, config, creating) {
  const input = {};

  for (const field of config.fields) {
    if (body[field] === undefined) continue;

    let value = body[field];

    if (value === "") value = null;

    if (
      typeof value === "string" &&
      (commonTextFields.includes(field) || config.text?.includes(field))
    ) {
      value = value.trim() || null;
    }

    input[field] = value;
  }

  if (creating) {
    for (const field of config.required) {
      if (
        input[field] === undefined ||
        input[field] === null ||
        input[field] === ""
      ) {
        return { error: `${field} is required.` };
      }
    }
  }

  for (const [field, allowedValues] of Object.entries(enums)) {
    if (input[field] != null && !allowedValues.includes(input[field])) {
      return { error: `Invalid value for ${field}.` };
    }
  }

  for (const field of uuidFields) {
    if (input[field] != null && !isUuid(input[field])) {
      return { error: `Invalid UUID for ${field}.` };
    }
  }

  for (const field of bigintFields) {
    if (
      input[field] != null &&
      input[field] !== "" &&
      !isPositiveId(input[field])
    ) {
      return { error: `Invalid ID for ${field}.` };
    }
  }

  for (const field of positiveIntegerFields) {
    if (
      input[field] != null &&
      (!Number.isInteger(Number(input[field])) || Number(input[field]) < 0)
    ) {
      return { error: `${field} must be a non-negative integer.` };
    }
  }

  if (
    input.rhesus_factor != null &&
    !["positive", "negative"].includes(input.rhesus_factor)
  ) {
    return { error: "Rhesus factor must be positive or negative." };
  }

  if (
    input.blood_group != null &&
    !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(
      input.blood_group,
    )
  ) {
    return { error: "Invalid blood group." };
  }

  if (
    input.pregnancy_status === "in_labor" &&
    input.risk_level === "critical"
  ) {
    // Valid combination; the explicit branch documents that these fields
    // are independent and must not be silently overwritten.
  }

  return { input };
}

async function validateRelationships(client, input, hospital) {
  const relations = [
    ["maternity_record_id", "maternity_records"],
    ["labor_record_id", "labor_records"],
    ["delivery_id", "delivery_records"],
    ["newborn_id", "newborn_records"],
  ];

  for (const [field, table] of relations) {
    if (input[field] == null) continue;

    const result = await client.query(
      `SELECT id FROM ${table}
        WHERE id = $1 AND hospital_id = $2`,
      [input[field], hospital],
    );

    if (!result.rowCount) {
      return `${field} does not reference a record in your hospital.`;
    }
  }

  if (input.admission_id) {
    const result = await client.query(
      `SELECT id FROM admissions
        WHERE id = $1 AND hospital_id = $2`,
      [input.admission_id, hospital],
    );
    if (!result.rowCount) {
      return "Linked inpatient admission was not found in your hospital.";
    }
  }

  if (input.patient_id != null) {
    const result = await client.query(`SELECT id FROM patients WHERE id = $1`, [
      input.patient_id,
    ]);
    if (!result.rowCount) return "Patient not found.";
  }

  const staffFields = [
    "assigned_staff_id",
    "attending_staff_id",
    "attended_by",
  ];

  for (const field of staffFields) {
    if (input[field] == null) continue;

    const result = await client.query(
      `SELECT id FROM staff_profiles
        WHERE id = $1 AND hospital_id = $2`,
      [input[field], hospital],
    );

    if (!result.rowCount) {
      return `${field} does not reference staff in your hospital.`;
    }
  }

  return null;
}

exports.getSummary = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const hospital = hospitalId(req);

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM maternity_records
         WHERE hospital_id = $1) AS total_pregnancies,
       (SELECT COUNT(*)::int FROM maternity_records
         WHERE hospital_id = $1
           AND pregnancy_status = 'antenatal') AS antenatal,
       (SELECT COUNT(*)::int FROM maternity_records
         WHERE hospital_id = $1
           AND pregnancy_status = 'in_labor') AS in_labor,
       (SELECT COUNT(*)::int FROM maternity_records
         WHERE hospital_id = $1
           AND risk_level IN ('high', 'critical')
           AND pregnancy_status IN ('antenatal', 'in_labor')) AS high_risk,
       (SELECT COUNT(*)::int FROM delivery_records
         WHERE hospital_id = $1
           AND delivery_at >= date_trunc('month', NOW())) AS deliveries_this_month,
       (SELECT COUNT(*)::int FROM newborn_records
         WHERE hospital_id = $1
           AND date_of_birth >= date_trunc('month', NOW())) AS newborns_this_month`,
    [hospital],
  );

  res.json({ success: true, data: result.rows[0] });
});

exports.list = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const config = resources[req.params.resource];
  if (!config) return sendError(res, 404, "Unknown maternity resource.");

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();

  const searchable = config.fields.filter((field) =>
    [
      "pregnancy_number",
      "labor_number",
      "delivery_number",
      "newborn_identifier",
      "notes",
      "assessment",
      "clinical_notes",
      "symptoms",
      "admission_reason",
    ].includes(field),
  );

  let where = "hospital_id = $1";
  const values = [hospitalId(req)];

  if (search && searchable.length) {
    values.push(`%${search}%`);
    const index = values.length;
    where += ` AND (${searchable
      .map((field) => `${field}::text ILIKE $${index}`)
      .join(" OR ")})`;
  }

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${config.table} WHERE ${where}`,
    values,
  );

  const result = await pool.query(
    `SELECT * FROM ${config.table}
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page, limit, total: count.rows[0].total },
  });
});

exports.create = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const config = resources[req.params.resource];
  if (!config) return sendError(res, 404, "Unknown maternity resource.");

  const { input, error } = normalizeInput(req.body, config, true);
  if (error) return sendError(res, 400, error);

  if (req.params.resource === "pregnancies") {
    input.created_by = req.user.id;
  } else if (req.params.resource === "labor") {
    input.recorded_by = req.user.id;
  } else if (
    [
      "antenatal-visits",
      "fetal-observations",
      "deliveries",
      "newborns",
      "postnatal-visits",
    ].includes(req.params.resource)
  ) {
    input.recorded_by = req.user.id;
  }

  const client = await pool.connect();

  try {
    const relationshipError = await validateRelationships(
      client,
      input,
      hospitalId(req),
    );
    if (relationshipError) return sendError(res, 400, relationshipError);

    if (req.params.resource === "pregnancies" && input.admission_id) {
      const admission = await client.query(
        `SELECT patient_id FROM admissions
          WHERE id = $1 AND hospital_id = $2`,
        [input.admission_id, hospitalId(req)],
      );

      if (
        admission.rowCount &&
        String(admission.rows[0].patient_id) !== String(input.patient_id)
      ) {
        return sendError(
          res,
          400,
          "Linked admission does not belong to the selected patient.",
        );
      }
    }

    if (req.params.resource === "deliveries") {
      const labor = await client.query(
        `SELECT maternity_record_id FROM labor_records
          WHERE id = $1 AND hospital_id = $2`,
        [input.labor_record_id, hospitalId(req)],
      );

      if (
        labor.rowCount &&
        labor.rows[0].maternity_record_id !== input.maternity_record_id
      ) {
        return sendError(
          res,
          400,
          "The labor record does not belong to this pregnancy.",
        );
      }
    }

    const columns = ["hospital_id", ...Object.keys(input)];
    const values = [hospitalId(req), ...Object.values(input)];
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await client.query(
      `INSERT INTO ${config.table} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values,
    );

    return res.status(201).json({
      success: true,
      message: "Maternity record created.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return sendError(
        res,
        409,
        "A record with the same unique identifier already exists.",
      );
    }
    if (error.code === "23503") {
      return sendError(res, 400, "A linked record does not exist.");
    }
    if (error.code === "23514" || error.code === "22P02") {
      return sendError(
        res,
        400,
        "One or more values are invalid for this record.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
});

exports.update = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const config = resources[req.params.resource];
  if (!config) return sendError(res, 404, "Unknown maternity resource.");

  if (!isUuid(req.params.id)) {
    return sendError(res, 400, "Invalid maternity record ID.");
  }

  const { input, error } = normalizeInput(req.body, config, false);
  if (error) return sendError(res, 400, error);

  delete input.created_by;
  delete input.recorded_by;

  const keys = Object.keys(input);
  if (!keys.length) {
    return sendError(res, 400, "No supported fields supplied.");
  }

  const client = await pool.connect();

  try {
    const relationshipError = await validateRelationships(
      client,
      input,
      hospitalId(req),
    );
    if (relationshipError) return sendError(res, 400, relationshipError);

    const assignments = keys.map((field, index) => `${field} = $${index + 3}`);

    const result = await client.query(
      `UPDATE ${config.table}
          SET ${assignments.join(", ")}, updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        RETURNING *`,
      [req.params.id, hospitalId(req), ...keys.map((key) => input[key])],
    );

    if (!result.rowCount) {
      return sendError(res, 404, "Maternity record not found.");
    }

    res.json({
      success: true,
      message: "Maternity record updated.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return sendError(
        res,
        409,
        "The update conflicts with an existing record.",
      );
    }
    if (
      error.code === "23503" ||
      error.code === "23514" ||
      error.code === "22P02"
    ) {
      return sendError(res, 400, "One or more linked values are invalid.");
    }
    throw error;
  } finally {
    client.release();
  }
});

exports.remove = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const config = resources[req.params.resource];
  if (!config) return sendError(res, 404, "Unknown maternity resource.");

  if (!isUuid(req.params.id)) {
    return sendError(res, 400, "Invalid maternity record ID.");
  }

  try {
    const result = await pool.query(
      `DELETE FROM ${config.table}
        WHERE id = $1 AND hospital_id = $2
        RETURNING id`,
      [req.params.id, hospitalId(req)],
    );

    if (!result.rowCount) {
      return sendError(res, 404, "Maternity record not found.");
    }

    res.json({
      success: true,
      message: "Maternity record deleted.",
    });
  } catch (error) {
    if (error.code === "23503") {
      return sendError(
        res,
        409,
        "This record is linked to other clinical records and cannot be deleted.",
      );
    }
    throw error;
  }
});

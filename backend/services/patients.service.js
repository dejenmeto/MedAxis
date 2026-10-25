const { query } = require("../config/database");

const patientColumns = [
  "mr_number",
  "first_name",
  "last_name",
  "email",
  "phone",
  "date_of_birth",
  "gender",
  "blood_group",
  "emergency_contact_name",
  "emergency_contact_phone",
  "address",
  "city",
  "region",
  "postal_code",
  "patient_type",
  "is_active",
];

function validatePatient(input) {
  const errors = [];

  for (const field of ["mr_number", "first_name", "last_name"]) {
    if (typeof input[field] !== "string" || input[field].trim().length === 0) {
      errors.push(`${field} is required.`);
    }
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push("A valid email address is required.");
  }

  if (
    input.gender &&
    !["male", "female", "other", "unknown"].includes(input.gender)
  ) {
    errors.push("Invalid gender value.");
  }

  if (input.patient_type && !["OPD", "IPD"].includes(input.patient_type)) {
    errors.push("Patient type must be OPD or IPD.");
  }

  if (
    input.blood_group &&
    !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(
      input.blood_group,
    )
  ) {
    errors.push("Invalid blood group.");
  }

  return errors;
}

async function listPatients(
  hospitalId,
  { page = 1, limit = 10, search = "", status = "all" },
) {
  const offset = (page - 1) * limit;
  const values = [hospitalId];
  const filters = ["hospital_id = $1"];

  if (search) {
    values.push(`%${search}%`);
    filters.push(
      `(mr_number ILIKE $${values.length}
        OR first_name ILIKE $${values.length}
        OR last_name ILIKE $${values.length}
        OR phone ILIKE $${values.length}
        OR email ILIKE $${values.length})`,
    );
  }

  if (status === "active" || status === "inactive") {
    values.push(status === "active");
    filters.push(`is_active = $${values.length}`);
  }

  const where = filters.join(" AND ");

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM patients WHERE ${where}`,
    values,
  );

  const listValues = [...values, limit, offset];

  const result = await query(
    `SELECT id, hospital_id, mr_number, first_name, last_name,
            email, phone, date_of_birth, gender, blood_group,
            patient_type, is_active, created_at, updated_at
     FROM patients
     WHERE ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${listValues.length - 1}
     OFFSET $${listValues.length}`,
    listValues,
  );

  return {
    data: result.rows,
    pagination: {
      total: countResult.rows[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}

async function getPatient(hospitalId, id) {
  const result = await query(
    `SELECT *
     FROM patients
     WHERE hospital_id = $1 AND id = $2`,
    [hospitalId, id],
  );

  return result.rows[0] || null;
}

async function createPatient(hospitalId, input) {
  const errors = validatePatient(input);

  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.status = 422;
    throw error;
  }

  const fields = ["hospital_id", ...patientColumns].filter(
    (field) =>
      field === "hospital_id" ||
      Object.prototype.hasOwnProperty.call(input, field),
  );

  const values = fields.map((field) => {
    if (field === "hospital_id") return hospitalId;
    return typeof input[field] === "string"
      ? input[field].trim()
      : input[field];
  });

  const placeholders = values.map((_, index) => `$${index + 1}`);

  const result = await query(
    `INSERT INTO patients (${fields.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    values,
  );

  return result.rows[0];
}

async function updatePatient(hospitalId, id, input) {
  const errors = validatePatient({
    mr_number: input.mr_number,
    first_name: input.first_name,
    last_name: input.last_name,
  });

  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.status = 422;
    throw error;
  }

  const fields = patientColumns.filter((field) =>
    Object.prototype.hasOwnProperty.call(input, field),
  );

  if (fields.length === 0) {
    const error = new Error("No valid fields were provided.");
    error.status = 400;
    throw error;
  }

  const values = fields.map((field) =>
    typeof input[field] === "string" ? input[field].trim() : input[field],
  );

  const setClause = fields
    .map((field, index) => `${field} = $${index + 1}`)
    .join(", ");

  values.push(hospitalId, id);

  const result = await query(
    `UPDATE patients
     SET ${setClause}, updated_at = NOW()
     WHERE hospital_id = $${values.length - 1}
       AND id = $${values.length}
     RETURNING *`,
    values,
  );

  return result.rows[0] || null;
}

async function deletePatient(hospitalId, id) {
  // Prefer a soft delete so historical clinical and financial records survive.
  const result = await query(
    `UPDATE patients
     SET is_active = FALSE, updated_at = NOW()
     WHERE hospital_id = $1 AND id = $2 AND is_active = TRUE
     RETURNING id`,
    [hospitalId, id],
  );

  return result.rowCount > 0;
}

module.exports = {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
};

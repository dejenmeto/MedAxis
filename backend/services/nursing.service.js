const { pool } = require("../config/database");

const RESOURCES = {
  assessments: {
    table: "nursing_assessments",
    fields: [
      "patient_id",
      "admission_id",
      "nurse_id",
      "assessed_at",
      "chief_complaint",
      "general_appearance",
      "pain_score",
      "fall_risk",
      "pressure_injury_risk",
      "notes",
    ],
    required: ["patient_id"],
    orderBy: "assessed_at DESC",
  },
  carePlans: {
    table: "nursing_care_plans",
    fields: [
      "patient_id",
      "admission_id",
      "created_by",
      "nursing_diagnosis",
      "goals",
      "interventions",
      "evaluation",
      "plan_status",
      "started_at",
      "reviewed_at",
      "completed_at",
    ],
    required: ["patient_id", "nursing_diagnosis", "goals", "interventions"],
    orderBy: "started_at DESC",
  },
  observations: {
    table: "nursing_observations",
    fields: [
      "patient_id",
      "admission_id",
      "recorded_by",
      "observation_type",
      "observation_value",
      "unit",
      "observed_at",
      "notes",
    ],
    required: ["patient_id", "observation_type", "observation_value"],
    orderBy: "observed_at DESC",
  },
};

function getResource(resourceName) {
  const resource = RESOURCES[resourceName];

  if (!resource) {
    throw new Error("Invalid Nursing resource.");
  }

  return resource;
}

function normalizeInput(resource, input, isUpdate = false) {
  const data = {};

  for (const field of resource.fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      data[field] = input[field] === "" ? null : input[field];
    }
  }

  if (!isUpdate) {
    for (const field of resource.required) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        const error = new Error(`${field} is required.`);
        error.statusCode = 400;
        throw error;
      }
    }
  }

  if (
    data.pain_score !== undefined &&
    data.pain_score !== null &&
    (!Number.isInteger(Number(data.pain_score)) ||
      Number(data.pain_score) < 0 ||
      Number(data.pain_score) > 10)
  ) {
    const error = new Error("Pain score must be an integer from 0 to 10.");
    error.statusCode = 400;
    throw error;
  }

  for (const field of ["fall_risk", "pressure_injury_risk"]) {
    if (
      data[field] != null &&
      !["low", "moderate", "high"].includes(data[field])
    ) {
      const error = new Error(`${field} must be low, moderate, or high.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    data.plan_status !== undefined &&
    !["active", "completed", "discontinued"].includes(data.plan_status)
  ) {
    const error = new Error("Invalid care plan status.");
    error.statusCode = 400;
    throw error;
  }

  return data;
}

async function validateRelations(client, hospitalId, data) {
  const patientId = data.patient_id;

  if (patientId !== undefined) {
    const patient = await client.query(
      `SELECT id
       FROM patients
       WHERE id = $1 AND hospital_id = $2
       LIMIT 1`,
      [patientId, hospitalId],
    );

    if (!patient.rowCount) {
      const error = new Error("Patient does not exist in your hospital.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (data.admission_id) {
    const admission = await client.query(
      `SELECT id
       FROM admissions
       WHERE id = $1 AND hospital_id = $2
       LIMIT 1`,
      [data.admission_id, hospitalId],
    );

    if (!admission.rowCount) {
      const error = new Error("Admission does not exist in your hospital.");
      error.statusCode = 400;
      throw error;
    }
  }

  for (const field of ["nurse_id", "created_by", "recorded_by"]) {
    if (data[field] !== undefined && data[field] !== null) {
      const staff = await client.query(
        `SELECT id
         FROM staff_profiles
         WHERE id = $1 AND hospital_id = $2
         LIMIT 1`,
        [data[field], hospitalId],
      );

      if (!staff.rowCount) {
        const error = new Error(
          `${field} does not identify staff in your hospital.`,
        );
        error.statusCode = 400;
        throw error;
      }
    }
  }
}

async function list(resourceName, hospitalId, options = {}) {
  const resource = getResource(resourceName);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const page = Math.max(Number(options.page) || 1, 1);
  const offset = (page - 1) * limit;
  const values = [hospitalId];
  let where = "hospital_id = $1";

  if (options.patientId) {
    values.push(options.patientId);
    where += ` AND patient_id = $${values.length}`;
  }

  if (options.search) {
    values.push(`%${String(options.search).trim()}%`);
    const searchParameter = `$${values.length}`;

    if (resourceName === "assessments") {
      where += ` AND (
        COALESCE(chief_complaint, '') ILIKE ${searchParameter}
        OR COALESCE(notes, '') ILIKE ${searchParameter}
      )`;
    } else if (resourceName === "carePlans") {
      where += ` AND (
        nursing_diagnosis ILIKE ${searchParameter}
        OR goals ILIKE ${searchParameter}
      )`;
    } else {
      where += ` AND (
        observation_type ILIKE ${searchParameter}
        OR observation_value ILIKE ${searchParameter}
      )`;
    }
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM ${resource.table}
     WHERE ${where}`,
    values,
  );

  const dataResult = await pool.query(
    `SELECT *
     FROM ${resource.table}
     WHERE ${where}
     ORDER BY ${resource.orderBy}
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}

async function getById(resourceName, hospitalId, id) {
  const resource = getResource(resourceName);

  const result = await pool.query(
    `SELECT *
     FROM ${resource.table}
     WHERE id = $1 AND hospital_id = $2
     LIMIT 1`,
    [id, hospitalId],
  );

  return result.rows[0] || null;
}

async function create(resourceName, hospitalId, input, actorStaffId) {
  const resource = getResource(resourceName);
  const data = normalizeInput(resource, input);

  // The creator/recorder is taken from the authenticated staff profile,
  // not trusted from the request body.
  if (resourceName === "assessments") {
    data.nurse_id = actorStaffId || data.nurse_id || null;
  } else if (resourceName === "carePlans") {
    data.created_by = actorStaffId || data.created_by || null;
  } else {
    data.recorded_by = actorStaffId || data.recorded_by || null;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await validateRelations(client, hospitalId, data);

    const fields = Object.keys(data).filter(
      (field) => data[field] !== undefined,
    );

    const columns = ["hospital_id", ...fields];
    const values = [hospitalId, ...fields.map((field) => data[field])];
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await client.query(
      `INSERT INTO ${resource.table} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values,
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function update(resourceName, hospitalId, id, input) {
  const resource = getResource(resourceName);
  const data = normalizeInput(resource, input, true);
  const fields = Object.keys(data);

  if (!fields.length) {
    const error = new Error("No valid fields were supplied for update.");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT *
       FROM ${resource.table}
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [id, hospitalId],
    );

    if (!existing.rowCount) {
      const error = new Error("Nursing record not found.");
      error.statusCode = 404;
      throw error;
    }

    await validateRelations(client, hospitalId, data);

    const assignments = fields.map(
      (field, index) => `${field} = $${index + 3}`,
    );

    if (resourceName !== "observations") {
      assignments.push("updated_at = NOW()");
    }

    const result = await client.query(
      `UPDATE ${resource.table}
       SET ${assignments.join(", ")}
       WHERE id = $1 AND hospital_id = $2
       RETURNING *`,
      [id, hospitalId, ...fields.map((field) => data[field])],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function remove(resourceName, hospitalId, id) {
  const resource = getResource(resourceName);

  const result = await pool.query(
    `DELETE FROM ${resource.table}
     WHERE id = $1 AND hospital_id = $2
     RETURNING id`,
    [id, hospitalId],
  );

  return result.rows[0] || null;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};

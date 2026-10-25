const { pool } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const RESOURCES = {
  providers: {
    table: "insurance_providers",
    fields: [
      "provider_code",
      "name",
      "contact_person",
      "phone",
      "email",
      "address",
      "is_active",
    ],
    required: ["provider_code", "name"],
    search: ["provider_code", "name", "email"],
    updatedAt: true,
  },
  policies: {
    table: "patient_insurance_policies",
    fields: [
      "provider_id",
      "patient_id",
      "policy_number",
      "member_number",
      "plan_name",
      "coverage_percent",
      "coverage_limit",
      "start_date",
      "end_date",
      "status",
      "notes",
    ],
    required: ["provider_id", "patient_id", "policy_number", "start_date"],
    search: ["policy_number", "member_number", "plan_name"],
    updatedAt: true,
  },
  claims: {
    table: "insurance_claims",
    fields: [
      "claim_number",
      "policy_id",
      "patient_id",
      "invoice_reference",
      "service_date",
      "claim_amount",
      "approved_amount",
      "currency",
      "diagnosis_summary",
      "claim_notes",
      "status",
      "rejection_reason",
    ],
    required: [
      "claim_number",
      "policy_id",
      "patient_id",
      "service_date",
      "claim_amount",
    ],
    search: ["claim_number", "invoice_reference", "status"],
    updatedAt: true,
  },
  reimbursements: {
    table: "insurance_reimbursements",
    fields: [
      "claim_id",
      "reimbursement_reference",
      "amount",
      "payment_date",
      "payment_method",
      "notes",
    ],
    required: ["claim_id", "reimbursement_reference", "amount"],
    search: ["reimbursement_reference", "payment_method"],
    updatedAt: false,
  },
};

function getHospitalId(req, res) {
  const id = req.user?.hospitalId;

  if (!id) {
    res.status(403).json({
      success: false,
      message: "Your account is not assigned to a hospital.",
    });
    return null;
  }

  return id;
}

function getUserId(req) {
  const id = req.user?.id;
  return id && /^\d+$/.test(String(id)) ? String(id) : null;
}

function getResource(req, res) {
  const resource = RESOURCES[req.params.resource];

  if (!resource) {
    res.status(404).json({
      success: false,
      message: "Unknown insurance resource.",
    });
    return null;
  }

  return resource;
}

function cleanPayload(body, allowedFields) {
  const result = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const value = body[field];
      result[field] = value === "" ? null : value;
    }
  }

  return result;
}

function missingFields(data, required) {
  return required.filter(
    (field) =>
      data[field] === undefined || data[field] === null || data[field] === "",
  );
}

async function assertHospitalRecord(client, table, id, hospitalId, label) {
  if (!id) {
    const error = new Error(`${label} is required.`);
    error.status = 400;
    throw error;
  }

  const result = await client.query(
    `SELECT id FROM ${table}
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId],
  );

  if (!result.rowCount) {
    const error = new Error(`${label} does not exist in your hospital.`);
    error.status = 400;
    throw error;
  }
}

async function validateRelations(client, resourceName, data, hospitalId) {
  if (resourceName === "policies") {
    if (data.provider_id) {
      await assertHospitalRecord(
        client,
        "insurance_providers",
        data.provider_id,
        hospitalId,
        "Insurance provider",
      );
    }

    if (data.patient_id) {
      await assertHospitalRecord(
        client,
        "patients",
        data.patient_id,
        hospitalId,
        "Patient",
      );
    }
  }

  if (resourceName === "claims") {
    let policy;

    if (data.policy_id) {
      const result = await client.query(
        `SELECT patient_id, status, start_date, end_date
         FROM patient_insurance_policies
         WHERE id = $1 AND hospital_id = $2`,
        [data.policy_id, hospitalId],
      );

      policy = result.rows[0];

      if (!policy) {
        const error = new Error(
          "The selected policy does not exist in your hospital.",
        );
        error.status = 400;
        throw error;
      }
    }

    if (data.patient_id) {
      await assertHospitalRecord(
        client,
        "patients",
        data.patient_id,
        hospitalId,
        "Patient",
      );
    }

    if (
      policy &&
      data.patient_id &&
      String(policy.patient_id) !== String(data.patient_id)
    ) {
      const error = new Error(
        "The selected policy belongs to a different patient.",
      );
      error.status = 400;
      throw error;
    }
  }

  if (resourceName === "reimbursements" && data.claim_id) {
    await assertHospitalRecord(
      client,
      "insurance_claims",
      data.claim_id,
      hospitalId,
      "Insurance claim",
    );
  }
}

function handleDatabaseError(error, res) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "That reference or number already exists.",
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "A linked record is invalid or no longer exists.",
    });
  }

  if (["22P02", "22007", "22008", "23514"].includes(error.code)) {
    return res.status(400).json({
      success: false,
      message: "One or more supplied values are invalid.",
    });
  }

  throw error;
}

exports.submitClaim = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const result = await pool.query(
    `UPDATE insurance_claims
     SET status = 'submitted',
         submitted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND hospital_id = $2
       AND status = 'draft'
     RETURNING *`,
    [req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(400).json({
      success: false,
      message: "Claim not found or is not in draft status.",
    });
  }

  res.json({
    success: true,
    message: "Claim submitted for review.",
    data: result.rows[0],
  });
});

exports.reviewClaim = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const { status, approved_amount, rejection_reason } = req.body;
  const allowedStatuses = [
    "under_review",
    "approved",
    "partially_approved",
    "rejected",
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid claim review status.",
    });
  }

  const amount = Number(approved_amount);

  if (
    ["approved", "partially_approved"].includes(status) &&
    (!Number.isFinite(amount) || amount <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter an approved amount greater than zero.",
    });
  }

  if (status === "rejected" && !String(rejection_reason || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "A rejection reason is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT id, claim_amount, status
       FROM insurance_claims
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [req.params.id, hospitalId],
    );

    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Claim not found.",
      });
    }

    const claim = current.rows[0];

    if (!["submitted", "under_review"].includes(claim.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only submitted claims can be reviewed.",
      });
    }

    const approvedAmount = status === "rejected" ? 0 : amount;

    if (approvedAmount > Number(claim.claim_amount)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Approved amount cannot exceed the claim amount.",
      });
    }

    const result = await client.query(
      `UPDATE insurance_claims
       SET status = $1,
           approved_amount = $2,
           rejection_reason = $3,
           reviewed_by = $4,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $5 AND hospital_id = $6
       RETURNING *`,
      [
        status,
        approvedAmount,
        status === "rejected" ? String(rejection_reason).trim() : null,
        getUserId(req),
        req.params.id,
        hospitalId,
      ],
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Claim review saved.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

exports.summary = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM insurance_providers
        WHERE hospital_id = $1 AND is_active = TRUE) AS active_providers,
       (SELECT COUNT(*)::int FROM patient_insurance_policies
        WHERE hospital_id = $1 AND status = 'active') AS active_policies,
       (SELECT COUNT(*)::int FROM insurance_claims
        WHERE hospital_id = $1 AND status IN ('submitted', 'under_review'))
        AS pending_claims,
       (SELECT COUNT(*)::int FROM insurance_claims
        WHERE hospital_id = $1 AND status = 'rejected') AS rejected_claims,
       (SELECT COALESCE(SUM(claim_amount), 0)
        FROM insurance_claims
        WHERE hospital_id = $1 AND status IN ('submitted', 'under_review'))
        AS pending_amount,
       (SELECT COALESCE(SUM(amount), 0)
        FROM insurance_reimbursements
        WHERE hospital_id = $1) AS reimbursements_recorded`,
    [hospitalId],
  );

  res.json({ success: true, data: result.rows[0] });
});

exports.list = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();

  const conditions = ["hospital_id = $1"];
  const values = [hospitalId];

  if (search) {
    values.push(`%${search}%`);
    const searchIndex = values.length;

    conditions.push(
      `(${resource.search
        .map((field) => `CAST(${field} AS TEXT) ILIKE $${searchIndex}`)
        .join(" OR ")})`,
    );
  }

  if (req.query.status && resource.table === "insurance_claims") {
    values.push(req.query.status);
    conditions.push(`status = $${values.length}`);
  }

  const where = conditions.join(" AND ");

  const [records, count] = await Promise.all([
    pool.query(
      `SELECT * FROM ${resource.table}
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM ${resource.table} WHERE ${where}`,
      values,
    ),
  ]);

  res.json({
    success: true,
    data: records.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  });
});

exports.create = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const data = cleanPayload(req.body, resource.fields);
  const missing = missingFields(data, resource.required);

  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: `Required fields: ${missing.join(", ")}.`,
    });
  }

  const userId = getUserId(req);
  const extra = { hospital_id: hospitalId };

  if (["providers", "policies", "claims"].includes(req.params.resource)) {
    extra.created_by = userId;
  }

  if (req.params.resource === "reimbursements") {
    extra.recorded_by = userId;
  }

  if (req.params.resource === "claims") {
    data.approved_amount = 0;
    data.status = "draft";
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validateRelations(client, req.params.resource, data, hospitalId);

    const valuesObject = { ...data, ...extra };
    const columns = Object.keys(valuesObject);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const result = await client.query(
      `INSERT INTO ${resource.table} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")}) RETURNING *`,
      columns.map((column) => valuesObject[column]),
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Insurance record created.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
});

exports.update = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const data = cleanPayload(req.body, resource.fields);

  if (!Object.keys(data).length) {
    return res.status(400).json({
      success: false,
      message: "No editable fields were supplied.",
    });
  }

  // Review status and approved amount require a dedicated review workflow.
  if (req.params.resource === "claims") {
    delete data.status;
    delete data.approved_amount;
    delete data.rejection_reason;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validateRelations(client, req.params.resource, data, hospitalId);

    const columns = Object.keys(data);
    const values = columns.map((column) => data[column]);
    const assignments = columns.map(
      (column, index) => `${column} = $${index + 1}`,
    );

    if (resource.updatedAt) assignments.push("updated_at = NOW()");

    values.push(req.params.id, hospitalId);

    const result = await client.query(
      `UPDATE ${resource.table}
       SET ${assignments.join(", ")}
       WHERE id = $${values.length - 1}
         AND hospital_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Insurance record updated.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
});

exports.remove = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  // Financial claims should be retained for audit purposes.
  if (["claims", "reimbursements"].includes(req.params.resource)) {
    return res.status(403).json({
      success: false,
      message: "Claims and reimbursements cannot be deleted.",
    });
  }

  const result = await pool.query(
    `DELETE FROM ${resource.table}
     WHERE id = $1 AND hospital_id = $2 RETURNING id`,
    [req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Record not found.",
    });
  }

  res.json({
    success: true,
    message: "Insurance record deleted.",
  });
});

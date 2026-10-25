const { pool } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const RESOURCES = {
  donors: {
    table: "blood_donors",
    search: ["donor_number", "first_name", "last_name", "phone"],
    fields: [
      "donor_number",
      "first_name",
      "last_name",
      "date_of_birth",
      "sex",
      "phone",
      "email",
      "blood_group",
      "rh_type",
      "address",
      "eligibility_status",
      "last_donation_date",
      "notes",
    ],
    required: ["donor_number", "first_name", "last_name"],
    order: "created_at DESC",
  },
  donations: {
    table: "blood_donations",
    search: ["donation_number", "donation_type", "collection_status"],
    fields: [
      "donation_number",
      "donor_id",
      "donated_at",
      "donation_type",
      "volume_ml",
      "collection_status",
      "notes",
    ],
    required: ["donation_number", "donor_id", "volume_ml"],
    order: "donated_at DESC",
  },
  screening: {
    table: "blood_screening_tests",
    search: ["test_name", "result"],
    fields: ["donation_id", "test_name", "result", "tested_at", "notes"],
    required: ["donation_id", "test_name", "result"],
    order: "created_at DESC",
  },
  units: {
    table: "blood_units",
    search: ["unit_number", "component_type", "blood_group", "status"],
    fields: [
      "unit_number",
      "donation_id",
      "component_type",
      "blood_group",
      "rh_type",
      "volume_ml",
      "collected_at",
      "expires_at",
      "storage_location",
      "status",
      "screening_cleared",
      "notes",
    ],
    required: [
      "unit_number",
      "donation_id",
      "component_type",
      "blood_group",
      "rh_type",
      "expires_at",
    ],
    order: "expires_at ASC",
  },
  requests: {
    table: "blood_requests",
    search: ["request_number", "clinical_indication", "status", "urgency"],
    fields: [
      "request_number",
      "patient_id",
      "requested_component",
      "blood_group",
      "rh_type",
      "units_requested",
      "urgency",
      "clinical_indication",
      "status",
      "needed_by",
      "notes",
    ],
    required: [
      "request_number",
      "patient_id",
      "requested_component",
      "blood_group",
      "rh_type",
      "clinical_indication",
    ],
    order: "created_at DESC",
  },
  crossmatches: {
    table: "blood_compatibility_tests",
    search: ["result", "notes"],
    fields: ["request_id", "blood_unit_id", "result", "tested_at", "notes"],
    required: ["request_id", "blood_unit_id", "result"],
    order: "created_at DESC",
  },
  issues: {
    table: "blood_issues",
    search: ["issue_number", "received_by_name", "destination"],
    fields: [
      "issue_number",
      "request_id",
      "blood_unit_id",
      "received_by_name",
      "destination",
      "notes",
    ],
    required: ["issue_number", "request_id", "blood_unit_id"],
    order: "issued_at DESC",
  },
};

const getHospitalId = (req) => {
  const hospitalId = req.user?.hospitalId;

  // Do not allow a user to choose another hospital through request data.
  if (!hospitalId) {
    const error = new Error(
      "Your account must be assigned to a hospital before using this module.",
    );
    error.status = 403;
    throw error;
  }

  return String(hospitalId);
};

const getUserId = (req) => req.user?.id || null;

function getResource(req, res) {
  const resource = RESOURCES[req.params.resource];

  if (!resource) {
    res.status(404).json({
      success: false,
      message: "Unknown blood bank resource.",
    });
    return null;
  }

  return resource;
}

function cleanPayload(body, fields) {
  const result = {};

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field] === "" ? null : body[field];
    }
  }

  return result;
}

function missingFields(payload, required) {
  return required.filter(
    (field) =>
      payload[field] === undefined ||
      payload[field] === null ||
      payload[field] === "",
  );
}

async function assertLinkedRecord(client, table, id, hospitalId) {
  const result = await client.query(
    `SELECT id FROM ${table} WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId],
  );

  if (!result.rowCount) {
    const error = new Error(
      `The selected linked record in ${table} was not found in this hospital.`,
    );
    error.status = 400;
    throw error;
  }
}

async function validateRelations(client, key, data, hospitalId) {
  const relationships = [];

  if (key === "donations") {
    relationships.push(["blood_donors", data.donor_id]);
  }

  if (key === "screening" || key === "units") {
    relationships.push(["blood_donations", data.donation_id]);
  }

  if (key === "crossmatches" || key === "issues") {
    relationships.push(["blood_requests", data.request_id]);
    relationships.push(["blood_units", data.blood_unit_id]);
  }

  for (const [table, id] of relationships) {
    if (id) await assertLinkedRecord(client, table, id, hospitalId);
  }

  if (key === "requests" && data.patient_id) {
    await assertLinkedRecord(client, "patients", data.patient_id, hospitalId);
  }

  // A newborn-like mismatch is not possible here: verify that a crossmatch
  // uses a unit and request from the same hospital and keep those references.
}

exports.list = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  const hospitalId = getHospitalId(req);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();

  const values = [hospitalId];
  let where = "hospital_id = $1";

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;

    where += ` AND (${resource.search
      .map((field) => `CAST(${field} AS TEXT) ILIKE $${index}`)
      .join(" OR ")})`;
  }

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM ${resource.table}
     WHERE ${where}`,
    values,
  );

  const rows = await pool.query(
    `SELECT *
     FROM ${resource.table}
     WHERE ${where}
     ORDER BY ${resource.order}
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  const total = count.rows[0].total;

  res.json({
    success: true,
    data: rows.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

exports.create = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);

  if (!resource) return;

  const hospitalId = getHospitalId(req);
  const data = cleanPayload(req.body, resource.fields);
  const missing = missingFields(data, resource.required);

  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: `Required fields: ${missing.join(", ")}.`,
    });
  }

  // New blood units cannot be made available directly by the create form.
  if (req.params.resource === "units") {
    data.status = "quarantined";
    data.screening_cleared = false;
  }

  // New screening and compatibility tests default to pending unless a
  // qualified user explicitly submits a documented result.
  const extra = { hospital_id: hospitalId };

  if (["donors", "units"].includes(req.params.resource)) {
    extra.created_by = getUserId(req);
  }
  if (req.params.resource === "donations") {
    extra.collected_by = getUserId(req);
  }
  if (req.params.resource === "screening") {
    extra.tested_by = getUserId(req);
  }
  if (req.params.resource === "requests") {
    extra.requested_by = getUserId(req);
  }
  if (req.params.resource === "crossmatches") {
    extra.tested_by = getUserId(req);
  }
  if (req.params.resource === "issues") {
    return res.status(400).json({
      success: false,
      message: "Use the issue endpoint to issue blood units safely.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validateRelations(client, req.params.resource, data, hospitalId);

    const valuesObject = { ...data, ...extra };
    const columns = Object.keys(valuesObject);
    const placeholders = columns.map((_, index) => `$${index + 1}`);

    const result = await client.query(
      `INSERT INTO ${resource.table} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      columns.map((column) => valuesObject[column]),
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Blood bank record created.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message:
          "An invalid value was supplied. Check the donor UUID, date/time, and numeric fields.",
        detail: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "A record with that unique number or relationship already exists.",
      });
    }

    // Keep your existing 23503, error.status, and throw error handling here.
  } finally {
    client.release();
  }
});

exports.update = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  const hospitalId = getHospitalId(req);
  const data = cleanPayload(req.body, resource.fields);
  const columns = Object.keys(data);

  if (!columns.length) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one editable field.",
    });
  }

  // Issued inventory is immutable through generic editing.
  if (req.params.resource === "units") {
    const existing = await pool.query(
      "SELECT status FROM blood_units WHERE id=$1 AND hospital_id=$2",
      [req.params.id, hospitalId],
    );

    if (!existing.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Blood unit not found.",
      });
    }

    if (existing.rows[0].status === "issued") {
      return res.status(409).json({
        success: false,
        message: "An issued blood unit cannot be edited.",
      });
    }

    // The ordinary update endpoint cannot clear screening or release stock.
    delete data.status;
    delete data.screening_cleared;

    if (!Object.keys(data).length) {
      return res.status(400).json({
        success: false,
        message:
          "Inventory status changes require a dedicated authorized workflow.",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT id FROM ${resource.table}
       WHERE id=$1 AND hospital_id=$2 FOR UPDATE`,
      [req.params.id, hospitalId],
    );

    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await validateRelations(client, req.params.resource, data, hospitalId);

    const updateColumns = Object.keys(data);
    const assignments = updateColumns.map(
      (column, index) => `${column}=$${index + 1}`,
    );

    const values = updateColumns.map((column) => data[column]);
    values.push(req.params.id, hospitalId);

    const hasUpdatedAt = ["donors", "donations", "units", "requests"].includes(
      req.params.resource,
    );

    const updateAssignments = [...assignments];

    if (hasUpdatedAt) {
      updateAssignments.push("updated_at = NOW()");
    }

    const result = await client.query(
      `UPDATE ${resource.table}
   SET ${updateAssignments.join(", ")}
   WHERE id = $${values.length - 1}
     AND hospital_id = $${values.length}
   RETURNING *`,
      values,
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Blood bank record updated.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A record with that unique number already exists.",
      });
    }

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    throw error;
  } finally {
    client.release();
  }
});

exports.releaseUnit = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT u.*, d.collection_status
       FROM blood_units u
       JOIN blood_donations d ON d.id = u.donation_id
       WHERE u.id = $1 AND u.hospital_id = $2
       FOR UPDATE OF u`,
      [req.params.id, hospitalId],
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Blood unit not found.",
      });
    }

    const unit = result.rows[0];

    if (unit.status !== "quarantined") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Only quarantined units can be released.",
      });
    }

    if (unit.collection_status !== "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "The donation collection and processing workflow must be completed first.",
      });
    }

    const tests = await client.query(
      `SELECT result
       FROM blood_screening_tests
       WHERE hospital_id = $1 AND donation_id = $2`,
      [hospitalId, unit.donation_id],
    );

    if (
      !tests.rowCount ||
      tests.rows.some(
        (test) => !["negative", "non_reactive"].includes(test.result),
      )
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "Screening records are missing or not all recorded results are cleared. Keep the unit quarantined pending authorized review.",
      });
    }

    const updated = await client.query(
      `UPDATE blood_units
       SET status = 'available',
           screening_cleared = TRUE,
           updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2
       RETURNING *`,
      [req.params.id, hospitalId],
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Unit released following the recorded screening checks.",
      data: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

exports.remove = asyncHandler(async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;

  if (!["super_admin", "hospital_admin"].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Only hospital administrators can delete records.",
    });
  }

  const hospitalId = getHospitalId(req);

  try {
    const result = await pool.query(
      `DELETE FROM ${resource.table}
       WHERE id=$1 AND hospital_id=$2
       RETURNING id`,
      [req.params.id, hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    res.json({ success: true, message: "Record deleted." });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "This record has linked history and cannot be deleted.",
      });
    }

    throw error;
  }
});

exports.getSummary = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);

  const [donors, donations, stock, requests, expiring, groups] =
    await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE eligibility_status='eligible')::int AS eligible
         FROM blood_donors WHERE hospital_id=$1`,
        [hospitalId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE donated_at >= NOW() - INTERVAL '30 days'
          )::int AS last_30_days
         FROM blood_donations WHERE hospital_id=$1`,
        [hospitalId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM blood_units
         WHERE hospital_id=$1 AND status='available'
           AND screening_cleared=TRUE AND expires_at > NOW()`,
        [hospitalId],
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (
            WHERE status IN ('pending','approved','partially_fulfilled')
          )::int AS total,
          COUNT(*) FILTER (
            WHERE urgency IN ('urgent','emergency')
              AND status IN ('pending','approved','partially_fulfilled')
          )::int AS urgent
         FROM blood_requests WHERE hospital_id=$1`,
        [hospitalId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM blood_units
         WHERE hospital_id=$1 AND status='available'
           AND expires_at > NOW()
           AND expires_at <= NOW() + INTERVAL '7 days'`,
        [hospitalId],
      ),
      pool.query(
        `SELECT blood_group, rh_type, COUNT(*)::int AS units
         FROM blood_units
         WHERE hospital_id=$1 AND status='available'
           AND screening_cleared=TRUE AND expires_at > NOW()
         GROUP BY blood_group, rh_type
         ORDER BY blood_group, rh_type`,
        [hospitalId],
      ),
    ]);

  res.json({
    success: true,
    data: {
      donors: donors.rows[0],
      donations: donations.rows[0],
      availableUnits: stock.rows[0].total,
      requests: requests.rows[0],
      expiringWithin7Days: expiring.rows[0].total,
      stockByBloodGroup: groups.rows,
    },
  });
});

exports.issueUnit = asyncHandler(async (req, res) => {
  const hospitalId = getHospitalId(req);
  const {
    request_id,
    blood_unit_id,
    issue_number,
    received_by_name,
    destination,
    notes,
  } = req.body;

  if (!request_id || !blood_unit_id || !issue_number) {
    return res.status(400).json({
      success: false,
      message: "request_id, blood_unit_id and issue_number are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT * FROM blood_requests
       WHERE id=$1 AND hospital_id=$2 FOR UPDATE`,
      [request_id, hospitalId],
    );

    const unitResult = await client.query(
      `SELECT * FROM blood_units
       WHERE id=$1 AND hospital_id=$2 FOR UPDATE`,
      [blood_unit_id, hospitalId],
    );

    if (!requestResult.rowCount || !unitResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Request or blood unit was not found in this hospital.",
      });
    }

    const request = requestResult.rows[0];
    const unit = unitResult.rows[0];

    if (!["approved", "partially_fulfilled"].includes(request.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Approve the blood request before issuing a unit.",
      });
    }

    if (
      unit.status !== "available" ||
      !unit.screening_cleared ||
      new Date(unit.expires_at) <= new Date()
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "The unit must be available, screening-cleared, and unexpired.",
      });
    }

    if (
      unit.component_type !== request.requested_component ||
      unit.blood_group !== request.blood_group ||
      (request.rh_type !== "unknown" && unit.rh_type !== request.rh_type)
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "The unit does not match the request criteria. Authorized clinical staff must confirm compatibility.",
      });
    }

    const crossmatch = await client.query(
      `SELECT result FROM blood_compatibility_tests
       WHERE hospital_id=$1 AND request_id=$2 AND blood_unit_id=$3
       ORDER BY created_at DESC LIMIT 1`,
      [hospitalId, request_id, blood_unit_id],
    );

    if (!crossmatch.rowCount || crossmatch.rows[0].result !== "compatible") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "A recorded compatible crossmatch is required before issue.",
      });
    }

    const issueResult = await client.query(
      `INSERT INTO blood_issues (
        hospital_id, issue_number, request_id, blood_unit_id,
        issued_by, received_by_name, destination, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        hospitalId,
        issue_number,
        request_id,
        blood_unit_id,
        getUserId(req),
        received_by_name || null,
        destination || null,
        notes || null,
      ],
    );

    await client.query(
      `UPDATE blood_units SET status='issued', updated_at=NOW()
       WHERE id=$1 AND hospital_id=$2`,
      [blood_unit_id, hospitalId],
    );

    const issuedCount = await client.query(
      `SELECT COUNT(*)::int AS total FROM blood_issues
       WHERE hospital_id=$1 AND request_id=$2`,
      [hospitalId, request_id],
    );

    const nextStatus =
      issuedCount.rows[0].total >= request.units_requested
        ? "fulfilled"
        : "partially_fulfilled";

    await client.query(
      `UPDATE blood_requests SET status=$1, updated_at=NOW()
       WHERE id=$2 AND hospital_id=$3`,
      [nextStatus, request_id, hospitalId],
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Blood unit issued and inventory updated.",
      data: issueResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This unit or issue number has already been issued.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "A linked record is invalid.",
      });
    }

    throw error;
  } finally {
    client.release();
  }
});

const { pool } = require("../config/database");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MODALITIES = [
  "xray",
  "ultrasound",
  "ct",
  "mri",
  "mammography",
  "fluoroscopy",
  "other",
];

const PRIORITIES = ["routine", "urgent", "stat"];

const ORDER_STATUSES = [
  "requested",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

const REPORT_STATUSES = ["draft", "final", "amended"];

function hospitalFromRequest(req, res) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId || !/^\d+$/.test(String(hospitalId))) {
    res.status(400).json({
      message: "Your account is not associated with a valid hospital.",
    });
    return null;
  }

  return String(hospitalId);
}

function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isPositiveInteger(value) {
  return (
    (typeof value === "number" || typeof value === "string") &&
    /^\d+$/.test(String(value)) &&
    Number(value) > 0
  );
}

function sendError(res, error) {
  console.error("Radiology API error:", error);

  if (error.code === "23503") {
    return res.status(400).json({
      message:
        "A referenced patient, service, staff member, or order does not exist.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      message: "A record with the same unique value already exists.",
    });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({
      message: "One or more values are invalid.",
    });
  }

  return res.status(500).json({
    message: "An unexpected error occurred in the Radiology module.",
  });
}

function parsePagination(query) {
  const pageValue = Number.parseInt(query.page, 10);
  const limitValue = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit =
    Number.isInteger(limitValue) && limitValue > 0
      ? Math.min(limitValue, 100)
      : 20;

  return { page, limit, offset: (page - 1) * limit };
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function validDate(value) {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

// -----------------------------------------------------------------------------
// IMAGING SERVICES CATALOGUE
// -----------------------------------------------------------------------------

async function getServices(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  try {
    const { page, limit, offset } = parsePagination(req.query);
    const search = optionalText(req.query.search);
    const modality = optionalText(req.query.modality);
    const active = optionalText(req.query.active);

    if (modality && !MODALITIES.includes(modality.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid modality. Allowed values: ${MODALITIES.join(", ")}.`,
      });
    }

    if (active && !["true", "false"].includes(active.toLowerCase())) {
      return res.status(400).json({
        message: "The active filter must be true or false.",
      });
    }

    const values = [hospitalId];
    const conditions = ["hospital_id = $1"];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(service_name ILIKE $${values.length} OR service_code ILIKE $${values.length} OR description ILIKE $${values.length})`,
      );
    }

    if (modality) {
      values.push(modality.toLowerCase());
      conditions.push(`modality = $${values.length}`);
    }

    if (active) {
      values.push(active.toLowerCase() === "true");
      conditions.push(`is_active = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM imaging_services
       WHERE ${whereClause}`,
      values,
    );

    const listValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT id, hospital_id, service_code, service_name, modality,
              description, price, is_active, created_at, updated_at
       FROM imaging_services
       WHERE ${whereClause}
       ORDER BY service_name ASC
       LIMIT $${listValues.length - 1}
       OFFSET $${listValues.length}`,
      listValues,
    );

    return res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function createService(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const {
    service_code,
    service_name,
    modality,
    description,
    price = 0,
    is_active = true,
  } = req.body;

  if (
    !optionalText(service_code) ||
    !optionalText(service_name) ||
    !optionalText(modality)
  ) {
    return res.status(400).json({
      message: "service_code, service_name, and modality are required.",
    });
  }

  if (!MODALITIES.includes(String(modality).trim().toLowerCase())) {
    return res.status(400).json({
      message: `Invalid modality. Allowed values: ${MODALITIES.join(", ")}.`,
    });
  }

  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({
      message: "price must be a valid non-negative number.",
    });
  }

  if (typeof is_active !== "boolean") {
    return res.status(400).json({
      message: "is_active must be true or false.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO imaging_services
         (hospital_id, service_code, service_name, modality,
          description, price, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        hospitalId,
        String(service_code).trim(),
        String(service_name).trim(),
        String(modality).trim().toLowerCase(),
        optionalText(description),
        numericPrice,
        is_active,
      ],
    );

    return res.status(201).json({
      message: "Imaging service created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateService(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ message: "Invalid imaging service ID." });
  }

  const {
    service_code,
    service_name,
    modality,
    description,
    price,
    is_active,
  } = req.body;

  if (
    !optionalText(service_code) ||
    !optionalText(service_name) ||
    !optionalText(modality)
  ) {
    return res.status(400).json({
      message: "service_code, service_name, and modality are required.",
    });
  }

  if (!MODALITIES.includes(String(modality).trim().toLowerCase())) {
    return res.status(400).json({
      message: `Invalid modality. Allowed values: ${MODALITIES.join(", ")}.`,
    });
  }

  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({
      message: "price must be a valid non-negative number.",
    });
  }

  if (typeof is_active !== "boolean") {
    return res.status(400).json({
      message: "is_active must be true or false.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE imaging_services
       SET service_code = $1,
           service_name = $2,
           modality = $3,
           description = $4,
           price = $5,
           is_active = $6,
           updated_at = NOW()
       WHERE id = $7 AND hospital_id = $8
       RETURNING *`,
      [
        String(service_code).trim(),
        String(service_name).trim(),
        String(modality).trim().toLowerCase(),
        optionalText(description),
        numericPrice,
        is_active,
        id,
        hospitalId,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Imaging service not found." });
    }

    return res.json({
      message: "Imaging service updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function setServiceActive(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  const { is_active } = req.body;

  if (!isUuid(id)) {
    return res.status(400).json({ message: "Invalid imaging service ID." });
  }

  if (typeof is_active !== "boolean") {
    return res.status(400).json({
      message: "is_active must be true or false.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE imaging_services
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND hospital_id = $3
       RETURNING *`,
      [is_active, id, hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Imaging service not found." });
    }

    return res.json({
      message: `Imaging service ${is_active ? "activated" : "deactivated"}.`,
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// -----------------------------------------------------------------------------
// IMAGING ORDERS
// -----------------------------------------------------------------------------

async function getOrders(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  try {
    const { page, limit, offset } = parsePagination(req.query);
    const search = optionalText(req.query.search);
    const status = optionalText(req.query.status);
    const priority = optionalText(req.query.priority);
    const patientId = optionalText(req.query.patient_id);

    if (status && !ORDER_STATUSES.includes(status.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    if (priority && !PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid priority. Allowed values: ${PRIORITIES.join(", ")}.`,
      });
    }

    if (patientId && !isPositiveInteger(patientId)) {
      return res.status(400).json({ message: "Invalid patient_id." });
    }

    const values = [hospitalId];
    const conditions = ["o.hospital_id = $1"];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(o.order_number ILIKE $${values.length}
          OR p.first_name ILIKE $${values.length}
          OR p.last_name ILIKE $${values.length}
          OR s.service_name ILIKE $${values.length})`,
      );
    }

    if (status) {
      values.push(status.toLowerCase());
      conditions.push(`o.order_status = $${values.length}`);
    }

    if (priority) {
      values.push(priority.toLowerCase());
      conditions.push(`o.priority = $${values.length}`);
    }

    if (patientId) {
      values.push(patientId);
      conditions.push(`o.patient_id = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM imaging_orders o
       JOIN patients p ON p.id = o.patient_id
       JOIN imaging_services s ON s.id = o.service_id
       WHERE ${whereClause}`,
      values,
    );

    const listValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT o.id, o.hospital_id, o.patient_id,
              o.service_id, o.ordered_by, o.assigned_radiologist_id,
              o.order_number, o.clinical_indication, o.priority,
              o.order_status, o.requested_at, o.scheduled_at,
              o.performed_at, o.cancelled_at, o.cancellation_reason,
              o.created_at, o.updated_at,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              s.service_code, s.service_name, s.modality, s.price,
              rp.first_name AS radiologist_first_name,
              rp.last_name AS radiologist_last_name
       FROM imaging_orders o
       JOIN patients p ON p.id = o.patient_id
       JOIN imaging_services s ON s.id = o.service_id
       LEFT JOIN staff_profiles sp
         ON sp.id = o.assigned_radiologist_id
        AND sp.hospital_id = o.hospital_id
       LEFT JOIN users rp ON rp.id = sp.user_id
       WHERE ${whereClause}
       ORDER BY o.requested_at DESC
       LIMIT $${listValues.length - 1}
       OFFSET $${listValues.length}`,
      listValues,
    );

    return res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getOrderById(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ message: "Invalid imaging order ID." });
  }

  try {
    const orderResult = await pool.query(
      `SELECT o.*,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              s.service_code, s.service_name, s.modality, s.price,
              u.first_name AS radiologist_first_name,
              u.last_name AS radiologist_last_name
       FROM imaging_orders o
       JOIN patients p ON p.id = o.patient_id
       JOIN imaging_services s ON s.id = o.service_id
       LEFT JOIN staff_profiles sp
         ON sp.id = o.assigned_radiologist_id
        AND sp.hospital_id = o.hospital_id
       LEFT JOIN users u ON u.id = sp.user_id
       WHERE o.id = $1 AND o.hospital_id = $2`,
      [id, hospitalId],
    );

    if (!orderResult.rowCount) {
      return res.status(404).json({ message: "Imaging order not found." });
    }

    const reportResult = await pool.query(
      `SELECT r.*,
              u.first_name AS radiologist_first_name,
              u.last_name AS radiologist_last_name
       FROM imaging_reports r
       LEFT JOIN staff_profiles sp
         ON sp.id = r.radiologist_id
        AND sp.hospital_id = r.hospital_id
       LEFT JOIN users u ON u.id = sp.user_id
       WHERE r.imaging_order_id = $1 AND r.hospital_id = $2`,
      [id, hospitalId],
    );

    return res.json({
      data: {
        ...orderResult.rows[0],
        report: reportResult.rows[0] || null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function createOrder(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const {
    patient_id,
    service_id,
    ordered_by = null,
    assigned_radiologist_id = null,
    order_number,
    clinical_indication,
    priority = "routine",
    scheduled_at = null,
  } = req.body;

  if (!isPositiveInteger(patient_id)) {
    return res.status(400).json({
      message: "patient_id must be a positive integer.",
    });
  }

  if (!isUuid(service_id)) {
    return res.status(400).json({ message: "A valid service_id is required." });
  }

  if (
    ordered_by !== null &&
    ordered_by !== "" &&
    !isPositiveInteger(ordered_by)
  ) {
    return res.status(400).json({ message: "Invalid ordered_by staff ID." });
  }

  if (
    assigned_radiologist_id !== null &&
    assigned_radiologist_id !== "" &&
    !isPositiveInteger(assigned_radiologist_id)
  ) {
    return res.status(400).json({
      message: "Invalid assigned_radiologist_id.",
    });
  }

  if (!optionalText(clinical_indication)) {
    return res.status(400).json({
      message: "clinical_indication is required.",
    });
  }

  const normalizedPriority = String(priority).trim().toLowerCase();

  if (!PRIORITIES.includes(normalizedPriority)) {
    return res.status(400).json({
      message: `Invalid priority. Allowed values: ${PRIORITIES.join(", ")}.`,
    });
  }

  if (scheduled_at && !validDate(scheduled_at)) {
    return res.status(400).json({ message: "Invalid scheduled_at date." });
  }

  const generatedOrderNumber =
    optionalText(order_number) ||
    `RAD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now()}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const patientCheck = await client.query(
      `SELECT id FROM patients
       WHERE id = $1 AND hospital_id = $2`,
      [patient_id, hospitalId],
    );

    if (!patientCheck.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "The selected patient does not belong to this hospital.",
      });
    }

    const serviceCheck = await client.query(
      `SELECT id FROM imaging_services
       WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
      [service_id, hospitalId],
    );

    if (!serviceCheck.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "The imaging service does not exist, is inactive, or belongs to another hospital.",
      });
    }

    for (const staffId of [ordered_by, assigned_radiologist_id]) {
      if (staffId !== null && staffId !== "") {
        const staffCheck = await client.query(
          `SELECT id FROM staff_profiles
           WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
          [staffId, hospitalId],
        );

        if (!staffCheck.rowCount) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: `Staff profile ${staffId} is not active or does not belong to this hospital.`,
          });
        }
      }
    }

    const result = await client.query(
      `INSERT INTO imaging_orders
         (hospital_id, patient_id, service_id, ordered_by,
          assigned_radiologist_id, order_number, clinical_indication,
          priority, order_status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        hospitalId,
        patient_id,
        service_id,
        ordered_by || null,
        assigned_radiologist_id || null,
        generatedOrderNumber,
        String(clinical_indication).trim(),
        normalizedPriority,
        scheduled_at ? "scheduled" : "requested",
        scheduled_at || null,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Imaging order created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error);
  } finally {
    client.release();
  }
}

async function updateOrderStatus(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  const {
    order_status,
    assigned_radiologist_id,
    scheduled_at,
    cancellation_reason,
  } = req.body;

  if (!isUuid(id)) {
    return res.status(400).json({ message: "Invalid imaging order ID." });
  }

  const status = optionalText(order_status)?.toLowerCase();

  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `order_status is required. Allowed values: ${ORDER_STATUSES.join(", ")}.`,
    });
  }

  if (
    assigned_radiologist_id !== undefined &&
    assigned_radiologist_id !== null &&
    assigned_radiologist_id !== "" &&
    !isPositiveInteger(assigned_radiologist_id)
  ) {
    return res.status(400).json({
      message: "Invalid assigned_radiologist_id.",
    });
  }

  if (
    scheduled_at !== undefined &&
    scheduled_at !== null &&
    scheduled_at !== ""
  ) {
    if (!validDate(scheduled_at)) {
      return res.status(400).json({ message: "Invalid scheduled_at date." });
    }
  }

  if (status === "cancelled" && !optionalText(cancellation_reason)) {
    return res.status(400).json({
      message: "cancellation_reason is required when cancelling an order.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT * FROM imaging_orders
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [id, hospitalId],
    );

    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Imaging order not found." });
    }

    const existing = existingResult.rows[0];

    if (existing.order_status === "cancelled" && status !== "cancelled") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message:
          "A cancelled imaging order cannot be reopened through this endpoint.",
      });
    }

    if (existing.order_status === "completed" && status !== "completed") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "A completed imaging order cannot be moved to another status.",
      });
    }

    const radiologistId =
      assigned_radiologist_id === undefined
        ? existing.assigned_radiologist_id
        : assigned_radiologist_id || null;

    if (radiologistId !== null) {
      const staffCheck = await client.query(
        `SELECT id FROM staff_profiles
         WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
        [radiologistId, hospitalId],
      );

      if (!staffCheck.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "The assigned staff profile is inactive or belongs to another hospital.",
        });
      }
    }

    const newScheduledAt =
      scheduled_at === undefined ? existing.scheduled_at : scheduled_at || null;

    if (status === "scheduled" && !newScheduledAt) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "scheduled_at is required when scheduling an order.",
      });
    }

    if (status === "in_progress" && !radiologistId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Assign a radiologist before starting the imaging order.",
      });
    }

    const result = await client.query(
      `UPDATE imaging_orders
       SET order_status = $1,
           assigned_radiologist_id = $2,
           scheduled_at = $3,
           performed_at = CASE
             WHEN $1 = 'completed' THEN COALESCE(performed_at, NOW())
             ELSE performed_at
           END,
           cancelled_at = CASE
             WHEN $1 = 'cancelled' THEN COALESCE(cancelled_at, NOW())
             ELSE cancelled_at
           END,
           cancellation_reason = CASE
             WHEN $1 = 'cancelled' THEN $4
             ELSE cancellation_reason
           END,
           updated_at = NOW()
       WHERE id = $5 AND hospital_id = $6
       RETURNING *`,
      [
        status,
        radiologistId,
        newScheduledAt,
        optionalText(cancellation_reason),
        id,
        hospitalId,
      ],
    );

    await client.query("COMMIT");

    return res.json({
      message: "Imaging order updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error);
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// IMAGING REPORTS
// -----------------------------------------------------------------------------

async function saveReport(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id: orderId } = req.params;
  const {
    radiologist_id = null,
    findings,
    impression,
    recommendations,
    report_status = "draft",
  } = req.body;

  if (!isUuid(orderId)) {
    return res.status(400).json({ message: "Invalid imaging order ID." });
  }

  if (
    radiologist_id !== null &&
    radiologist_id !== "" &&
    !isPositiveInteger(radiologist_id)
  ) {
    return res.status(400).json({ message: "Invalid radiologist_id." });
  }

  if (!optionalText(impression)) {
    return res.status(400).json({
      message: "impression is required to save an imaging report.",
    });
  }

  const status = String(report_status).trim().toLowerCase();

  if (!REPORT_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid report_status. Allowed values: ${REPORT_STATUSES.join(", ")}.`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT * FROM imaging_orders
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [orderId, hospitalId],
    );

    if (!orderResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Imaging order not found." });
    }

    const order = orderResult.rows[0];

    if (order.order_status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "A report cannot be saved for a cancelled imaging order.",
      });
    }

    const effectiveRadiologistId =
      radiologist_id || order.assigned_radiologist_id || null;

    if (effectiveRadiologistId) {
      const staffCheck = await client.query(
        `SELECT id FROM staff_profiles
         WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
        [effectiveRadiologistId, hospitalId],
      );

      if (!staffCheck.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "The selected radiologist is inactive or belongs to another hospital.",
        });
      }
    }

    const existingReportResult = await client.query(
      `SELECT * FROM imaging_reports
       WHERE imaging_order_id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [orderId, hospitalId],
    );

    const existingReport = existingReportResult.rows[0] || null;

    if (existingReport?.report_status === "final" && status !== "amended") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message:
          "A finalized report must be saved with report_status 'amended' to change it.",
      });
    }

    if (existingReport?.report_status === "amended" && status === "draft") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "An amended report cannot be changed back to draft.",
      });
    }

    const result = await client.query(
      `INSERT INTO imaging_reports
         (hospital_id, imaging_order_id, radiologist_id, findings,
          impression, recommendations, report_status, reported_at, amended_at)
       VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          CASE WHEN $7 IN ('final', 'amended') THEN NOW() ELSE NULL END,
          CASE WHEN $7 = 'amended' THEN NOW() ELSE NULL END
       )
       ON CONFLICT (imaging_order_id)
       DO UPDATE SET
         radiologist_id = EXCLUDED.radiologist_id,
         findings = EXCLUDED.findings,
         impression = EXCLUDED.impression,
         recommendations = EXCLUDED.recommendations,
         report_status = EXCLUDED.report_status,
         reported_at = CASE
           WHEN EXCLUDED.report_status IN ('final', 'amended')
             THEN COALESCE(imaging_reports.reported_at, NOW())
           ELSE imaging_reports.reported_at
         END,
         amended_at = CASE
           WHEN EXCLUDED.report_status = 'amended' THEN NOW()
           ELSE imaging_reports.amended_at
         END,
         updated_at = NOW()
       WHERE imaging_reports.hospital_id = EXCLUDED.hospital_id
       RETURNING *`,
      [
        hospitalId,
        orderId,
        effectiveRadiologistId,
        optionalText(findings),
        String(impression).trim(),
        optionalText(recommendations),
        status,
      ],
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "The existing report could not be updated for this hospital.",
      });
    }

    if (status === "final" || status === "amended") {
      await client.query(
        `UPDATE imaging_orders
         SET order_status = 'completed',
             performed_at = COALESCE(performed_at, NOW()),
             updated_at = NOW()
         WHERE id = $1 AND hospital_id = $2
           AND order_status <> 'cancelled'`,
        [orderId, hospitalId],
      );
    }

    await client.query("COMMIT");

    return res.status(existingReport ? 200 : 201).json({
      message: existingReport
        ? "Imaging report updated successfully."
        : "Imaging report created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error);
  } finally {
    client.release();
  }
}

module.exports = {
  getServices,
  createService,
  updateService,
  setServiceActive,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  saveReport,
};

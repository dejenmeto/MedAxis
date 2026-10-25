const { pool } = require("../config/database");

const ORDER_STATUSES = [
  "requested",
  "collected",
  "in_progress",
  "partially_completed",
  "completed",
  "cancelled",
];

const ITEM_STATUSES = ["requested", "in_progress", "completed", "cancelled"];

const ABNORMAL_FLAGS = ["low", "normal", "high", "critical"];

function hospitalFromRequest(req, res) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    res.status(400).json({
      success: false,
      message:
        "Your account has no active hospital. Sign in again after fixing your hospital assignment.",
    });
    return null;
  }

  return hospitalId;
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function sendError(res, error) {
  console.error("Laboratory error:", error);

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "A referenced patient, test, or record does not exist.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with the same unique value already exists.",
    });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({
      success: false,
      message: "One or more submitted values are invalid.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "The laboratory request could not be completed.",
  });
}

// GET /catalog
async function getCatalog(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  try {
    const { search = "", active = "true", limit = 100, page = 1 } = req.query;
    const safeLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 100, 1),
      500,
    );
    const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const values = [hospitalId];
    let where = "WHERE hospital_id = $1";

    if (active === "true" || active === "false") {
      values.push(active === "true");
      where += ` AND is_active = $${values.length}`;
    }

    if (String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      where += ` AND (test_name ILIKE $${values.length}
                  OR test_code ILIKE $${values.length}
                  OR COALESCE(department_name, '') ILIKE $${values.length})`;
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM lab_test_catalog ${where}`,
      values,
    );

    const result = await pool.query(
      `SELECT id, test_code, test_name, specimen_type, department_name,
              price, turnaround_hours, is_active, created_at, updated_at
       FROM lab_test_catalog
       ${where}
       ORDER BY test_name
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, safeLimit, offset],
    );

    res.json({
      success: true,
      catalog: result.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count.rows[0].total,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}

// POST /catalog
async function createCatalogTest(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const {
    test_code,
    test_name,
    specimen_type = null,
    department_name = null,
    price = 0,
    turnaround_hours = null,
  } = req.body;

  if (!String(test_code || "").trim() || !String(test_name || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "Test code and test name are required.",
    });
  }

  const parsedPrice = Number(price);
  const parsedHours =
    turnaround_hours === null || turnaround_hours === ""
      ? null
      : Number(turnaround_hours);

  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "Price must be a non-negative number.",
    });
  }

  if (
    parsedHours !== null &&
    (!Number.isInteger(parsedHours) || parsedHours < 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Turnaround hours must be a non-negative integer.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO lab_test_catalog
       (hospital_id, test_code, test_name, specimen_type,
        department_name, price, turnaround_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        hospitalId,
        String(test_code).trim().toUpperCase(),
        String(test_name).trim(),
        specimen_type,
        department_name,
        parsedPrice,
        parsedHours,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Laboratory test created.",
      test: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
}

// PUT /catalog/:id
async function updateCatalogTest(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  if (!isUuid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid test ID." });
  }

  const {
    test_code,
    test_name,
    specimen_type = null,
    department_name = null,
    price = 0,
    turnaround_hours = null,
    is_active = true,
  } = req.body;

  if (!String(test_code || "").trim() || !String(test_name || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "Test code and test name are required.",
    });
  }

  const parsedPrice = Number(price);
  const parsedHours =
    turnaround_hours === null || turnaround_hours === ""
      ? null
      : Number(turnaround_hours);

  if (
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    (parsedHours !== null &&
      (!Number.isInteger(parsedHours) || parsedHours < 0))
  ) {
    return res.status(400).json({
      success: false,
      message: "Price or turnaround hours are invalid.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE lab_test_catalog
       SET test_code = $1,
           test_name = $2,
           specimen_type = $3,
           department_name = $4,
           price = $5,
           turnaround_hours = $6,
           is_active = $7,
           updated_at = NOW()
       WHERE id = $8 AND hospital_id = $9
       RETURNING *`,
      [
        String(test_code).trim().toUpperCase(),
        String(test_name).trim(),
        specimen_type,
        department_name,
        parsedPrice,
        parsedHours,
        is_active === true || is_active === "true",
        id,
        hospitalId,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Laboratory test not found.",
      });
    }

    res.json({
      success: true,
      message: "Laboratory test updated.",
      test: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
}

// PATCH /catalog/:id/active
async function setCatalogTestActive(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  const { is_active } = req.body;

  if (!isUuid(id) || typeof is_active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "A valid test ID and boolean is_active value are required.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE lab_test_catalog
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND hospital_id = $3
       RETURNING *`,
      [is_active, id, hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Laboratory test not found.",
      });
    }

    res.json({ success: true, test: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /orders
async function getOrders(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  try {
    const { search = "", status = "", page = 1, limit = 20 } = req.query;

    const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 20, 1),
      100,
    );
    const offset = (safePage - 1) * safeLimit;
    const values = [hospitalId];

    let where = "WHERE o.hospital_id = $1";

    if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status.",
        });
      }
      values.push(status);
      where += ` AND o.order_status = $${values.length}`;
    }

    if (String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      where += ` AND (
        o.order_number ILIKE $${values.length}
        OR p.first_name ILIKE $${values.length}
        OR p.last_name ILIKE $${values.length}
      )`;
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM lab_orders o
       JOIN patients p ON p.id = o.patient_id
       ${where}`,
      values,
    );

    const result = await pool.query(
      `SELECT o.id, o.order_number, o.patient_id, o.encounter_id,
              o.clinical_notes, o.priority, o.order_status, o.ordered_at,
              o.collected_at, o.completed_at,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', i.id,
                    'test_id', t.id,
                    'test_name', t.test_name,
                    'test_code', t.test_code,
                    'item_status', i.item_status,
                    'result_value', i.result_value,
                    'result_unit', i.result_unit,
                    'reference_range', i.reference_range,
                    'abnormal_flag', i.abnormal_flag,
                    'result_notes', i.result_notes,
                    'resulted_at', i.resulted_at
                  )
                ) FILTER (WHERE i.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM lab_orders o
       JOIN patients p ON p.id = o.patient_id
       LEFT JOIN lab_order_items i
         ON i.lab_order_id = o.id AND i.hospital_id = o.hospital_id
       LEFT JOIN lab_test_catalog t ON t.id = i.test_id
       ${where}
       GROUP BY o.id, p.id
       ORDER BY o.ordered_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, safeLimit, offset],
    );

    res.json({
      success: true,
      orders: result.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count.rows[0].total,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /orders/:id
async function getOrderById(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  if (!isUuid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid order ID." });
  }

  try {
    const result = await pool.query(
      `SELECT o.*,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', i.id,
                    'test_id', t.id,
                    'test_name', t.test_name,
                    'test_code', t.test_code,
                    'item_status', i.item_status,
                    'result_value', i.result_value,
                    'result_unit', i.result_unit,
                    'reference_range', i.reference_range,
                    'abnormal_flag', i.abnormal_flag,
                    'result_notes', i.result_notes,
                    'resulted_at', i.resulted_at,
                    'verified_at', i.verified_at
                  )
                ) FILTER (WHERE i.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM lab_orders o
       JOIN patients p ON p.id = o.patient_id
       LEFT JOIN lab_order_items i
         ON i.lab_order_id = o.id AND i.hospital_id = o.hospital_id
       LEFT JOIN lab_test_catalog t ON t.id = i.test_id
       WHERE o.id = $1 AND o.hospital_id = $2
       GROUP BY o.id, p.id`,
      [id, hospitalId],
    );

    if (!result.rowCount) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
}

// POST /orders
async function createOrder(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const {
    patient_id,
    encounter_id = null,
    clinical_notes = null,
    priority = "routine",
    test_ids,
  } = req.body;

  if (!patient_id || !Array.isArray(test_ids) || test_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Patient and at least one laboratory test are required.",
    });
  }

  if (!["routine", "urgent", "stat"].includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order priority.",
    });
  }

  if (test_ids.some((id) => !isUuid(id))) {
    return res.status(400).json({
      success: false,
      message: "One or more test IDs are invalid.",
    });
  }

  const uniqueTestIds = [...new Set(test_ids)];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const patient = await client.query(
      "SELECT id FROM patients WHERE id = $1 AND hospital_id = $2",
      [patient_id, hospitalId],
    );

    if (!patient.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Patient not found in the active hospital.",
      });
    }

    if (encounter_id) {
      const encounter = await client.query(
        "SELECT id FROM encounters WHERE id = $1",
        [encounter_id],
      );

      if (!encounter.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Encounter not found.",
        });
      }
    }

    const tests = await client.query(
      `SELECT id FROM lab_test_catalog
       WHERE hospital_id = $1 AND is_active = TRUE AND id = ANY($2::uuid[])`,
      [hospitalId, uniqueTestIds],
    );

    if (tests.rowCount !== uniqueTestIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "One or more tests are inactive or not in this hospital.",
      });
    }

    const orderNumber = `LAB-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const order = await client.query(
      `INSERT INTO lab_orders
       (hospital_id, patient_id, encounter_id, order_number,
        clinical_notes, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        hospitalId,
        patient_id,
        encounter_id,
        orderNumber,
        clinical_notes,
        priority,
      ],
    );

    const createdOrder = order.rows[0];

    for (const testId of uniqueTestIds) {
      await client.query(
        `INSERT INTO lab_order_items (hospital_id, lab_order_id, test_id)
         VALUES ($1, $2, $3)`,
        [hospitalId, createdOrder.id, testId],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Laboratory order created.",
      order: createdOrder,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
}

// PATCH /orders/:id/status
async function updateOrderStatus(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  const { order_status } = req.body;

  if (!isUuid(id) || !ORDER_STATUSES.includes(order_status)) {
    return res.status(400).json({
      success: false,
      message: "Valid order ID and order status are required.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE lab_orders
       SET order_status = $1,
           collected_at = CASE
             WHEN $1 = 'collected' AND collected_at IS NULL THEN NOW()
             ELSE collected_at END,
           completed_at = CASE
             WHEN $1 = 'completed' THEN NOW()
             ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $2 AND hospital_id = $3
       RETURNING *`,
      [order_status, id, hospitalId],
    );

    if (!result.rowCount) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
}

// PATCH /orders/:id/items/:itemId/result
async function saveResult(req, res) {
  const hospitalId = hospitalFromRequest(req, res);
  if (!hospitalId) return;

  const { id, itemId } = req.params;
  const {
    item_status = "completed",
    result_value = null,
    result_unit = null,
    reference_range = null,
    abnormal_flag = null,
    result_notes = null,
  } = req.body;

  if (
    !isUuid(id) ||
    !isUuid(itemId) ||
    !ITEM_STATUSES.includes(item_status) ||
    (abnormal_flag !== null &&
      abnormal_flag !== "" &&
      !ABNORMAL_FLAGS.includes(abnormal_flag))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid order, item, status, or abnormal flag.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE lab_order_items
       SET item_status = $1,
           result_value = $2,
           result_unit = $3,
           reference_range = $4,
           abnormal_flag = NULLIF($5, ''),
           result_notes = $6,
           resulted_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE resulted_at END,
           updated_at = NOW()
       WHERE id = $7 AND lab_order_id = $8 AND hospital_id = $9
       RETURNING *`,
      [
        item_status,
        result_value,
        result_unit,
        reference_range,
        abnormal_flag,
        result_notes,
        itemId,
        id,
        hospitalId,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Laboratory order item not found.",
      });
    }

    res.json({
      success: true,
      message: "Laboratory result saved.",
      item: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  getCatalog,
  createCatalogTest,
  updateCatalogTest,
  setCatalogTestActive,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  saveResult,
};

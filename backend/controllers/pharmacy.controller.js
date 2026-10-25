const { pool } = require("../config/database");

const MOVEMENT_TYPES = [
  "receipt",
  "dispense",
  "return",
  "adjustment_in",
  "adjustment_out",
  "expired",
  "damaged",
];

function getHospitalId(req, res) {
  const id = req.user?.hospitalId;

  if (!id) {
    res.status(400).json({
      success: false,
      message:
        "Your account has no active hospital. Sign in again after fixing your hospital assignment.",
    });
    return null;
  }

  return id;
}

function sendError(res, error) {
  console.error("Pharmacy error:", error);

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "That medication code or batch number already exists.",
    });
  }

  if (["23503", "23514", "22P02"].includes(error.code)) {
    return res.status(400).json({
      success: false,
      message:
        "The submitted pharmacy data is invalid or references a missing record.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "The pharmacy request could not be completed.",
  });
}

function validPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

// GET /medications
async function getMedications(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const { search = "", active = "true", page = 1, limit = 20 } = req.query;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;
    const values = [hospitalId];

    let where = "WHERE m.hospital_id = $1";

    if (active === "true" || active === "false") {
      values.push(active === "true");
      where += ` AND m.is_active = $${values.length}`;
    }

    if (String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      where += ` AND (
        m.name ILIKE $${values.length}
        OR m.code ILIKE $${values.length}
        OR COALESCE(m.generic_name, '') ILIKE $${values.length}
        OR COALESCE(m.category, '') ILIKE $${values.length}
      )`;
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM medications m ${where}`,
      values,
    );

    const result = await pool.query(
      `SELECT m.*,
        COALESCE(stock.total_stock, 0) AS total_stock,
        COALESCE(stock.expiring_batches, 0) AS expiring_batches
       FROM medications m
       LEFT JOIN (
         SELECT medication_id,
           SUM(quantity_remaining) AS total_stock,
           COUNT(*) FILTER (
  WHERE expires_on IS NOT NULL
    AND expires_on >= CURRENT_DATE
    AND expires_on <= CURRENT_DATE + 90
    AND quantity_remaining > 0
) AS expiring_batches
         FROM medication_batches
         WHERE hospital_id = $1
         GROUP BY medication_id
       ) stock ON stock.medication_id = m.id
       ${where}
       ORDER BY m.name
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, safeLimit, offset],
    );

    res.json({
      success: true,
      medications: result.rows,
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

// POST /medications
async function createMedication(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const {
    code,
    name,
    generic_name = null,
    category = null,
    dosage_form = null,
    strength = null,
    manufacturer = null,
    unit_of_measure = "unit",
    reorder_level = 0,
    prescription_required = true,
  } = req.body;

  if (!String(code || "").trim() || !String(name || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "Medication code and name are required.",
    });
  }

  if (!Number.isFinite(Number(reorder_level)) || Number(reorder_level) < 0) {
    return res.status(400).json({
      success: false,
      message: "Reorder level must be zero or greater.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO medications (
        hospital_id, code, name, generic_name, category, dosage_form,
        strength, manufacturer, unit_of_measure, reorder_level,
        prescription_required
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        hospitalId,
        String(code).trim().toUpperCase(),
        String(name).trim(),
        generic_name,
        category,
        dosage_form,
        strength,
        manufacturer,
        String(unit_of_measure).trim() || "unit",
        Number(reorder_level),
        prescription_required !== false,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Medication created.",
      medication: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
}

// PUT /medications/:id
async function updateMedication(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  const {
    code,
    name,
    generic_name = null,
    category = null,
    dosage_form = null,
    strength = null,
    manufacturer = null,
    unit_of_measure = "unit",
    reorder_level = 0,
    prescription_required = true,
    is_active = true,
  } = req.body;

  if (!String(code || "").trim() || !String(name || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "Medication code and name are required.",
    });
  }

  if (!Number.isFinite(Number(reorder_level)) || Number(reorder_level) < 0) {
    return res.status(400).json({
      success: false,
      message: "Reorder level must be zero or greater.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE medications
       SET code = $1, name = $2, generic_name = $3, category = $4,
           dosage_form = $5, strength = $6, manufacturer = $7,
           unit_of_measure = $8, reorder_level = $9,
           prescription_required = $10, is_active = $11,
           updated_at = NOW()
       WHERE id = $12 AND hospital_id = $13
       RETURNING *`,
      [
        String(code).trim().toUpperCase(),
        String(name).trim(),
        generic_name,
        category,
        dosage_form,
        strength,
        manufacturer,
        String(unit_of_measure).trim() || "unit",
        Number(reorder_level),
        prescription_required !== false,
        is_active !== false,
        id,
        hospitalId,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Medication not found.",
      });
    }

    res.json({
      success: true,
      message: "Medication updated.",
      medication: result.rows[0],
    });
  } catch (error) {
    sendError(res, error);
  }
}

// PATCH /medications/:id/active
async function setMedicationActive(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  if (typeof req.body.is_active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "is_active must be true or false.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE medications
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND hospital_id = $3
       RETURNING *`,
      [req.body.is_active, req.params.id, hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Medication not found.",
      });
    }

    res.json({ success: true, medication: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /batches?medication_id=<uuid>
async function getBatches(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const values = [hospitalId];
    let where = "WHERE b.hospital_id = $1";

    if (req.query.medication_id) {
      values.push(req.query.medication_id);
      where += ` AND b.medication_id = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT b.*, m.name AS medication_name, m.code AS medication_code
       FROM medication_batches b
       JOIN medications m
         ON m.id = b.medication_id AND m.hospital_id = b.hospital_id
       ${where}
       ORDER BY b.expires_on ASC NULLS LAST, b.received_at ASC`,
      values,
    );

    res.json({ success: true, batches: result.rows });
  } catch (error) {
    sendError(res, error);
  }
}

// POST /batches/receive
// Creates a batch and its receipt movement atomically.
async function receiveStock(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const {
    medication_id,
    batch_number,
    quantity,
    unit_cost = 0,
    selling_price = 0,
    manufactured_on = null,
    expires_on = null,
    supplier_name = null,
    notes = "Stock received",
  } = req.body;

  if (
    !medication_id ||
    !String(batch_number || "").trim() ||
    !validPositiveNumber(quantity) ||
    !Number.isFinite(Number(unit_cost)) ||
    Number(unit_cost) < 0 ||
    !Number.isFinite(Number(selling_price)) ||
    Number(selling_price) < 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Medication, batch number, positive quantity, and valid prices are required.",
    });
  }

  if (manufactured_on && expires_on && expires_on < manufactured_on) {
    return res.status(400).json({
      success: false,
      message: "Expiry date cannot be earlier than manufacturing date.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const medication = await client.query(
      `SELECT id FROM medications
       WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [medication_id, hospitalId],
    );

    if (!medication.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Active medication not found in this hospital.",
      });
    }

    const batchResult = await client.query(
      `INSERT INTO medication_batches (
        hospital_id, medication_id, batch_number,
        quantity_received, quantity_remaining, unit_cost, selling_price,
        manufactured_on, expires_on, supplier_name, received_by
      )
      VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        hospitalId,
        medication_id,
        String(batch_number).trim(),
        Number(quantity),
        Number(unit_cost),
        Number(selling_price),
        manufactured_on,
        expires_on,
        supplier_name,
        req.user?.id || null,
      ],
    );

    const batch = batchResult.rows[0];

    await client.query(
      `INSERT INTO inventory_movements (
        hospital_id, medication_id, batch_id, movement_type,
        quantity, reference_type, reference_id, notes, performed_by
      )
      VALUES ($1,$2,$3,'receipt',$4,'medication_batch',$3,$5,$6)`,
      [
        hospitalId,
        medication_id,
        batch.id,
        Number(quantity),
        notes,
        req.user?.id || null,
      ],
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Stock received and inventory movement recorded.",
      batch,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
}

// POST /dispense
// Uses earliest-expiring available batches first (FEFO).
async function dispenseStock(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const {
    medication_id,
    quantity,
    reference_id = null,
    notes = null,
  } = req.body;

  if (!medication_id || !validPositiveNumber(quantity)) {
    return res.status(400).json({
      success: false,
      message: "Medication and a positive dispensing quantity are required.",
    });
  }

  const requested = Number(quantity);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const medication = await client.query(
      `SELECT id FROM medications
       WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [medication_id, hospitalId],
    );

    if (!medication.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Active medication not found.",
      });
    }

    const batches = await client.query(
      `SELECT id, quantity_remaining, expires_on
       FROM medication_batches
       WHERE hospital_id = $1
         AND medication_id = $2
         AND quantity_remaining > 0
         AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
       ORDER BY expires_on ASC NULLS LAST, received_at ASC
       FOR UPDATE`,
      [hospitalId, medication_id],
    );

    const available = batches.rows.reduce(
      (sum, batch) => sum + Number(batch.quantity_remaining),
      0,
    );

    if (available < requested) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient unexpired stock. Available quantity: ${available}.`,
      });
    }

    let remaining = requested;
    const movements = [];

    for (const batch of batches.rows) {
      if (remaining <= 0) break;

      const take = Math.min(Number(batch.quantity_remaining), remaining);

      await client.query(
        `UPDATE medication_batches
         SET quantity_remaining = quantity_remaining - $1
         WHERE id = $2 AND hospital_id = $3`,
        [take, batch.id, hospitalId],
      );

      const movement = await client.query(
        `INSERT INTO inventory_movements (
          hospital_id, medication_id, batch_id, movement_type,
          quantity, reference_type, reference_id, notes, performed_by
        )
        VALUES ($1,$2,$3,'dispense',$4,'dispense',$5,$6,$7)
        RETURNING *`,
        [
          hospitalId,
          medication_id,
          batch.id,
          take,
          reference_id,
          notes,
          req.user?.id || null,
        ],
      );

      movements.push(movement.rows[0]);
      remaining -= take;
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Stock dispensed and recorded.",
      dispensed_quantity: requested,
      movements,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
}

// GET /movements
async function getMovements(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const values = [hospitalId];
    let where = "WHERE im.hospital_id = $1";

    if (req.query.medication_id) {
      values.push(req.query.medication_id);
      where += ` AND im.medication_id = $${values.length}`;
    }

    if (req.query.movement_type) {
      if (!MOVEMENT_TYPES.includes(req.query.movement_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movement type.",
        });
      }
      values.push(req.query.movement_type);
      where += ` AND im.movement_type = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT im.*, m.name AS medication_name, m.code AS medication_code,
              b.batch_number
       FROM inventory_movements im
       JOIN medications m
         ON m.id = im.medication_id AND m.hospital_id = im.hospital_id
       LEFT JOIN medication_batches b
         ON b.id = im.batch_id AND b.hospital_id = im.hospital_id
       ${where}
       ORDER BY im.movement_at DESC
       LIMIT 200`,
      values,
    );

    res.json({ success: true, movements: result.rows });
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  getMedications,
  createMedication,
  updateMedication,
  setMedicationActive,
  getBatches,
  receiveStock,
  dispenseStock,
  getMovements,
};

const pool = require("../config/database");

const getHospitalId = (req, res) => {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    res.status(403).json({
      message: "Your account must be assigned to a hospital.",
    });
    return null;
  }

  return hospitalId;
};

const getUserId = (req) => req.user?.id || null;

const equipmentFields = [
  "equipment_code",
  "name",
  "category",
  "manufacturer",
  "model_number",
  "serial_number",
  "location",
  "condition_status",
  "purchase_date",
  "warranty_expiry",
  "notes",
];

const allowedConditions = [
  "new",
  "good",
  "needs_repair",
  "under_maintenance",
  "retired",
];

const allowedPriorities = ["low", "medium", "high", "urgent"];
const allowedStatuses = [
  "open",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
];

const pick = (body, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );

// GET /api/equipment-maintenance/equipment
exports.listEquipment = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const condition = String(req.query.condition || "").trim();
    const active = String(req.query.active || "").trim();

    const values = [hospitalId];
    let where = "WHERE hospital_id = $1";

    if (search) {
      values.push(`%${search}%`);
      where += ` AND (
        name ILIKE $${values.length}
        OR equipment_code ILIKE $${values.length}
        OR category ILIKE $${values.length}
        OR serial_number ILIKE $${values.length}
        OR location ILIKE $${values.length}
      )`;
    }

    if (condition && allowedConditions.includes(condition)) {
      values.push(condition);
      where += ` AND condition_status = $${values.length}`;
    }

    if (active === "true" || active === "false") {
      values.push(active === "true");
      where += ` AND active = $${values.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM hospital_equipment ${where}`,
      values,
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT *
       FROM hospital_equipment
       ${where}
       ORDER BY created_at DESC
       LIMIT $${dataValues.length - 1}
       OFFSET $${dataValues.length}`,
      dataValues,
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("List equipment error:", error);
    res.status(500).json({ message: "Unable to load equipment." });
  }
};

// POST /api/equipment-maintenance/equipment
exports.createEquipment = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const data = pick(req.body, equipmentFields);

  if (!data.equipment_code || !data.name || !data.category) {
    return res.status(400).json({
      message: "Equipment code, name, and category are required.",
    });
  }

  if (
    data.condition_status &&
    !allowedConditions.includes(data.condition_status)
  ) {
    return res.status(400).json({ message: "Invalid equipment condition." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO hospital_equipment (
        hospital_id, equipment_code, name, category, manufacturer,
        model_number, serial_number, location, condition_status,
        purchase_date, warranty_expiry, notes, created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'good'),
        $10,$11,$12,$13
      )
      RETURNING *`,
      [
        hospitalId,
        data.equipment_code,
        data.name,
        data.category,
        data.manufacturer || null,
        data.model_number || null,
        data.serial_number || null,
        data.location || null,
        data.condition_status || null,
        data.purchase_date || null,
        data.warranty_expiry || null,
        data.notes || null,
        getUserId(req),
      ],
    );

    res.status(201).json({
      message: "Equipment created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "That equipment code already exists in this hospital.",
      });
    }

    console.error("Create equipment error:", error);
    res.status(500).json({ message: "Unable to create equipment." });
  }
};

// PATCH /api/equipment-maintenance/equipment/:id
exports.updateEquipment = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const data = pick(req.body, equipmentFields);

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "No editable fields provided." });
  }

  if (
    data.condition_status &&
    !allowedConditions.includes(data.condition_status)
  ) {
    return res.status(400).json({ message: "Invalid equipment condition." });
  }

  try {
    const fields = Object.keys(data);
    const values = fields.map((field) =>
      data[field] === "" ? null : data[field],
    );
    values.push(req.params.id, hospitalId);

    const assignments = fields.map(
      (field, index) => `${field} = $${index + 1}`,
    );

    const result = await pool.query(
      `UPDATE hospital_equipment
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND hospital_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    res.json({
      message: "Equipment updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "That equipment code already exists in this hospital.",
      });
    }

    console.error("Update equipment error:", error);
    res.status(500).json({ message: "Unable to update equipment." });
  }
};

// PATCH /api/equipment-maintenance/equipment/:id/deactivate
// Deactivation preserves equipment and maintenance history.
exports.deactivateEquipment = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const result = await pool.query(
      `UPDATE hospital_equipment
       SET active = FALSE, updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2
       RETURNING id`,
      [req.params.id, hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    res.json({ message: "Equipment deactivated successfully." });
  } catch (error) {
    console.error("Deactivate equipment error:", error);
    res.status(500).json({ message: "Unable to deactivate equipment." });
  }
};

// GET /api/equipment-maintenance/orders
exports.listOrders = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const offset = (page - 1) * limit;
    const status = String(req.query.status || "").trim();

    const values = [hospitalId];
    let where = "WHERE mo.hospital_id = $1";

    if (status && allowedStatuses.includes(status)) {
      values.push(status);
      where += ` AND mo.status = $${values.length}`;
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM equipment_maintenance_orders mo ${where}`,
      values,
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT mo.*, e.equipment_code, e.name AS equipment_name,
              e.location AS equipment_location
       FROM equipment_maintenance_orders mo
       JOIN hospital_equipment e ON e.id = mo.equipment_id
       ${where}
       ORDER BY mo.created_at DESC
       LIMIT $${dataValues.length - 1}
       OFFSET $${dataValues.length}`,
      dataValues,
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: count.rows[0].total,
        totalPages: Math.ceil(count.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("List maintenance orders error:", error);
    res.status(500).json({ message: "Unable to load maintenance orders." });
  }
};

// POST /api/equipment-maintenance/orders
exports.createOrder = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const {
    equipment_id,
    title,
    description,
    priority = "medium",
    assigned_to,
    scheduled_date,
    cost = 0,
  } = req.body;

  if (!equipment_id || !title || !String(title).trim()) {
    return res.status(400).json({
      message: "Equipment and maintenance title are required.",
    });
  }

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({ message: "Invalid maintenance priority." });
  }

  const numericCost = Number(cost);
  if (!Number.isFinite(numericCost) || numericCost < 0) {
    return res.status(400).json({ message: "Cost must be zero or greater." });
  }

  try {
    const equipment = await pool.query(
      `SELECT id FROM hospital_equipment
       WHERE id = $1 AND hospital_id = $2 AND active = TRUE`,
      [equipment_id, hospitalId],
    );

    if (!equipment.rowCount) {
      return res.status(400).json({
        message: "Select active equipment belonging to your hospital.",
      });
    }

    const result = await pool.query(
      `INSERT INTO equipment_maintenance_orders (
        hospital_id, equipment_id, title, description, priority,
        assigned_to, scheduled_date, cost, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        hospitalId,
        equipment_id,
        String(title).trim(),
        description || null,
        priority,
        assigned_to || null,
        scheduled_date || null,
        numericCost,
        getUserId(req),
      ],
    );

    res.status(201).json({
      message: "Maintenance work order created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create maintenance order error:", error);
    res.status(500).json({ message: "Unable to create maintenance order." });
  }
};

// PATCH /api/equipment-maintenance/orders/:id
exports.updateOrder = async (req, res) => {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const editable = [
    "title",
    "description",
    "priority",
    "status",
    "assigned_to",
    "scheduled_date",
    "cost",
    "resolution_notes",
  ];

  const data = pick(req.body, editable);

  if (!Object.keys(data).length) {
    return res.status(400).json({ message: "No editable fields provided." });
  }

  if (data.priority && !allowedPriorities.includes(data.priority)) {
    return res.status(400).json({ message: "Invalid maintenance priority." });
  }

  if (data.status && !allowedStatuses.includes(data.status)) {
    return res.status(400).json({ message: "Invalid maintenance status." });
  }

  if (data.cost !== undefined) {
    const cost = Number(data.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ message: "Cost must be zero or greater." });
    }
    data.cost = cost;
  }

  try {
    const fields = Object.keys(data);
    const values = fields.map((field) =>
      data[field] === "" ? null : data[field],
    );
    values.push(req.params.id, hospitalId);

    const assignments = fields.map(
      (field, index) => `${field} = $${index + 1}`,
    );

    assignments.push(
      `completed_at = CASE
        WHEN $1::text IS NULL THEN completed_at
        ELSE completed_at
       END`,
    );

    // Set completion timestamp only when the status field is included.
    const statusIndex = fields.indexOf("status");
    if (statusIndex >= 0) {
      assignments.pop();
      assignments.push(
        `completed_at = CASE
          WHEN $${statusIndex + 1} = 'completed' THEN COALESCE(completed_at, NOW())
          ELSE completed_at
        END`,
      );
    } else {
      assignments.pop();
    }

    const result = await pool.query(
      `UPDATE equipment_maintenance_orders
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND hospital_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Maintenance order not found." });
    }

    res.json({
      message: "Maintenance work order updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update maintenance order error:", error);
    res.status(500).json({ message: "Unable to update maintenance order." });
  }
};

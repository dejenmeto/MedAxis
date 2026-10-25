const { pool } = require("../config/database");

const MANAGERS = ["super_admin", "hospital_admin"];
const STOCK_STAFF = [
  "super_admin",
  "hospital_admin",
  "pharmacist",
  "receptionist",
];

function hospitalId(req) {
  return req.user?.hospitalId;
}

function userId(req) {
  return req.user?.id || null;
}

function requireHospital(req, res) {
  if (!hospitalId(req)) {
    res.status(403).json({
      success: false,
      message: "Your account is not assigned to a hospital.",
    });
    return false;
  }
  return true;
}

function requireRole(req, res, roles) {
  if (!roles.includes(req.user?.role)) {
    res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action.",
    });
    return false;
  }
  return true;
}

function sendError(res, error) {
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with that code or name already exists.",
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "A referenced record does not exist in this hospital.",
    });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({
      success: false,
      message: "One or more supplied values are invalid.",
    });
  }

  console.error("Inventory & procurement error:", error.message);
  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
}

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

function positiveId(value) {
  return /^\d+$/.test(String(value || "")) && Number(value) > 0;
}

function validText(value, maxLength = 180) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

// -----------------------------------------------------------------------------
// Dashboard summary
// -----------------------------------------------------------------------------
exports.getSummary = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int
          FROM inventory_items
         WHERE hospital_id = $1 AND is_active = TRUE) AS total_items,
       (SELECT COUNT(*)::int
          FROM inventory_items
         WHERE hospital_id = $1
           AND is_active = TRUE
           AND quantity_on_hand <= reorder_level) AS low_stock_items,
       (SELECT COUNT(*)::int
          FROM inventory_items
         WHERE hospital_id = $1
           AND is_active = TRUE
           AND expiry_date IS NOT NULL
           AND expiry_date <= CURRENT_DATE + INTERVAL '30 days') AS expiring_items,
       (SELECT COUNT(*)::int
          FROM inventory_suppliers
         WHERE hospital_id = $1 AND is_active = TRUE) AS active_suppliers,
       (SELECT COUNT(*)::int
          FROM purchase_orders
         WHERE hospital_id = $1
           AND status IN ('submitted', 'approved', 'ordered',
                          'partially_received')) AS pending_orders,
       (SELECT COALESCE(SUM(quantity_on_hand * unit_cost), 0)
          FROM inventory_items
         WHERE hospital_id = $1 AND is_active = TRUE) AS stock_value`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------
exports.listCategories = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT id, name, description, is_active, created_at, updated_at
       FROM inventory_categories
      WHERE hospital_id = $1
      ORDER BY name`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: result.rows });
});

exports.createCategory = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const { name, description = null } = req.body;
  if (!validText(name, 120)) {
    return res.status(400).json({
      success: false,
      message: "Category name is required (maximum 120 characters).",
    });
  }

  const result = await pool.query(
    `INSERT INTO inventory_categories
       (hospital_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [hospitalId(req), name.trim(), description],
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

exports.updateCategory = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const { name, description, is_active } = req.body;
  if (!positiveId(req.params.id) || !validText(name, 120)) {
    return res.status(400).json({
      success: false,
      message: "A valid category ID and name are required.",
    });
  }

  const result = await pool.query(
    `UPDATE inventory_categories
        SET name = $3,
            description = $4,
            is_active = COALESCE($5, is_active),
            updated_at = NOW()
      WHERE hospital_id = $1 AND id = $2
      RETURNING *`,
    [
      hospitalId(req),
      req.params.id,
      name.trim(),
      description ?? null,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Category not found.",
    });
  }

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// Inventory items: paginated list, create, update, deactivate
// -----------------------------------------------------------------------------
exports.listItems = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();
  const stock = String(req.query.stock || "all");
  const active = req.query.active !== "false";

  const params = [hospitalId(req), `%${search}%`, active];
  let stockFilter = "";

  if (stock === "low") {
    stockFilter = "AND i.quantity_on_hand <= i.reorder_level";
  } else if (stock === "expiring") {
    stockFilter = `AND i.expiry_date IS NOT NULL
                   AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`;
  } else if (stock === "out") {
    stockFilter = "AND i.quantity_on_hand = 0";
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM inventory_items i
      WHERE i.hospital_id = $1
        AND ($2 = '%%' OR i.name ILIKE $2 OR i.item_code ILIKE $2)
        AND i.is_active = $3
        ${stockFilter}`,
    params,
  );

  const result = await pool.query(
    `SELECT i.*,
            c.name AS category_name,
            CASE
              WHEN i.quantity_on_hand = 0 THEN 'out_of_stock'
              WHEN i.quantity_on_hand <= i.reorder_level THEN 'low_stock'
              ELSE 'in_stock'
            END AS stock_status
       FROM inventory_items i
       LEFT JOIN inventory_categories c
         ON c.hospital_id = i.hospital_id AND c.id = i.category_id
      WHERE i.hospital_id = $1
        AND ($2 = '%%' OR i.name ILIKE $2 OR i.item_code ILIKE $2)
        AND i.is_active = $3
        ${stockFilter}
      ORDER BY i.name
      LIMIT $4 OFFSET $5`,
    [...params, limit, offset],
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      pages: Math.ceil(countResult.rows[0].total / limit),
    },
  });
});

exports.createItem = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const {
    category_id = null,
    item_code,
    name,
    description = null,
    unit = "piece",
    reorder_level = 0,
    unit_cost = 0,
    storage_location = null,
    expiry_date = null,
    opening_quantity = 0,
  } = req.body;

  if (!validText(item_code, 80) || !validText(name) || !validText(unit, 40)) {
    return res.status(400).json({
      success: false,
      message: "Item code, name, and unit are required.",
    });
  }

  const opening = Number(opening_quantity);
  const reorder = Number(reorder_level);
  const cost = Number(unit_cost);

  if (
    ![opening, reorder, cost].every(Number.isFinite) ||
    opening < 0 ||
    reorder < 0 ||
    cost < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Quantities and cost must be valid non-negative numbers.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO inventory_items
         (hospital_id, category_id, item_code, name, description, unit,
          quantity_on_hand, reorder_level, unit_cost, storage_location,
          expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        hospitalId(req),
        category_id,
        item_code.trim(),
        name.trim(),
        description,
        unit.trim(),
        opening,
        reorder,
        cost,
        storage_location,
        expiry_date,
      ],
    );

    const item = inserted.rows[0];

    if (opening > 0) {
      await client.query(
        `INSERT INTO inventory_stock_transactions
           (hospital_id, item_id, transaction_type, quantity, unit_cost,
            reference_type, notes, performed_by)
         VALUES ($1, $2, 'opening_stock', $3, $4,
                 'inventory_item', 'Opening stock', $5)`,
        [hospitalId(req), item.id, opening, cost, userId(req)],
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
});

exports.updateItem = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const {
    category_id = null,
    item_code,
    name,
    description = null,
    unit,
    reorder_level,
    unit_cost,
    storage_location = null,
    expiry_date = null,
    is_active,
  } = req.body;

  if (
    !positiveId(req.params.id) ||
    !validText(item_code, 80) ||
    !validText(name) ||
    !validText(unit, 40)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid item ID, code, name, and unit are required.",
    });
  }

  const reorder = Number(reorder_level);
  const cost = Number(unit_cost);

  if (![reorder, cost].every(Number.isFinite) || reorder < 0 || cost < 0) {
    return res.status(400).json({
      success: false,
      message: "Reorder level and cost must be non-negative numbers.",
    });
  }

  const result = await pool.query(
    `UPDATE inventory_items
        SET category_id = $3,
            item_code = $4,
            name = $5,
            description = $6,
            unit = $7,
            reorder_level = $8,
            unit_cost = $9,
            storage_location = $10,
            expiry_date = $11,
            is_active = COALESCE($12, is_active),
            updated_at = NOW()
      WHERE hospital_id = $1 AND id = $2
      RETURNING *`,
    [
      hospitalId(req),
      req.params.id,
      category_id,
      item_code.trim(),
      name.trim(),
      description,
      unit.trim(),
      reorder,
      cost,
      storage_location,
      expiry_date,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Inventory item not found.",
    });
  }

  res.json({ success: true, data: result.rows[0] });
});

// Stock quantities are changed only through the transaction endpoint
// or the goods-receipt endpoint, never by directly editing an item.
exports.deactivateItem = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const result = await pool.query(
    `UPDATE inventory_items
        SET is_active = FALSE, updated_at = NOW()
      WHERE hospital_id = $1 AND id = $2
      RETURNING id, item_code, name, is_active`,
    [hospitalId(req), req.params.id],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Inventory item not found.",
    });
  }

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// Suppliers
// -----------------------------------------------------------------------------
exports.listSuppliers = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const search = `%${String(req.query.search || "").trim()}%`;
  const result = await pool.query(
    `SELECT *
       FROM inventory_suppliers
      WHERE hospital_id = $1
        AND (name ILIKE $2 OR supplier_code ILIKE $2
             OR COALESCE(contact_person, '') ILIKE $2)
      ORDER BY name`,
    [hospitalId(req), search],
  );

  res.json({ success: true, data: result.rows });
});

exports.createSupplier = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const {
    supplier_code,
    name,
    contact_person = null,
    email = null,
    phone = null,
    address = null,
    tax_number = null,
    payment_terms = null,
    notes = null,
  } = req.body;

  if (!validText(supplier_code, 60) || !validText(name)) {
    return res.status(400).json({
      success: false,
      message: "Supplier code and name are required.",
    });
  }

  const result = await pool.query(
    `INSERT INTO inventory_suppliers
       (hospital_id, supplier_code, name, contact_person, email, phone,
        address, tax_number, payment_terms, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      hospitalId(req),
      supplier_code.trim(),
      name.trim(),
      contact_person,
      email,
      phone,
      address,
      tax_number,
      payment_terms,
      notes,
    ],
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

exports.updateSupplier = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const {
    supplier_code,
    name,
    contact_person = null,
    email = null,
    phone = null,
    address = null,
    tax_number = null,
    payment_terms = null,
    notes = null,
    is_active,
  } = req.body;

  if (
    !positiveId(req.params.id) ||
    !validText(supplier_code, 60) ||
    !validText(name)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid supplier ID, code, and name are required.",
    });
  }

  const result = await pool.query(
    `UPDATE inventory_suppliers
        SET supplier_code = $3, name = $4, contact_person = $5,
            email = $6, phone = $7, address = $8, tax_number = $9,
            payment_terms = $10, notes = $11,
            is_active = COALESCE($12, is_active), updated_at = NOW()
      WHERE hospital_id = $1 AND id = $2
      RETURNING *`,
    [
      hospitalId(req),
      req.params.id,
      supplier_code.trim(),
      name.trim(),
      contact_person,
      email,
      phone,
      address,
      tax_number,
      payment_terms,
      notes,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Supplier not found.",
    });
  }

  res.json({ success: true, data: result.rows[0] });
});

// -----------------------------------------------------------------------------
// Manual stock transaction: receipt, issue, adjustment, or return
// -----------------------------------------------------------------------------
exports.createStockTransaction = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, STOCK_STAFF)) return;

  const {
    item_id,
    transaction_type,
    quantity,
    unit_cost = 0,
    notes = null,
  } = req.body;

  const amount = Number(quantity);
  const cost = Number(unit_cost);
  const allowed = [
    "receipt",
    "issue",
    "adjustment_in",
    "adjustment_out",
    "return",
  ];

  if (
    !positiveId(item_id) ||
    !allowed.includes(transaction_type) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(cost) ||
    cost < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid item, transaction type, quantity, and cost.",
    });
  }

  if (
    ["adjustment_in", "adjustment_out"].includes(transaction_type) &&
    !requireRole(req, res, MANAGERS)
  ) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const locked = await client.query(
      `SELECT id, quantity_on_hand, unit_cost
         FROM inventory_items
        WHERE hospital_id = $1 AND id = $2 AND is_active = TRUE
        FOR UPDATE`,
      [hospitalId(req), item_id],
    );

    if (!locked.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Active inventory item not found.",
      });
    }

    const item = locked.rows[0];
    const subtracts = ["issue", "adjustment_out"].includes(transaction_type);
    const nextQuantity =
      Number(item.quantity_on_hand) + (subtracts ? -amount : amount);

    if (nextQuantity < 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Insufficient stock for this transaction.",
      });
    }

    await client.query(
      `UPDATE inventory_items
          SET quantity_on_hand = $3,
              unit_cost = CASE WHEN $4 > 0 THEN $4 ELSE unit_cost END,
              updated_at = NOW()
        WHERE hospital_id = $1 AND id = $2`,
      [hospitalId(req), item_id, nextQuantity, cost],
    );

    const movement = await client.query(
      `INSERT INTO inventory_stock_transactions
         (hospital_id, item_id, transaction_type, quantity, unit_cost,
          reference_type, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7)
       RETURNING *`,
      [
        hospitalId(req),
        item_id,
        transaction_type,
        amount,
        cost || Number(item.unit_cost),
        notes,
        userId(req),
      ],
    );

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      data: movement.rows[0],
      quantity_on_hand: nextQuantity,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
});

exports.listStockTransactions = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT t.*, i.item_code, i.name AS item_name, i.unit
       FROM inventory_stock_transactions t
       JOIN inventory_items i
         ON i.hospital_id = t.hospital_id AND i.id = t.item_id
      WHERE t.hospital_id = $1
      ORDER BY t.created_at DESC
      LIMIT 200`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: result.rows });
});

// -----------------------------------------------------------------------------
// Purchase orders
// -----------------------------------------------------------------------------
exports.listPurchaseOrders = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const status = String(req.query.status || "");
  const result = await pool.query(
    `SELECT p.*, s.name AS supplier_name
       FROM purchase_orders p
       JOIN inventory_suppliers s
         ON s.hospital_id = p.hospital_id AND s.id = p.supplier_id
      WHERE p.hospital_id = $1
        AND ($2 = '' OR p.status = $2)
      ORDER BY p.created_at DESC
      LIMIT 200`,
    [hospitalId(req), status],
  );

  res.json({ success: true, data: result.rows });
});

exports.createPurchaseOrder = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, MANAGERS)) return;

  const {
    order_number,
    supplier_id,
    expected_delivery_date = null,
    currency = "ETB",
    notes = null,
    items,
  } = req.body;

  if (
    !validText(order_number, 80) ||
    !positiveId(supplier_id) ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Order number, supplier, and at least one order item are required.",
    });
  }

  const normalized = [];
  const seen = new Set();

  for (const line of items) {
    const id = String(line.item_id || "");
    const qty = Number(line.quantity_ordered);
    const cost = Number(line.unit_cost);

    if (
      !positiveId(id) ||
      seen.has(id) ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Each item must be unique and have a valid quantity and cost.",
      });
    }

    seen.add(id);
    normalized.push({ itemId: id, quantity: qty, cost });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const supplier = await client.query(
      `SELECT id FROM inventory_suppliers
        WHERE hospital_id = $1 AND id = $2 AND is_active = TRUE`,
      [hospitalId(req), supplier_id],
    );

    if (!supplier.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Active supplier not found.",
      });
    }

    let subtotal = 0;

    for (const line of normalized) {
      const item = await client.query(
        `SELECT id FROM inventory_items
          WHERE hospital_id = $1 AND id = $2 AND is_active = TRUE`,
        [hospitalId(req), line.itemId],
      );

      if (!item.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Inventory item ${line.itemId} was not found in this hospital.`,
        });
      }

      subtotal += line.quantity * line.cost;
    }

    const orderResult = await client.query(
      `INSERT INTO purchase_orders
         (hospital_id, order_number, supplier_id, status,
          expected_delivery_date, currency, subtotal, total_amount,
          notes, created_by)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $6, $7, $8)
       RETURNING *`,
      [
        hospitalId(req),
        order_number.trim(),
        supplier_id,
        expected_delivery_date,
        currency,
        subtotal,
        notes,
        userId(req),
      ],
    );

    const order = orderResult.rows[0];
    const lines = [];

    for (const line of normalized) {
      const inserted = await client.query(
        `INSERT INTO purchase_order_items
           (hospital_id, purchase_order_id, item_id,
            quantity_ordered, unit_cost)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [hospitalId(req), order.id, line.itemId, line.quantity, line.cost],
      );
      lines.push(inserted.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      data: { ...order, items: lines },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
});

exports.updatePurchaseOrderStatus = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { status } = req.body;
  const allowed = ["submitted", "approved", "ordered", "cancelled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid purchase order status.",
    });
  }

  if (!requireRole(req, res, MANAGERS)) return;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const locked = await client.query(
      `SELECT id, status
         FROM purchase_orders
        WHERE hospital_id = $1 AND id = $2
        FOR UPDATE`,
      [hospitalId(req), req.params.id],
    );

    if (!locked.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Purchase order not found.",
      });
    }

    const current = locked.rows[0].status;
    const transitions = {
      draft: ["submitted", "cancelled"],
      submitted: ["approved", "cancelled"],
      approved: ["ordered", "cancelled"],
      ordered: ["cancelled"],
      partially_received: [],
      received: [],
      cancelled: [],
    };

    if (!transitions[current]?.includes(status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot change an order from ${current} to ${status}.`,
      });
    }

    const updated = await client.query(
      `UPDATE purchase_orders
          SET status = $3,
              approved_by = CASE WHEN $3 = 'approved' THEN $4 ELSE approved_by END,
              approved_at = CASE WHEN $3 = 'approved' THEN NOW() ELSE approved_at END,
              updated_at = NOW()
        WHERE hospital_id = $1 AND id = $2
        RETURNING *`,
      [hospitalId(req), req.params.id, status, userId(req)],
    );

    await client.query("COMMIT");
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
});

// -----------------------------------------------------------------------------
// Goods receipt. All stock and receipt updates happen in one transaction.
// -----------------------------------------------------------------------------
exports.receivePurchaseOrder = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;
  if (!requireRole(req, res, STOCK_STAFF)) return;

  const { receipt_number, items, notes = null } = req.body;

  if (
    !validText(receipt_number, 80) ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: "Receipt number and at least one received item are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT *
         FROM purchase_orders
        WHERE hospital_id = $1 AND id = $2
        FOR UPDATE`,
      [hospitalId(req), req.params.id],
    );

    if (!orderResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Purchase order not found.",
      });
    }

    const order = orderResult.rows[0];

    if (!["ordered", "partially_received"].includes(order.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Only ordered purchase orders can receive goods.",
      });
    }

    const receiptResult = await client.query(
      `INSERT INTO goods_receipts
         (hospital_id, purchase_order_id, receipt_number, received_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [hospitalId(req), order.id, receipt_number.trim(), userId(req), notes],
    );

    const receipt = receiptResult.rows[0];
    const seen = new Set();

    for (const line of items) {
      const orderItemId = String(line.purchase_order_item_id || "");
      const quantity = Number(line.quantity_received);

      if (
        !positiveId(orderItemId) ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        seen.has(orderItemId)
      ) {
        throw Object.assign(new Error("Invalid or duplicate receipt line."), {
          code: "22P02",
        });
      }
      seen.add(orderItemId);

      const lineResult = await client.query(
        `SELECT poi.*, i.quantity_on_hand, i.is_active
           FROM purchase_order_items poi
           JOIN inventory_items i
             ON i.hospital_id = poi.hospital_id AND i.id = poi.item_id
          WHERE poi.hospital_id = $1
            AND poi.purchase_order_id = $2
            AND poi.id = $3
          FOR UPDATE OF poi, i`,
        [hospitalId(req), order.id, orderItemId],
      );

      if (!lineResult.rowCount) {
        throw Object.assign(new Error("Order item not found."), {
          code: "23503",
        });
      }

      const lineRecord = lineResult.rows[0];
      const remaining =
        Number(lineRecord.quantity_ordered) -
        Number(lineRecord.quantity_received);

      if (!lineRecord.is_active || quantity > remaining) {
        throw Object.assign(
          new Error("Received quantity exceeds remaining quantity."),
          {
            code: "23514",
          },
        );
      }

      await client.query(
        `UPDATE purchase_order_items
            SET quantity_received = quantity_received + $3
          WHERE hospital_id = $1 AND id = $2`,
        [hospitalId(req), orderItemId, quantity],
      );

      await client.query(
        `UPDATE inventory_items
            SET quantity_on_hand = quantity_on_hand + $3,
                unit_cost = $4,
                updated_at = NOW()
          WHERE hospital_id = $1 AND id = $2`,
        [hospitalId(req), lineRecord.item_id, quantity, lineRecord.unit_cost],
      );

      await client.query(
        `INSERT INTO goods_receipt_items
           (hospital_id, goods_receipt_id, purchase_order_item_id,
            item_id, quantity_received, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          hospitalId(req),
          receipt.id,
          orderItemId,
          lineRecord.item_id,
          quantity,
          lineRecord.unit_cost,
        ],
      );

      await client.query(
        `INSERT INTO inventory_stock_transactions
           (hospital_id, item_id, transaction_type, quantity, unit_cost,
            reference_type, reference_id, notes, performed_by)
         VALUES ($1, $2, 'receipt', $3, $4,
                 'goods_receipt', $5, $6, $7)`,
        [
          hospitalId(req),
          lineRecord.item_id,
          quantity,
          lineRecord.unit_cost,
          receipt.id,
          notes,
          userId(req),
        ],
      );
    }

    const totals = await client.query(
      `SELECT COUNT(*)::int AS line_count,
              COUNT(*) FILTER (
                WHERE quantity_received < quantity_ordered
              )::int AS remaining_lines
         FROM purchase_order_items
        WHERE hospital_id = $1 AND purchase_order_id = $2`,
      [hospitalId(req), order.id],
    );

    const nextStatus =
      totals.rows[0].remaining_lines === 0 ? "received" : "partially_received";

    await client.query(
      `UPDATE purchase_orders
          SET status = $3, updated_at = NOW()
        WHERE hospital_id = $1 AND id = $2`,
      [hospitalId(req), order.id, nextStatus],
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      data: {
        receipt,
        purchase_order_status: nextStatus,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(res, error);
  } finally {
    client.release();
  }
});

// -----------------------------------------------------------------------------
// Stock reports
// -----------------------------------------------------------------------------
exports.getLowStock = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT id, item_code, name, unit, quantity_on_hand, reorder_level
       FROM inventory_items
      WHERE hospital_id = $1
        AND is_active = TRUE
        AND quantity_on_hand <= reorder_level
      ORDER BY quantity_on_hand ASC, name`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: result.rows });
});

exports.getExpiringItems = asyncRoute(async (req, res) => {
  if (!requireHospital(req, res)) return;

  const result = await pool.query(
    `SELECT id, item_code, name, quantity_on_hand, unit, expiry_date
       FROM inventory_items
      WHERE hospital_id = $1
        AND is_active = TRUE
        AND expiry_date IS NOT NULL
        AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY expiry_date ASC`,
    [hospitalId(req)],
  );

  res.json({ success: true, data: result.rows });
});

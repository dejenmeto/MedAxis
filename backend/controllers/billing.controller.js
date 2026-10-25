const { pool } = require("../config/database");

function getHospitalId(req, res) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    res.status(400).json({
      success: false,
      message:
        "Your account has no active hospital. Sign out and sign in again.",
    });
    return null;
  }

  return hospitalId;
}

function sendError(res, error, message = "Billing operation failed.") {
  console.error("[Billing]", error.message);

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "The selected patient or related record does not exist.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with this identifier already exists.",
    });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({
      success: false,
      message: "One or more billing values are invalid.",
    });
  }

  return res.status(500).json({ success: false, message });
}

function validAmount(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function calculateItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new Error("Add between 1 and 100 invoice items.");
  }

  let subtotal = 0;
  let discount = 0;
  let tax = 0;

  const normalizedItems = items.map((item) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unit_price ?? 0);
    const itemDiscount = Number(item.discount_amount ?? 0);
    const itemTax = Number(item.tax_amount ?? 0);

    if (
      !description ||
      description.length > 255 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !validAmount(unitPrice) ||
      !validAmount(itemDiscount) ||
      !validAmount(itemTax)
    ) {
      throw new Error(
        "Check each item's description, quantity, price, discount and tax.",
      );
    }

    const gross = Math.round(quantity * unitPrice * 100) / 100;

    if (itemDiscount > gross) {
      throw new Error("An item discount cannot exceed its price.");
    }

    const lineTotal = Math.round((gross - itemDiscount + itemTax) * 100) / 100;

    subtotal += gross;
    discount += itemDiscount;
    tax += itemTax;

    return {
      description,
      item_type: String(item.item_type || "service").slice(0, 50),
      quantity,
      unit_price: unitPrice,
      discount_amount: itemDiscount,
      tax_amount: itemTax,
      line_total: lineTotal,
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  discount = Math.round(discount * 100) / 100;
  tax = Math.round(tax * 100) / 100;

  return {
    items: normalizedItems,
    subtotal,
    discount,
    tax,
    total: Math.round((subtotal - discount + tax) * 100) / 100,
  };
}

async function listInvoices(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `SELECT i.*
       FROM invoices i
       WHERE i.hospital_id = $1
         AND (
           $2 = ''
           OR i.invoice_number ILIKE '%' || $2 || '%'
           OR i.patient_id::text ILIKE '%' || $2 || '%'
           OR i.invoice_status ILIKE '%' || $2 || '%'
         )
       ORDER BY i.created_at DESC
       LIMIT $3 OFFSET $4`,
      [hospitalId, search, limit, offset],
    );

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM invoices i
       WHERE i.hospital_id = $1
         AND (
           $2 = ''
           OR i.invoice_number ILIKE '%' || $2 || '%'
           OR i.patient_id::text ILIKE '%' || $2 || '%'
           OR i.invoice_status ILIKE '%' || $2 || '%'
         )`,
      [hospitalId, search],
    );

    res.json({
      success: true,
      data: {
        invoices: result.rows,
        pagination: {
          page,
          limit,
          total: count.rows[0].total,
          pages: Math.ceil(count.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    return sendError(res, error, "Unable to load invoices.");
  }
}

async function readInvoice(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const invoiceResult = await pool.query(
      `SELECT *
       FROM invoices
       WHERE id = $1 AND hospital_id = $2`,
      [req.params.id, hospitalId],
    );

    if (!invoiceResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    const invoice = invoiceResult.rows[0];

    const [items, payments] = await Promise.all([
      pool.query(
        `SELECT *
         FROM invoice_items
         WHERE invoice_id = $1 AND hospital_id = $2
         ORDER BY created_at`,
        [invoice.id, hospitalId],
      ),
      pool.query(
        `SELECT *
         FROM payments
         WHERE invoice_id = $1 AND hospital_id = $2
         ORDER BY paid_at DESC`,
        [invoice.id, hospitalId],
      ),
    ]);

    res.json({
      success: true,
      data: { ...invoice, items: items.rows, payments: payments.rows },
    });
  } catch (error) {
    return sendError(res, error, "Unable to load invoice details.");
  }
}

async function createInvoice(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const patientId = String(req.body.patient_id || "").trim();
  const currency = String(req.body.currency || "ETB").toUpperCase();
  const dueAt = req.body.due_at || null;
  const notes = req.body.notes ? String(req.body.notes).trim() : null;

  let calculated;

  try {
    calculated = calculateItems(req.body.items);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (!patientId || !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({
      success: false,
      message: "A valid patient ID and three-letter currency are required.",
    });
  }

  if (dueAt && Number.isNaN(Date.parse(dueAt))) {
    return res.status(400).json({
      success: false,
      message: "The due date is invalid.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const patient = await client.query(
      `SELECT id
       FROM patients
       WHERE id = $1 AND hospital_id = $2`,
      [patientId, hospitalId],
    );

    if (!patient.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "Patient not found in your active hospital. Check the patient ID.",
      });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const invoiceResult = await client.query(
      `INSERT INTO invoices (
         hospital_id, patient_id, invoice_number, currency,
         invoice_status, subtotal, discount_amount, tax_amount,
         total_amount, amount_paid, balance_amount, due_at, notes,
         created_by
       )
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, 0, $8, $9, $10, $11)
       RETURNING *`,
      [
        hospitalId,
        patientId,
        invoiceNumber,
        currency,
        calculated.subtotal,
        calculated.discount,
        calculated.tax,
        calculated.total,
        dueAt,
        notes,
        req.user?.id || null,
      ],
    );

    const invoice = invoiceResult.rows[0];

    for (const item of calculated.items) {
      await client.query(
        `INSERT INTO invoice_items (
           hospital_id, invoice_id, description, item_type,
           quantity, unit_price, discount_amount, tax_amount, line_total
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          hospitalId,
          invoice.id,
          item.description,
          item.item_type,
          item.quantity,
          item.unit_price,
          item.discount_amount,
          item.tax_amount,
          item.line_total,
        ],
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully.",
      data: invoice,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error, "Unable to create invoice.");
  } finally {
    client.release();
  }
}

async function issueInvoice(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const result = await pool.query(
      `UPDATE invoices
       SET invoice_status = 'issued',
           issued_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND hospital_id = $2
         AND invoice_status = 'draft'
       RETURNING *`,
      [req.params.id, hospitalId],
    );

    if (!result.rows.length) {
      return res.status(409).json({
        success: false,
        message: "Invoice not found or it is no longer a draft.",
      });
    }

    return res.json({
      success: true,
      message: "Invoice issued successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error, "Unable to issue invoice.");
  }
}

async function updateDraftInvoice(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  return res.status(400).json({
    success: false,
    message:
      "Draft editing is not enabled yet. Create a corrected draft instead; issued invoices cannot be edited here.",
  });
}

async function voidInvoice(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const result = await pool.query(
      `UPDATE invoices
       SET invoice_status = 'void', updated_at = NOW()
       WHERE id = $1
         AND hospital_id = $2
         AND invoice_status IN ('draft', 'issued')
         AND amount_paid = 0
       RETURNING *`,
      [req.params.id, hospitalId],
    );

    if (!result.rows.length) {
      return res.status(409).json({
        success: false,
        message:
          "Invoice not found, already paid in part, or cannot be voided.",
      });
    }

    return res.json({
      success: true,
      message: "Invoice voided successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error, "Unable to void invoice.");
  }
}

async function listInvoicePayments(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const result = await pool.query(
      `SELECT p.*
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.invoice_id = $1
         AND p.hospital_id = $2
         AND i.hospital_id = $2
       ORDER BY p.paid_at DESC`,
      [req.params.id, hospitalId],
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error, "Unable to load payment history.");
  }
}

async function listPayments(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  try {
    const result = await pool.query(
      `SELECT p.*
       FROM payments p
       WHERE p.hospital_id = $1
       ORDER BY p.paid_at DESC
       LIMIT 100`,
      [hospitalId],
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error, "Unable to load payments.");
  }
}

async function recordPayment(req, res) {
  const hospitalId = getHospitalId(req, res);
  if (!hospitalId) return;

  const amount = Number(req.body.amount);
  const method = String(req.body.payment_method || "");
  const allowedMethods = [
    "cash",
    "card",
    "bank_transfer",
    "mobile_money",
    "insurance",
    "other",
  ];

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !allowedMethods.includes(method)
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a positive payment amount and valid payment method.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const invoiceResult = await client.query(
      `SELECT *
       FROM invoices
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [req.params.id, hospitalId],
    );

    const invoice = invoiceResult.rows[0];

    if (!invoice) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    if (
      !["issued", "partially_paid", "overdue"].includes(invoice.invoice_status)
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Only issued invoices can receive payments.",
      });
    }

    const balance = Number(invoice.balance_amount);

    if (amount > balance + 0.001) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Payment exceeds the outstanding balance of ${balance.toFixed(2)} ${invoice.currency}.`,
      });
    }

    const paymentResult = await client.query(
      `INSERT INTO payments (
         hospital_id, invoice_id, payment_reference, payment_method,
         amount, currency, payment_status, received_by, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8)
       RETURNING *`,
      [
        hospitalId,
        invoice.id,
        req.body.payment_reference
          ? String(req.body.payment_reference).trim()
          : null,
        method,
        amount,
        invoice.currency,
        req.user?.id || null,
        req.body.notes ? String(req.body.notes).trim() : null,
      ],
    );

    const newPaid =
      Math.round((Number(invoice.amount_paid) + amount) * 100) / 100;
    const newBalance = Math.max(
      0,
      Math.round((Number(invoice.total_amount) - newPaid) * 100) / 100,
    );
    const newStatus = newBalance === 0 ? "paid" : "partially_paid";

    const updated = await client.query(
      `UPDATE invoices
       SET amount_paid = $1,
           balance_amount = $2,
           invoice_status = $3,
           updated_at = NOW()
       WHERE id = $4 AND hospital_id = $5
       RETURNING *`,
      [newPaid, newBalance, newStatus, invoice.id, hospitalId],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      data: {
        payment: paymentResult.rows[0],
        invoice: updated.rows[0],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error, "Unable to record payment.");
  } finally {
    client.release();
  }
}

module.exports = {
  listInvoices,
  readInvoice,
  createInvoice,
  updateDraftInvoice,
  issueInvoice,
  voidInvoice,
  listInvoicePayments,
  listPayments,
  recordPayment,
};

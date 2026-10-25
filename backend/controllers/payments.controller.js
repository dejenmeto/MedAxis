const crypto = require("crypto");
const pool = require("../config/database");
const {
  initializePayment,
  verifyPayment,
  isTestMode,
} = require("../services/payment.service");

const allowedRoles = ["super_admin", "hospital_admin", "accountant"];

function getHospitalId(req) {
  const id = Number(req.user?.hospitalId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function canManagePayments(req, res) {
  if (!allowedRoles.includes(req.user?.role)) {
    res.status(403).json({ message: "You cannot manage payments." });
    return false;
  }

  return true;
}

function validAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 100000000;
}

exports.listPayments = async (req, res) => {
  if (!canManagePayments(req, res)) return;

  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({
      message: "Your account is not assigned to a hospital.",
    });
  }

  try {
    const { status, search } = req.query;
    const values = [hospitalId];
    const filters = ["hospital_id = $1"];

    if (
      status &&
      ["pending", "success", "failed", "cancelled"].includes(status)
    ) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }

    if (search) {
      values.push(`%${String(search).slice(0, 100)}%`);
      filters.push(
        `(transaction_reference ILIKE $${values.length}
          OR COALESCE(invoice_id, '') ILIKE $${values.length}
          OR COALESCE(payer_email, '') ILIKE $${values.length})`,
      );
    }

    const result = await pool.query(
      `SELECT id, invoice_id, transaction_reference, provider,
              payment_method, amount, currency, status,
              payer_name, payer_email, payer_phone,
              provider_reference, checkout_url, failure_reason,
              initiated_by, verified_at, created_at, updated_at
       FROM payment_transactions
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT 200`,
      values,
    );

    res.json({ payments: result.rows });
  } catch (error) {
    console.error("List payments error:", error.message);
    res.status(500).json({ message: "Unable to load payments." });
  }
};

exports.createPayment = async (req, res) => {
  if (!canManagePayments(req, res)) return;

  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({
      message: "Your account is not assigned to a hospital.",
    });
  }

  const {
    invoiceId,
    amount,
    currency = "ETB",
    paymentMethod = "other",
    payerName,
    payerEmail,
    payerPhone,
  } = req.body;

  if (!validAmount(amount)) {
    return res.status(400).json({ message: "Enter a valid payment amount." });
  }

  if (!["ETB", "USD", "EUR", "GBP"].includes(String(currency).toUpperCase())) {
    return res.status(400).json({ message: "Unsupported currency." });
  }

  if (
    !["telebirr", "card", "bank_transfer", "cash", "other"].includes(
      paymentMethod,
    )
  ) {
    return res.status(400).json({ message: "Invalid payment method." });
  }

  if (payerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payerEmail))) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const transactionReference = `MAX-${crypto.randomUUID()}`;

  try {
    const inserted = await pool.query(
      `INSERT INTO payment_transactions
        (hospital_id, invoice_id, transaction_reference,
         provider, payment_method, amount, currency, status,
         payer_name, payer_email, payer_phone, initiated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending',
               $8, $9, $10, $11)
       RETURNING *`,
      [
        hospitalId,
        invoiceId ? String(invoiceId).slice(0, 100) : null,
        transactionReference,
        isTestMode()
          ? "test"
          : String(process.env.PAYMENT_PROVIDER || "").toLowerCase(),
        paymentMethod,
        Number(amount),
        String(currency).toUpperCase(),
        payerName ? String(payerName).slice(0, 160) : null,
        payerEmail || null,
        payerPhone ? String(payerPhone).slice(0, 40) : null,
        req.user.id,
      ],
    );

    const transaction = inserted.rows[0];
    const names = String(payerName || "MedAxis Patient")
      .trim()
      .split(/\s+/);

    try {
      const initialized = await initializePayment(transaction, {
        email: payerEmail,
        firstName: names[0],
        lastName: names.slice(1).join(" ") || "Patient",
      });

      const updated = await pool.query(
        `UPDATE payment_transactions
         SET provider = $1, provider_reference = $2,
             checkout_url = $3, updated_at = NOW()
         WHERE id = $4 AND hospital_id = $5
         RETURNING *`,
        [
          initialized.provider,
          initialized.providerReference,
          initialized.checkoutUrl,
          transaction.id,
          hospitalId,
        ],
      );

      return res.status(201).json({
        message: "Payment request created.",
        payment: updated.rows[0],
        testMode: isTestMode(),
      });
    } catch (providerError) {
      await pool.query(
        `UPDATE payment_transactions
         SET status = 'failed', failure_reason = $1, updated_at = NOW()
         WHERE id = $2 AND hospital_id = $3`,
        [
          String(providerError.message).slice(0, 500),
          transaction.id,
          hospitalId,
        ],
      );

      return res.status(502).json({
        message: "The payment provider could not initialize the transaction.",
        transactionReference,
      });
    }
  } catch (error) {
    console.error("Create payment error:", error.message);
    res.status(500).json({ message: "Unable to create payment request." });
  }
};

exports.verifyPayment = async (req, res) => {
  if (!canManagePayments(req, res)) return;

  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({
      message: "Your account is not assigned to a hospital.",
    });
  }

  const { reference } = req.params;

  try {
    const found = await pool.query(
      `SELECT * FROM payment_transactions
       WHERE transaction_reference = $1 AND hospital_id = $2`,
      [reference, hospitalId],
    );

    const transaction = found.rows[0];

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    if (transaction.status !== "pending") {
      return res.status(409).json({
        message: `This transaction is already ${transaction.status}.`,
        payment: transaction,
      });
    }

    if (isTestMode()) {
      return res.status(400).json({
        message: "Use the test simulation endpoint in test mode.",
      });
    }

    const verified = await verifyPayment(reference);

    if (
      verified.status === "success" &&
      (verified.amount !== Number(transaction.amount) ||
        verified.currency !== transaction.currency)
    ) {
      return res.status(409).json({
        message: "Verified payment amount or currency does not match.",
      });
    }

    const updated = await pool.query(
      `UPDATE payment_transactions
       SET status = $1, provider_reference = $2,
           verified_at = NOW(), updated_at = NOW(),
           failure_reason = NULL
       WHERE id = $3 AND hospital_id = $4 AND status = 'pending'
       RETURNING *`,
      [verified.status, verified.providerReference, transaction.id, hospitalId],
    );

    res.json({
      message: "Payment verification completed.",
      payment: updated.rows[0],
    });
  } catch (error) {
    console.error("Verify payment error:", error.message);
    res.status(502).json({
      message: "Unable to verify payment with the provider.",
    });
  }
};

// Test-only endpoint. It cannot mark real provider transactions as paid.
exports.simulateTestPayment = async (req, res) => {
  if (!canManagePayments(req, res)) return;

  if (!isTestMode()) {
    return res.status(403).json({
      message: "Payment simulation is disabled outside test mode.",
    });
  }

  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({
      message: "Your account is not assigned to a hospital.",
    });
  }

  const outcome = req.body.outcome;

  if (!["success", "failed", "cancelled"].includes(outcome)) {
    return res.status(400).json({
      message: "Outcome must be success, failed, or cancelled.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE payment_transactions
       SET status = $1,
           provider_reference = $2,
           verified_at = NOW(),
           failure_reason = $3,
           updated_at = NOW()
       WHERE transaction_reference = $4
         AND hospital_id = $5
         AND provider = 'test'
         AND status = 'pending'
       RETURNING *`,
      [
        outcome,
        `TEST-${crypto.randomUUID()}`,
        outcome === "failed" ? "Simulated test failure" : null,
        req.params.reference,
        hospitalId,
      ],
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        message: "Pending test transaction not found.",
      });
    }

    res.json({
      message: `Test transaction marked ${outcome}. No real money was moved.`,
      payment: result.rows[0],
    });
  } catch (error) {
    console.error("Simulate payment error:", error.message);
    res.status(500).json({ message: "Unable to simulate test payment." });
  }
};

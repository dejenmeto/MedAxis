const { pool } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const managers = ["super_admin", "hospital_admin"];
const payrollStaff = [...managers, "accountant"];

function hospitalId(req, res) {
  const id = Number(req.user?.hospitalId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res
      .status(403)
      .json({ success: false, message: "A valid hospital is required." });
    return null;
  }
  return id;
}

function userId(req) {
  const id = Number(req.user?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function money(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw Object.assign(
      new Error("Salary amounts must be valid non-negative numbers."),
      {
        status: 400,
      },
    );
  }
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function sendError(error, res) {
  if (error.status) {
    return res
      .status(error.status)
      .json({ success: false, message: error.message });
  }
  if (error.code === "23505") {
    return res
      .status(409)
      .json({ success: false, message: "This record already exists." });
  }
  if (error.code === "23503") {
    return res
      .status(400)
      .json({ success: false, message: "A linked record does not exist." });
  }
  if (
    error.code === "23514" ||
    error.code === "22P02" ||
    error.code === "22007"
  ) {
    return res
      .status(400)
      .json({ success: false, message: "One or more values are invalid." });
  }
  throw error;
}

function asyncRoute(fn) {
  return asyncHandler(async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      sendError(error, res);
    }
  });
}

exports.summary = asyncRoute(async (req, res) => {
  const hospital = hospitalId(req, res);
  if (!hospital) return;

  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM payroll_periods WHERE hospital_id = $1) AS total_periods,
       (SELECT COUNT(*)::int FROM payroll_periods WHERE hospital_id = $1 AND status = 'draft') AS draft_periods,
       (SELECT COUNT(*)::int FROM payroll_records WHERE hospital_id = $1 AND status IN ('approved','partially_paid')) AS unpaid_records,
       (SELECT COALESCE(SUM(net_salary),0) FROM payroll_records WHERE hospital_id = $1 AND status <> 'void') AS total_net_payroll,
       (SELECT COALESCE(SUM(pp.amount),0)
          FROM payroll_payments pp
         WHERE pp.hospital_id = $1) AS total_payments`,
    [hospital],
  );

  res.json({ success: true, data: rows[0] });
});

exports.list = asyncRoute(async (req, res) => {
  const hospital = hospitalId(req, res);
  if (!hospital) return;

  const resource = req.params.resource;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();

  const configs = {
    periods: {
      table: "payroll_periods",
      search: "period_name",
      columns:
        "id, period_name, start_date, end_date, status, notes, created_at",
      order: "start_date DESC",
    },

    salaries: {
      table: "employee_salary_structures",
      search: "staff_id::text",
      columns:
        "id, staff_id, basic_salary, housing_allowance, transport_allowance, other_allowances, bonus, tax_deduction, pension_deduction, other_deductions, effective_from, effective_to, is_active, notes, created_at",
      order: "created_at DESC",
    },

    records: {
      table: "payroll_records",
      search: "staff_id::text",
      columns: `
      id, period_id, staff_id, salary_structure_id,
      basic_salary, housing_allowance, transport_allowance,
      other_allowances, bonus, tax_deduction, pension_deduction,
      other_deductions, gross_salary, total_deductions, net_salary,
      status, approved_by, approved_at, notes, created_at,
      (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payroll_payments p
        WHERE p.hospital_id = payroll_records.hospital_id
          AND p.payroll_record_id = payroll_records.id
      ) AS total_paid
    `,
      order: "created_at DESC",
    },

    payments: {
      table: "payroll_payments",
      search: "payment_reference",
      columns:
        "id, payroll_record_id, payment_reference, amount, payment_method, payment_date, notes, recorded_by, created_at",
      order: "payment_date DESC, created_at DESC",
    },
  };

  const config = configs[resource];
  if (!config) {
    return res
      .status(404)
      .json({ success: false, message: "Unknown payroll resource." });
  }

  const values = [hospital];
  const filters = ["hospital_id = $1"];

  if (search) {
    values.push(`%${search}%`);
    filters.push(`${config.search} ILIKE $${values.length}`);
  }
  if (status && ["periods", "records"].includes(resource)) {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }
  const where = filters.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${config.table} WHERE ${where}`,
    values,
  );
  const dataResult = await pool.query(
    `SELECT ${config.columns} FROM ${config.table}
     WHERE ${where} ORDER BY ${config.order}
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  res.json({
    success: true,
    data: dataResult.rows,
    pagination: { page, limit, total: countResult.rows[0].total },
  });
});

exports.create = asyncRoute(async (req, res) => {
  const hospital = hospitalId(req, res);
  if (!hospital) return;
  const body = req.body || {};
  const actor = userId(req);
  const resource = req.params.resource;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (resource === "periods") {
      const { period_name, start_date, end_date, notes = null } = body;
      if (!period_name || !start_date || !end_date) {
        throw Object.assign(
          new Error("Period name, start date, and end date are required."),
          { status: 400 },
        );
      }

      const result = await client.query(
        `INSERT INTO payroll_periods
         (hospital_id, period_name, start_date, end_date, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          hospital,
          String(period_name).trim(),
          start_date,
          end_date,
          notes,
          actor,
        ],
      );
      await client.query("COMMIT");
      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    if (resource === "salaries") {
      const {
        staff_id,
        effective_from,
        effective_to = null,
        notes = null,
      } = body;
      if (!staff_id || !effective_from) {
        throw Object.assign(
          new Error("Staff ID and effective-from date are required."),
          { status: 400 },
        );
      }

      const staff = await client.query(
        "SELECT id FROM staff_profiles WHERE id = $1 AND hospital_id = $2",
        [staff_id, hospital],
      );
      if (!staff.rowCount) {
        throw Object.assign(
          new Error("Staff member not found in this hospital."),
          { status: 404 },
        );
      }

      const basic = money(body.basic_salary);
      const housing = money(body.housing_allowance);
      const transport = money(body.transport_allowance);
      const other = money(body.other_allowances);
      const bonus = money(body.bonus);
      const tax = money(body.tax_deduction);
      const pension = money(body.pension_deduction);
      const deductions = money(body.other_deductions);

      const result = await client.query(
        `INSERT INTO employee_salary_structures
         (hospital_id, staff_id, basic_salary, housing_allowance, transport_allowance,
          other_allowances, bonus, tax_deduction, pension_deduction, other_deductions,
          effective_from, effective_to, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          hospital,
          staff_id,
          basic,
          housing,
          transport,
          other,
          bonus,
          tax,
          pension,
          deductions,
          effective_from,
          effective_to,
          notes,
          actor,
        ],
      );
      await client.query("COMMIT");
      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    throw Object.assign(
      new Error("Payroll records are created by processing a pay period."),
      { status: 400 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

exports.processPeriod = asyncRoute(async (req, res) => {
  const hospital = hospitalId(req, res);
  if (!hospital) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const periodResult = await client.query(
      `SELECT * FROM payroll_periods
       WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [req.params.id, hospital],
    );
    if (!periodResult.rowCount) {
      throw Object.assign(new Error("Payroll period not found."), {
        status: 404,
      });
    }

    const period = periodResult.rows[0];
    if (!["draft", "processing"].includes(period.status)) {
      throw Object.assign(
        new Error("Only draft or processing periods can be processed."),
        { status: 409 },
      );
    }

    const result = await client.query(
      `INSERT INTO payroll_records
       (hospital_id, period_id, staff_id, salary_structure_id,
        basic_salary, housing_allowance, transport_allowance, other_allowances, bonus,
        tax_deduction, pension_deduction, other_deductions,
        gross_salary, total_deductions, net_salary, created_by)
       SELECT $1, $2, s.staff_id, s.id,
         s.basic_salary, s.housing_allowance, s.transport_allowance, s.other_allowances, s.bonus,
         s.tax_deduction, s.pension_deduction, s.other_deductions,
         (s.basic_salary + s.housing_allowance + s.transport_allowance + s.other_allowances + s.bonus),
         (s.tax_deduction + s.pension_deduction + s.other_deductions),
         (s.basic_salary + s.housing_allowance + s.transport_allowance + s.other_allowances + s.bonus
          - s.tax_deduction - s.pension_deduction - s.other_deductions),
         $3
       FROM employee_salary_structures s
       WHERE s.hospital_id = $1
         AND s.is_active = TRUE
         AND s.effective_from <= $4
         AND (s.effective_to IS NULL OR s.effective_to >= $4)
       ON CONFLICT (hospital_id, period_id, staff_id) DO NOTHING
       RETURNING *`,
      [hospital, period.id, userId(req), period.start_date],
    );

    await client.query(
      `UPDATE payroll_periods SET status = 'processing', updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2`,
      [period.id, hospital],
    );
    await client.query("COMMIT");
    res.json({
      success: true,
      message: "Payroll period processed.",
      created: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

exports.approveRecord = asyncRoute(async (req, res) => {
  const hospital = hospitalId(req, res);
  if (!hospital) return;

  const result = await pool.query(
    `UPDATE payroll_records
     SET status = 'approved', approved_by = $3, approved_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2 AND status = 'draft'
     RETURNING *`,
    [req.params.id, hospital, userId(req)],
  );
  if (!result.rowCount) {
    return res.status(409).json({
      success: false,
      message: "Payroll record was not found or is not in draft status.",
    });
  }
  res.json({ success: true, data: result.rows[0] });
});

exports.recordPayment = asyncRoute(async (req, res) => {
  const hospital = hospitalId(req, res);
  if (!hospital) return;

  const {
    payment_reference,
    amount,
    payment_method,
    payment_date,
    notes = null,
  } = req.body || {};
  if (!payment_reference || !amount || !payment_method) {
    return res.status(400).json({
      success: false,
      message:
        "Payment reference, positive amount, and payment method are required.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const recordResult = await client.query(
      `SELECT * FROM payroll_records
       WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [req.params.id, hospital],
    );
    if (!recordResult.rowCount) {
      throw Object.assign(new Error("Payroll record not found."), {
        status: 404,
      });
    }

    const record = recordResult.rows[0];
    if (!["approved", "partially_paid"].includes(record.status)) {
      throw Object.assign(
        new Error(
          "Only approved, unpaid payroll records can receive payments.",
        ),
        { status: 409 },
      );
    }

    const paidResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM payroll_payments WHERE hospital_id = $1 AND payroll_record_id = $2`,
      [hospital, record.id],
    );
    const alreadyPaid = Number(paidResult.rows[0].paid);
    const paymentAmount = money(amount);

    if (
      paymentAmount <= 0 ||
      alreadyPaid + paymentAmount > Number(record.net_salary) + 0.001
    ) {
      throw Object.assign(
        new Error(
          "Payment must be positive and cannot exceed the remaining net salary.",
        ),
        { status: 400 },
      );
    }

    await client.query(
      `INSERT INTO payroll_payments
       (hospital_id, payroll_record_id, payment_reference, amount, payment_method, payment_date, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE),$7,$8)`,
      [
        hospital,
        record.id,
        String(payment_reference).trim(),
        paymentAmount,
        payment_method,
        payment_date || null,
        notes,
        userId(req),
      ],
    );

    const totalPaid = alreadyPaid + paymentAmount;
    const newStatus =
      totalPaid >= Number(record.net_salary) ? "paid" : "partially_paid";

    await client.query(
      `UPDATE payroll_records SET status = $3, updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2`,
      [record.id, hospital, newStatus],
    );

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: "Payment recorded.",
      data: {
        payroll_record_id: record.id,
        total_paid: totalPaid,
        remaining: Number(record.net_salary) - totalPaid,
        status: newStatus,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

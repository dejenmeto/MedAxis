const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

// Only tables in this list can be queried by this controller.
// The controller checks whether each table and column exists first.
const TABLES = {
  patients: ["patients"],
  appointments: ["appointments"],
  admissions: ["admissions"],
  staff: ["staff_profiles"],
  beds: ["beds"],
  laboratory: ["lab_orders", "laboratory_orders"],
  radiology: ["imaging_orders"],
  invoices: ["invoices"],
  payments: ["payments"],
  pharmacy: ["medication_batches"],
  bloodUnits: ["blood_units"],
  insuranceClaims: ["insurance_claims", "claims"],
};

const DATE_COLUMNS = [
  "created_at",
  "appointment_date",
  "admission_date",
  "payment_date",
  "issue_date",
  "order_date",
  "created_on",
];

function getScope(req) {
  const hospitalId = req.user?.hospitalId;
  const role = req.user?.role;

  if (hospitalId) {
    return {
      hospitalId: String(hospitalId),
      isSuperAdmin: role === "super_admin",
    };
  }

  if (role === "super_admin") {
    return { hospitalId: null, isSuperAdmin: true };
  }

  const error = new Error("Your account is not assigned to a hospital.");
  error.statusCode = 403;
  throw error;
}

function validDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("A report date is invalid.");
    error.statusCode = 400;
    throw error;
  }

  return date.toISOString();
}

function getDateRange(req) {
  const to = validDate(req.query.to) || new Date().toISOString();
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 5);
  defaultFrom.setDate(1);

  const from = validDate(req.query.from) || defaultFrom.toISOString();

  if (new Date(from) > new Date(to)) {
    const error = new Error("'from' must be earlier than or equal to 'to'.");
    error.statusCode = 400;
    throw error;
  }

  return { from, to };
}

async function getTableInfo(tableName) {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [tableName],
  );

  const columns = new Set(result.rows.map((row) => row.column_name));

  return columns.size ? columns : null;
}

async function findTable(candidates) {
  for (const tableName of candidates) {
    const columns = await getTableInfo(tableName);
    if (columns) return { tableName, columns };
  }

  return null;
}

function scopeCondition(columns, hospitalId, startParam = 1) {
  if (hospitalId && columns.has("hospital_id")) {
    return {
      sql: `hospital_id = $${startParam}`,
      values: [hospitalId],
    };
  }

  if (!hospitalId) {
    // A super_admin without a hospital assignment may see global totals.
    return { sql: "TRUE", values: [] };
  }

  // Never include unscoped records in a hospital-specific report.
  return { sql: null, values: [] };
}

async function countResource(candidates, hospitalId) {
  const found = await findTable(candidates);
  if (!found) return null;

  const { tableName, columns } = found;
  const scope = scopeCondition(columns, hospitalId);

  if (!scope.sql) return null;

  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM "${tableName}"
      WHERE ${scope.sql}`,
    scope.values,
  );

  return result.rows[0].total;
}

async function countPayments(hospitalId, from, to) {
  const found = await findTable(TABLES.payments);
  if (!found) return { total: null, revenue: null };

  const { tableName, columns } = found;
  const scope = scopeCondition(columns, hospitalId);

  if (!scope.sql) return { total: null, revenue: null };

  const dateColumn = DATE_COLUMNS.find((column) => columns.has(column));
  const amountColumn = ["amount", "paid_amount", "payment_amount"].find(
    (column) => columns.has(column),
  );

  const values = [...scope.values];
  let where = scope.sql;

  if (dateColumn) {
    values.push(from, to);
    where += ` AND "${dateColumn}" >= $${values.length - 1}
               AND "${dateColumn}" <= $${values.length}`;
  }

  const revenueExpression = amountColumn
    ? `COALESCE(SUM("${amountColumn}"), 0)::numeric`
    : "NULL::numeric";

  const result = await pool.query(
    `SELECT COUNT(*)::int AS total,
            ${revenueExpression} AS revenue
       FROM "${tableName}"
      WHERE ${where}`,
    values,
  );

  return {
    total: result.rows[0].total,
    revenue:
      result.rows[0].revenue === null ? null : Number(result.rows[0].revenue),
  };
}

exports.summary = asyncHandler(async (req, res) => {
  const { hospitalId } = getScope(req);
  const { from, to } = getDateRange(req);

  const keys = Object.keys(TABLES);
  const entries = await Promise.all(
    keys.map(async (key) => [
      key,
      await countResource(TABLES[key], hospitalId),
    ]),
  );

  const metrics = Object.fromEntries(entries);
  const paymentSummary = await countPayments(hospitalId, from, to);

  metrics.payments = paymentSummary.total;
  metrics.revenue = paymentSummary.revenue;

  res.json({
    success: true,
    data: {
      metrics,
      dateRange: { from, to },
      unavailableMetrics: Object.entries(metrics)
        .filter(([, value]) => value === null)
        .map(([key]) => key),
    },
  });
});

exports.monthly = asyncHandler(async (req, res) => {
  const { hospitalId } = getScope(req);
  const { from, to } = getDateRange(req);

  // Appointments are used for the monthly activity chart.
  const found = await findTable(TABLES.appointments);

  if (!found || !found.columns.has("hospital_id")) {
    return res.json({
      success: true,
      data: [],
      message: "Monthly appointment data is not available.",
    });
  }

  const { tableName, columns } = found;
  const dateColumn = ["appointment_date", "created_at", "created_on"].find(
    (column) => columns.has(column),
  );

  if (!dateColumn) {
    return res.json({
      success: true,
      data: [],
      message: "No supported appointment date column was found.",
    });
  }

  const values = [];
  let where = "TRUE";

  if (hospitalId) {
    values.push(hospitalId);
    where += ` AND hospital_id = $${values.length}`;
  }

  values.push(from, to);
  where += ` AND "${dateColumn}" >= $${values.length - 1}
             AND "${dateColumn}" <= $${values.length}`;

  const result = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('month', "${dateColumn}"), 'YYYY-MM') AS month,
            COUNT(*)::int AS total
       FROM "${tableName}"
      WHERE ${where}
      GROUP BY DATE_TRUNC('month', "${dateColumn}")
      ORDER BY DATE_TRUNC('month', "${dateColumn}")`,
    values,
  );

  res.json({
    success: true,
    data: result.rows.map((row) => ({
      month: row.month,
      total: row.total,
    })),
  });
});

exports.financial = asyncHandler(async (req, res) => {
  const { hospitalId } = getScope(req);
  const { from, to } = getDateRange(req);

  const found = await findTable(TABLES.payments);

  if (!found) {
    return res.json({
      success: true,
      data: [],
      message: "The payments table is not available.",
    });
  }

  const { tableName, columns } = found;
  const scope = scopeCondition(columns, hospitalId);

  if (!scope.sql) {
    return res.json({ success: true, data: [] });
  }

  const dateColumn = DATE_COLUMNS.find((column) => columns.has(column));
  const amountColumn = ["amount", "paid_amount", "payment_amount"].find(
    (column) => columns.has(column),
  );

  if (!dateColumn || !amountColumn) {
    return res.json({
      success: true,
      data: [],
      message:
        "The payments table does not have supported date and amount columns.",
    });
  }

  const values = [...scope.values, from, to];
  const result = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('month', "${dateColumn}"), 'YYYY-MM') AS month,
            COALESCE(SUM("${amountColumn}"), 0)::numeric AS revenue,
            COUNT(*)::int AS transactions
       FROM "${tableName}"
      WHERE ${scope.sql}
        AND "${dateColumn}" >= $${values.length - 1}
        AND "${dateColumn}" <= $${values.length}
      GROUP BY DATE_TRUNC('month', "${dateColumn}")
      ORDER BY DATE_TRUNC('month', "${dateColumn}")`,
    values,
  );

  res.json({
    success: true,
    data: result.rows.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
      transactions: row.transactions,
    })),
  });
});

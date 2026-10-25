const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const DEFAULT_SETTINGS = {
  hospitalName: "",
  contactEmail: "",
  phone: "",
  address: "",
  currency: "ETB",
  timeZone: "Africa/Addis_Ababa",
  dateFormat: "YYYY-MM-DD",
  language: "en",
  appointmentDuration: 30,
  lowStockThreshold: 10,
  emailNotifications: true,
  smsNotifications: false,
  appointmentReminders: true,
  lowStockAlerts: true,
};

const ALLOWED_CURRENCIES = ["ETB", "USD", "EUR", "GBP"];
const ALLOWED_DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"];

function getScope(req) {
  const user = req.user;

  if (!user) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  if (user.hospitalId) {
    return {
      scopeKey: `hospital:${user.hospitalId}`,
      hospitalId: String(user.hospitalId),
    };
  }

  if (user.role === "super_admin") {
    return { scopeKey: "global", hospitalId: null };
  }

  const error = new Error("Your account is not assigned to a hospital.");
  error.statusCode = 403;
  throw error;
}

function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Settings must be provided as an object.");
    error.statusCode = 400;
    throw error;
  }

  const result = {};

  const textFields = {
    hospitalName: 200,
    contactEmail: 254,
    phone: 40,
    address: 500,
    timeZone: 100,
    language: 10,
  };

  for (const [field, maxLength] of Object.entries(textFields)) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== "string" || input[field].length > maxLength) {
        const error = new Error(`Invalid value for ${field}.`);
        error.statusCode = 400;
        throw error;
      }

      result[field] = input[field].trim();
    }
  }

  if (input.contactEmail !== undefined && input.contactEmail !== "") {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(input.contactEmail)) {
      const error = new Error("Enter a valid contact email address.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (input.currency !== undefined) {
    if (!ALLOWED_CURRENCIES.includes(input.currency)) {
      const error = new Error("Unsupported currency.");
      error.statusCode = 400;
      throw error;
    }

    result.currency = input.currency;
  }

  if (input.dateFormat !== undefined) {
    if (!ALLOWED_DATE_FORMATS.includes(input.dateFormat)) {
      const error = new Error("Unsupported date format.");
      error.statusCode = 400;
      throw error;
    }

    result.dateFormat = input.dateFormat;
  }

  for (const field of ["appointmentDuration", "lowStockThreshold"]) {
    if (input[field] !== undefined) {
      const value = Number(input[field]);

      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 100000 ||
        (field === "appointmentDuration" && value === 0)
      ) {
        const error = new Error(`Invalid value for ${field}.`);
        error.statusCode = 400;
        throw error;
      }

      result[field] = value;
    }
  }

  const booleanFields = [
    "emailNotifications",
    "smsNotifications",
    "appointmentReminders",
    "lowStockAlerts",
  ];

  for (const field of booleanFields) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== "boolean") {
        const error = new Error(`${field} must be true or false.`);
        error.statusCode = 400;
        throw error;
      }

      result[field] = input[field];
    }
  }

  return result;
}

exports.getSettings = asyncHandler(async (req, res) => {
  const scope = getScope(req);

  const result = await pool.query(
    `SELECT settings, updated_at
       FROM hospital_settings
      WHERE scope_key = $1
      LIMIT 1`,
    [scope.scopeKey],
  );

  const saved = result.rows[0]?.settings || {};

  res.json({
    success: true,
    data: {
      ...DEFAULT_SETTINGS,
      ...saved,
    },
    updatedAt: result.rows[0]?.updated_at || null,
  });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const scope = getScope(req);
  const input = req.body?.settings ?? req.body;
  const updates = validateSettings(input);

  const existing = await pool.query(
    `SELECT settings
       FROM hospital_settings
      WHERE scope_key = $1
      LIMIT 1`,
    [scope.scopeKey],
  );

  const current = existing.rows[0]?.settings || {};
  const merged = { ...DEFAULT_SETTINGS, ...current, ...updates };

  const result = await pool.query(
    `INSERT INTO hospital_settings (
       scope_key,
       hospital_id,
       settings,
       updated_by,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
     ON CONFLICT (scope_key)
     DO UPDATE SET
       settings = EXCLUDED.settings,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING settings, updated_at`,
    [
      scope.scopeKey,
      scope.hospitalId,
      JSON.stringify(merged),
      req.user.id || null,
    ],
  );

  res.json({
    success: true,
    message: "Settings saved successfully.",
    data: {
      ...DEFAULT_SETTINGS,
      ...result.rows[0].settings,
    },
    updatedAt: result.rows[0].updated_at,
  });
});

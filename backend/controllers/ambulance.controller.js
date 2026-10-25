const crypto = require("crypto");
const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const ADMIN_ROLES = ["super_admin", "hospital_admin"];
const DISPATCH_ROLES = [...ADMIN_ROLES, "doctor", "nurse", "receptionist"];

function hospitalScope(req) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    const error = new Error("Your account is not assigned to a hospital.");
    error.statusCode = 403;
    throw error;
  }

  return String(hospitalId);
}

function requireRole(req, allowedRoles) {
  if (!allowedRoles.includes(req.user?.role)) {
    const error = new Error(
      "You do not have permission to perform this action.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function makeDispatchCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `AMB-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

const listVehicles = asyncHandler(async (req, res) => {
  const hospitalId = hospitalScope(req);

  const result = await pool.query(
    `SELECT v.*,
       (SELECT COUNT(*)::int
        FROM ambulance_dispatches d
        WHERE d.vehicle_id = v.id
          AND d.hospital_id = v.hospital_id
          AND d.status IN ('dispatched', 'arrived', 'transporting')
       ) AS active_dispatches
     FROM ambulance_vehicles v
     WHERE v.hospital_id = $1
     ORDER BY v.created_at DESC`,
    [hospitalId],
  );

  res.json({ data: result.rows });
});

const createVehicle = asyncHandler(async (req, res) => {
  requireRole(req, ADMIN_ROLES);
  const hospitalId = hospitalScope(req);

  const {
    vehicle_number,
    vehicle_type = "ambulance",
    capacity = 1,
    status = "available",
    current_location = "",
    notes = "",
  } = req.body;

  if (!String(vehicle_number || "").trim()) {
    throw badRequest("Vehicle registration number is required.");
  }

  const parsedCapacity = Number(capacity);
  if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
    throw badRequest("Capacity must be a positive whole number.");
  }

  const result = await pool.query(
    `INSERT INTO ambulance_vehicles
       (hospital_id, vehicle_number, vehicle_type, capacity,
        status, current_location, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      hospitalId,
      String(vehicle_number).trim().toUpperCase(),
      String(vehicle_type).trim() || "ambulance",
      parsedCapacity,
      status,
      String(current_location).trim() || null,
      String(notes).trim() || null,
      req.user.id,
    ],
  );

  res.status(201).json({
    message: "Ambulance vehicle registered successfully.",
    data: result.rows[0],
  });
});

const updateVehicle = asyncHandler(async (req, res) => {
  requireRole(req, ADMIN_ROLES);
  const hospitalId = hospitalScope(req);
  const { id } = req.params;

  const {
    vehicle_number,
    vehicle_type,
    capacity,
    status,
    current_location,
    notes,
  } = req.body;

  const allowedStatuses = [
    "available",
    "dispatched",
    "maintenance",
    "inactive",
  ];

  if (status && !allowedStatuses.includes(status)) {
    throw badRequest("Invalid vehicle status.");
  }

  if (
    capacity !== undefined &&
    (!Number.isInteger(Number(capacity)) || Number(capacity) < 1)
  ) {
    throw badRequest("Capacity must be a positive whole number.");
  }

  // An active dispatch prevents manually marking its vehicle available.
  if (status === "available") {
    const active = await pool.query(
      `SELECT id FROM ambulance_dispatches
       WHERE hospital_id = $1 AND vehicle_id = $2
         AND status IN ('dispatched', 'arrived', 'transporting')
       LIMIT 1`,
      [hospitalId, id],
    );

    if (active.rowCount) {
      throw badRequest("This vehicle has an active dispatch.");
    }
  }

  const result = await pool.query(
    `UPDATE ambulance_vehicles
     SET vehicle_number = COALESCE($3, vehicle_number),
         vehicle_type = COALESCE($4, vehicle_type),
         capacity = COALESCE($5, capacity),
         status = COALESCE($6, status),
         current_location = CASE WHEN $7::boolean
           THEN $8::text ELSE current_location END,
         notes = CASE WHEN $9::boolean
           THEN $10::text ELSE notes END,
         updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
     RETURNING *`,
    [
      id,
      hospitalId,
      vehicle_number === undefined
        ? null
        : String(vehicle_number).trim().toUpperCase(),
      vehicle_type === undefined ? null : String(vehicle_type).trim(),
      capacity === undefined ? null : Number(capacity),
      status ?? null,
      current_location !== undefined,
      current_location === undefined
        ? null
        : String(current_location).trim() || null,
      notes !== undefined,
      notes === undefined ? null : String(notes).trim() || null,
    ],
  );

  if (!result.rowCount) {
    return res.status(404).json({ message: "Ambulance vehicle not found." });
  }

  res.json({ message: "Vehicle updated successfully.", data: result.rows[0] });
});

const listDispatches = asyncHandler(async (req, res) => {
  const hospitalId = hospitalScope(req);
  const { status, priority, search } = req.query;

  const result = await pool.query(
    `SELECT d.*,
            v.vehicle_number
     FROM ambulance_dispatches d
     LEFT JOIN ambulance_vehicles v
       ON v.id = d.vehicle_id AND v.hospital_id = d.hospital_id
     WHERE d.hospital_id = $1
       AND ($2::text IS NULL OR d.status = $2)
       AND ($3::text IS NULL OR d.priority = $3)
       AND (
         $4::text IS NULL OR
         d.patient_name ILIKE '%' || $4 || '%' OR
         d.dispatch_code ILIKE '%' || $4 || '%' OR
         d.pickup_location ILIKE '%' || $4 || '%'
       )
     ORDER BY
       CASE d.priority
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'normal' THEN 3
         ELSE 4
       END,
       d.call_received_at DESC`,
    [
      hospitalId,
      status || null,
      priority || null,
      String(search || "").trim() || null,
    ],
  );

  res.json({ data: result.rows });
});

const createDispatch = asyncHandler(async (req, res) => {
  requireRole(req, DISPATCH_ROLES);
  const hospitalId = hospitalScope(req);

  const {
    patient_id,
    patient_name,
    patient_phone,
    emergency_type,
    priority = "normal",
    pickup_location,
    destination,
    vehicle_id,
    driver_name,
    assigned_team,
    notes,
  } = req.body;

  if (
    !String(patient_name || "").trim() ||
    !String(emergency_type || "").trim() ||
    !String(pickup_location || "").trim()
  ) {
    throw badRequest(
      "Patient name, emergency type, and pickup location are required.",
    );
  }

  if (!["low", "normal", "high", "critical"].includes(priority)) {
    throw badRequest("Invalid emergency priority.");
  }

  if (patient_id) {
    const patient = await pool.query(
      `SELECT id FROM patients WHERE id = $1 LIMIT 1`,
      [patient_id],
    );

    if (!patient.rowCount) {
      throw badRequest("The selected patient does not exist.");
    }
  }

  if (vehicle_id) {
    const vehicle = await pool.query(
      `SELECT id FROM ambulance_vehicles
       WHERE id = $1 AND hospital_id = $2 AND status = 'available'`,
      [vehicle_id, hospitalId],
    );

    if (!vehicle.rowCount) {
      throw badRequest(
        "Selected ambulance is unavailable or belongs to another hospital.",
      );
    }
  }

  const result = await pool.query(
    `INSERT INTO ambulance_dispatches
       (hospital_id, dispatch_code, patient_id, patient_name, patient_phone,
        emergency_type, priority, pickup_location, destination, vehicle_id,
        driver_name, assigned_team, status, dispatched_at, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13, CASE WHEN $13 = 'dispatched' THEN NOW() ELSE NULL END, $14, $15)
     RETURNING *`,
    [
      hospitalId,
      makeDispatchCode(),
      patient_id || null,
      String(patient_name).trim(),
      String(patient_phone || "").trim() || null,
      String(emergency_type).trim(),
      priority,
      String(pickup_location).trim(),
      String(destination || "").trim() || null,
      vehicle_id || null,
      String(driver_name || "").trim() || null,
      String(assigned_team || "").trim() || null,
      vehicle_id ? "dispatched" : "pending",
      String(notes || "").trim() || null,
      req.user.id,
    ],
  );

  // Mark the assigned vehicle dispatched.
  if (vehicle_id) {
    await pool.query(
      `UPDATE ambulance_vehicles
       SET status = 'dispatched', updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2`,
      [vehicle_id, hospitalId],
    );
  }

  res.status(201).json({
    message: "Emergency dispatch created successfully.",
    data: result.rows[0],
  });
});

const updateDispatchStatus = asyncHandler(async (req, res) => {
  requireRole(req, DISPATCH_ROLES);
  const hospitalId = hospitalScope(req);
  const { id } = req.params;
  const { status } = req.body;

  const timestamps = {
    dispatched: "dispatched_at",
    arrived: "arrived_at",
    transporting: "transport_started_at",
    completed: "completed_at",
  };

  const allowedStatuses = [
    "pending",
    "dispatched",
    "arrived",
    "transporting",
    "completed",
    "cancelled",
  ];

  if (!allowedStatuses.includes(status)) {
    throw badRequest("Invalid dispatch status.");
  }

  const result = await pool.query(
    `UPDATE ambulance_dispatches
     SET status = $3,
         dispatched_at = CASE WHEN $3 = 'dispatched'
           THEN COALESCE(dispatched_at, NOW()) ELSE dispatched_at END,
         arrived_at = CASE WHEN $3 = 'arrived'
           THEN COALESCE(arrived_at, NOW()) ELSE arrived_at END,
         transport_started_at = CASE WHEN $3 = 'transporting'
           THEN COALESCE(transport_started_at, NOW()) ELSE transport_started_at END,
         completed_at = CASE WHEN $3 IN ('completed', 'cancelled')
           THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
         updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2
     RETURNING *`,
    [id, hospitalId, status],
  );

  if (!result.rowCount) {
    return res.status(404).json({ message: "Dispatch record not found." });
  }

  const dispatch = result.rows[0];

  if (dispatch.vehicle_id) {
    const vehicleStatus = ["completed", "cancelled"].includes(status)
      ? "available"
      : "dispatched";

    await pool.query(
      `UPDATE ambulance_vehicles
       SET status = $3, updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2
         AND status <> 'maintenance' AND status <> 'inactive'`,
      [dispatch.vehicle_id, hospitalId, vehicleStatus],
    );
  }

  res.json({ message: "Dispatch status updated.", data: dispatch });
});

const getDashboard = asyncHandler(async (req, res) => {
  const hospitalId = hospitalScope(req);

  const [vehicles, dispatches] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'available')::int AS available,
         COUNT(*) FILTER (WHERE status = 'dispatched')::int AS dispatched,
         COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance
       FROM ambulance_vehicles WHERE hospital_id = $1`,
      [hospitalId],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_today,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status IN ('dispatched','arrived','transporting'))::int AS active,
         COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('completed','cancelled'))::int AS critical
       FROM ambulance_dispatches
       WHERE hospital_id = $1
         AND call_received_at >= CURRENT_DATE
         AND call_received_at < CURRENT_DATE + INTERVAL '1 day'`,
      [hospitalId],
    ),
  ]);

  res.json({
    data: {
      vehicles: vehicles.rows[0],
      dispatches: dispatches.rows[0],
    },
  });
});

module.exports = {
  listVehicles,
  createVehicle,
  updateVehicle,
  listDispatches,
  createDispatch,
  updateDispatchStatus,
  getDashboard,
};

const { query } = require("../config/database");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

function hospitalIdOf(req) {
  // Super administrators without a hospital must select one explicitly.
  const id =
    req.user?.hospitalId ||
    (req.user?.role === "super_admin" ? req.headers["x-hospital-id"] : null);

  return id && /^\d+$/.test(String(id)) ? String(id) : null;
}

function requireHospital(req, res) {
  const hospitalId = hospitalIdOf(req);

  if (!hospitalId) {
    sendError(res, 400, "A valid hospital context is required.");
    return null;
  }

  return hospitalId;
}

const listRooms = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const result = await query(
    `SELECT *
     FROM theatre_rooms
     WHERE hospital_id = $1
     ORDER BY room_number ASC`,
    [hospitalId],
  );

  res.json({ success: true, data: result.rows });
});

const createRoom = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const {
    room_number,
    room_name,
    room_type = "general",
    location = null,
    notes = null,
  } = req.body;

  if (!String(room_number || "").trim() || !String(room_name || "").trim()) {
    return sendError(res, 400, "Room number and room name are required.");
  }

  const result = await query(
    `INSERT INTO theatre_rooms
       (hospital_id, room_number, room_name, room_type,
        location, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      hospitalId,
      String(room_number).trim(),
      String(room_name).trim(),
      room_type,
      location,
      notes,
    ],
  );

  res.status(201).json({
    success: true,
    message: "Theatre room created successfully.",
    data: result.rows[0],
  });
});

const updateRoom = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const {
    room_number,
    room_name,
    room_type,
    room_status,
    location,
    notes,
    is_active,
  } = req.body;

  const result = await query(
    `UPDATE theatre_rooms
     SET room_number = COALESCE($3, room_number),
         room_name = COALESCE($4, room_name),
         room_type = COALESCE($5, room_type),
         room_status = COALESCE($6, room_status),
         location = COALESCE($7, location),
         notes = COALESCE($8, notes),
         is_active = COALESCE($9, is_active),
         updated_at = NOW()
     WHERE id = $1::uuid AND hospital_id = $2
     RETURNING *`,
    [
      req.params.id,
      hospitalId,
      room_number ?? null,
      room_name ?? null,
      room_type ?? null,
      room_status ?? null,
      location ?? null,
      notes ?? null,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  if (!result.rowCount) {
    return sendError(res, 404, "Theatre room not found.");
  }

  res.json({
    success: true,
    message: "Theatre room updated successfully.",
    data: result.rows[0],
  });
});

const listProcedures = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const result = await query(
    `SELECT *
     FROM surgical_procedures
     WHERE hospital_id = $1
     ORDER BY procedure_name ASC`,
    [hospitalId],
  );

  res.json({ success: true, data: result.rows });
});

const createProcedure = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const {
    procedure_code,
    procedure_name,
    specialty = null,
    description = null,
    estimated_duration_minutes = 60,
    standard_fee = 0,
  } = req.body;

  if (
    !String(procedure_code || "").trim() ||
    !String(procedure_name || "").trim()
  ) {
    return sendError(res, 400, "Procedure code and name are required.");
  }

  const duration = Number(estimated_duration_minutes);
  const fee = Number(standard_fee);

  if (
    !Number.isInteger(duration) ||
    duration <= 0 ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    return sendError(
      res,
      400,
      "Duration must be positive and fee cannot be negative.",
    );
  }

  const result = await query(
    `INSERT INTO surgical_procedures
       (hospital_id, procedure_code, procedure_name, specialty,
        description, estimated_duration_minutes, standard_fee)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      hospitalId,
      String(procedure_code).trim(),
      String(procedure_name).trim(),
      specialty,
      description,
      duration,
      fee,
    ],
  );

  res.status(201).json({
    success: true,
    message: "Surgical procedure created successfully.",
    data: result.rows[0],
  });
});

const updateProcedure = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const {
    procedure_code,
    procedure_name,
    specialty,
    description,
    estimated_duration_minutes,
    standard_fee,
    is_active,
  } = req.body;

  const duration =
    estimated_duration_minutes === undefined
      ? null
      : Number(estimated_duration_minutes);

  const fee = standard_fee === undefined ? null : Number(standard_fee);

  if (
    (duration !== null && (!Number.isInteger(duration) || duration <= 0)) ||
    (fee !== null && (!Number.isFinite(fee) || fee < 0))
  ) {
    return sendError(res, 400, "Invalid duration or procedure fee.");
  }

  const result = await query(
    `UPDATE surgical_procedures
     SET procedure_code = COALESCE($3, procedure_code),
         procedure_name = COALESCE($4, procedure_name),
         specialty = COALESCE($5, specialty),
         description = COALESCE($6, description),
         estimated_duration_minutes =
           COALESCE($7, estimated_duration_minutes),
         standard_fee = COALESCE($8, standard_fee),
         is_active = COALESCE($9, is_active),
         updated_at = NOW()
     WHERE id = $1::uuid AND hospital_id = $2
     RETURNING *`,
    [
      req.params.id,
      hospitalId,
      procedure_code ?? null,
      procedure_name ?? null,
      specialty ?? null,
      description ?? null,
      duration,
      fee,
      typeof is_active === "boolean" ? is_active : null,
    ],
  );

  if (!result.rowCount) {
    return sendError(res, 404, "Surgical procedure not found.");
  }

  res.json({
    success: true,
    message: "Surgical procedure updated successfully.",
    data: result.rows[0],
  });
});

const listSurgeries = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const { status, search, date } = req.query;
  const values = [hospitalId];
  const conditions = ["s.hospital_id = $1"];

  if (status) {
    values.push(status);
    conditions.push(`s.surgery_status = $${values.length}`);
  }

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    values.push(date);
    conditions.push(`s.scheduled_start::date = $${values.length}::date`);
  }

  if (search) {
    values.push(`%${String(search).slice(0, 100)}%`);
    conditions.push(
      `(s.surgery_number ILIKE $${values.length}
        OR p.first_name ILIKE $${values.length}
        OR p.last_name ILIKE $${values.length})`,
    );
  }

  const result = await query(
    `SELECT s.*,
            p.first_name AS patient_first_name,
            p.last_name AS patient_last_name,
            r.room_number,
            r.room_name,
            sp.procedure_name,
            sp.procedure_code
     FROM theatre_surgeries s
     JOIN patients p ON p.id = s.patient_id
     JOIN theatre_rooms r ON r.id = s.theatre_room_id
     JOIN surgical_procedures sp ON sp.id = s.procedure_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.scheduled_start DESC
     LIMIT 200`,
    values,
  );

  res.json({ success: true, data: result.rows });
});

const createSurgery = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const {
    surgery_number,
    patient_id,
    theatre_room_id,
    procedure_id,
    surgeon_id = null,
    anaesthetist_id = null,
    scheduled_start,
    scheduled_end,
    priority = "routine",
    preoperative_diagnosis = null,
    notes = null,
  } = req.body;

  if (
    !surgery_number ||
    !patient_id ||
    !theatre_room_id ||
    !procedure_id ||
    !scheduled_start ||
    !scheduled_end
  ) {
    return sendError(
      res,
      400,
      "Complete all required surgery scheduling fields.",
    );
  }

  const start = new Date(scheduled_start);
  const end = new Date(scheduled_end);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return sendError(
      res,
      400,
      "The scheduled end must be later than the start.",
    );
  }

  if (!["routine", "urgent", "emergency"].includes(priority)) {
    return sendError(res, 400, "Invalid surgery priority.");
  }

  const client = await require("../config/database").pool.connect();

  try {
    await client.query("BEGIN");

    // Verify that the patient, room, and procedure belong to this hospital.
    const checks = await client.query(
      `SELECT
        EXISTS (
          SELECT 1 FROM patients
          WHERE id = $1 AND hospital_id = $4
        ) AS patient_ok,
        EXISTS (
          SELECT 1 FROM theatre_rooms
          WHERE id = $2::uuid
            AND hospital_id = $4 AND is_active = TRUE
            AND room_status = 'available'
        ) AS room_ok,
        EXISTS (
          SELECT 1 FROM surgical_procedures
          WHERE id = $3::uuid
            AND hospital_id = $4 AND is_active = TRUE
        ) AS procedure_ok`,
      [patient_id, theatre_room_id, procedure_id, hospitalId],
    );

    const check = checks.rows[0];

    if (!check.patient_ok || !check.room_ok || !check.procedure_ok) {
      await client.query("ROLLBACK");
      return sendError(
        res,
        400,
        "Patient, active theatre room, or procedure is invalid for this hospital.",
      );
    }

    // Prevent overlapping active bookings for the same room.
    const overlap = await client.query(
      `SELECT id
       FROM theatre_surgeries
       WHERE hospital_id = $1
         AND theatre_room_id = $2::uuid
         AND surgery_status IN ('scheduled', 'preparation', 'in_progress')
         AND scheduled_start < $4::timestamptz
         AND scheduled_end > $3::timestamptz
       LIMIT 1
       FOR UPDATE`,
      [hospitalId, theatre_room_id, start.toISOString(), end.toISOString()],
    );

    if (overlap.rowCount) {
      await client.query("ROLLBACK");
      return sendError(
        res,
        409,
        "This theatre room already has an overlapping booking.",
      );
    }

    const inserted = await client.query(
      `INSERT INTO theatre_surgeries (
         hospital_id, surgery_number, patient_id,
         theatre_room_id, procedure_id, surgeon_id,
         anaesthetist_id, scheduled_start, scheduled_end,
         priority, preoperative_diagnosis, notes, created_by
       )
       VALUES (
         $1, $2, $3, $4::uuid, $5::uuid, $6, $7,
         $8::timestamptz, $9::timestamptz,
         $10, $11, $12, $13
       )
       RETURNING *`,
      [
        hospitalId,
        surgery_number,
        patient_id,
        theatre_room_id,
        procedure_id,
        surgeon_id,
        anaesthetist_id,
        start.toISOString(),
        end.toISOString(),
        priority,
        preoperative_diagnosis,
        notes,
        req.user.id,
      ],
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Surgery scheduled successfully.",
      data: inserted.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return sendError(res, 409, "That surgery number already exists.");
    }
    throw error;
  } finally {
    client.release();
  }
});

const updateSurgeryStatus = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const allowed = [
    "scheduled",
    "preparation",
    "in_progress",
    "completed",
    "cancelled",
    "postponed",
  ];

  const { surgery_status, cancellation_reason } = req.body;

  if (!allowed.includes(surgery_status)) {
    return sendError(res, 400, "Invalid surgery status.");
  }

  const result = await query(
    `UPDATE theatre_surgeries
     SET surgery_status = $3,
         cancellation_reason = CASE
           WHEN $3 = 'cancelled' THEN $4
           ELSE cancellation_reason
         END,
         actual_start = CASE
           WHEN $3 = 'in_progress' AND actual_start IS NULL
             THEN NOW()
           ELSE actual_start
         END,
         actual_end = CASE
           WHEN $3 = 'completed' AND actual_end IS NULL
             THEN NOW()
           ELSE actual_end
         END,
         updated_at = NOW()
     WHERE id = $1::uuid AND hospital_id = $2
     RETURNING *`,
    [req.params.id, hospitalId, surgery_status, cancellation_reason || null],
  );

  if (!result.rowCount) {
    return sendError(res, 404, "Surgery not found.");
  }

  res.json({
    success: true,
    message: "Surgery status updated.",
    data: result.rows[0],
  });
});

const saveOperationRecord = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const {
    anaesthesia_type = null,
    anaesthesia_notes = null,
    procedure_performed,
    operative_findings = null,
    operative_technique = null,
    estimated_blood_loss_ml = null,
    complications = null,
    specimens = null,
    implants_used = null,
    post_op_plan = null,
    recovery_destination = null,
  } = req.body;

  if (!String(procedure_performed || "").trim()) {
    return sendError(res, 400, "The performed procedure is required.");
  }

  const surgery = await query(
    `SELECT id FROM theatre_surgeries
     WHERE id = $1::uuid AND hospital_id = $2`,
    [req.params.id, hospitalId],
  );

  if (!surgery.rowCount) {
    return sendError(res, 404, "Surgery not found.");
  }

  const result = await query(
    `INSERT INTO theatre_operation_records (
       hospital_id, surgery_id, anaesthesia_type,
       anaesthesia_notes, procedure_performed, operative_findings,
       operative_technique, estimated_blood_loss_ml,
       complications, specimens, implants_used, post_op_plan,
       recovery_destination, recorded_by
     )
     VALUES (
       $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
     )
     ON CONFLICT (surgery_id) DO UPDATE SET
       anaesthesia_type = EXCLUDED.anaesthesia_type,
       anaesthesia_notes = EXCLUDED.anaesthesia_notes,
       procedure_performed = EXCLUDED.procedure_performed,
       operative_findings = EXCLUDED.operative_findings,
       operative_technique = EXCLUDED.operative_technique,
       estimated_blood_loss_ml = EXCLUDED.estimated_blood_loss_ml,
       complications = EXCLUDED.complications,
       specimens = EXCLUDED.specimens,
       implants_used = EXCLUDED.implants_used,
       post_op_plan = EXCLUDED.post_op_plan,
       recovery_destination = EXCLUDED.recovery_destination,
       updated_at = NOW()
     RETURNING *`,
    [
      hospitalId,
      req.params.id,
      anaesthesia_type,
      anaesthesia_notes,
      String(procedure_performed).trim(),
      operative_findings,
      operative_technique,
      estimated_blood_loss_ml,
      complications,
      specimens,
      implants_used,
      post_op_plan,
      recovery_destination,
      req.user.id,
    ],
  );

  res.json({
    success: true,
    message: "Operation record saved.",
    data: result.rows[0],
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const hospitalId = requireHospital(req, res);
  if (!hospitalId) return;

  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM theatre_rooms
        WHERE hospital_id = $1 AND is_active = TRUE) AS total_rooms,
       (SELECT COUNT(*)::int FROM surgical_procedures
        WHERE hospital_id = $1 AND is_active = TRUE) AS total_procedures,
       (SELECT COUNT(*)::int FROM theatre_surgeries
        WHERE hospital_id = $1 AND scheduled_start::date = CURRENT_DATE)
        AS surgeries_today,
       (SELECT COUNT(*)::int FROM theatre_surgeries
        WHERE hospital_id = $1 AND surgery_status = 'scheduled')
        AS scheduled,
       (SELECT COUNT(*)::int FROM theatre_surgeries
        WHERE hospital_id = $1 AND surgery_status = 'in_progress')
        AS in_progress,
       (SELECT COUNT(*)::int FROM theatre_surgeries
        WHERE hospital_id = $1 AND surgery_status = 'completed')
        AS completed`,
    [hospitalId],
  );

  res.json({ success: true, data: result.rows[0] });
});

module.exports = {
  listRooms,
  createRoom,
  updateRoom,
  listProcedures,
  createProcedure,
  updateProcedure,
  listSurgeries,
  createSurgery,
  updateSurgeryStatus,
  saveOperationRecord,
  getDashboard,
};

const { query, pool } = require("../config/database");

const ROOM_TYPES = [
  "general",
  "private",
  "semi-private",
  "icu",
  "maternity",
  "isolation",
  "pediatric",
  "surgical",
];

const BED_STATUSES = ["available", "occupied", "maintenance", "reserved"];
const ADMISSION_TYPES = ["routine", "emergency", "transfer"];
const ADMISSION_STATUSES = [
  "admitted",
  "discharged",
  "transferred",
  "cancelled",
];

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireText(value, label, maxLength = 255) {
  const text = String(value ?? "").trim();

  if (!text) throw httpError(`${label} is required.`);
  if (text.length > maxLength) {
    throw httpError(`${label} cannot exceed ${maxLength} characters.`);
  }

  return text;
}

function optionalText(value, label, maxLength = 255) {
  if (value == null || String(value).trim() === "") return null;

  const text = String(value).trim();
  if (text.length > maxLength) {
    throw httpError(`${label} cannot exceed ${maxLength} characters.`);
  }

  return text;
}

function positiveBigInt(value, label) {
  const text = String(value ?? "").trim();

  if (!/^[1-9]\d*$/.test(text)) {
    throw httpError(`Invalid ${label}.`);
  }

  return text;
}

function requireUuid(value, label) {
  const text = String(value ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      text,
    )
  ) {
    throw httpError(`Invalid ${label}.`);
  }

  return text;
}

function validateEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw httpError(`Invalid ${label}. Allowed values: ${allowed.join(", ")}.`);
  }

  return value;
}

function pagination(input = {}) {
  const page = Math.max(1, Number.parseInt(input.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(input.limit, 10) || 20),
  );

  return { page, limit, offset: (page - 1) * limit };
}

function requireHospitalId(value) {
  return positiveBigInt(value, "hospital ID");
}

function normalizeRate(value) {
  const rate = Number(value ?? 0);

  if (!Number.isFinite(rate) || rate < 0) {
    throw httpError("Daily rate must be a non-negative number.");
  }

  return rate;
}

/* ------------------------------ ROOMS ---------------------------------- */

async function listRooms(hospitalId, filters = {}) {
  const hospital = requireHospitalId(hospitalId);
  const { page, limit, offset } = pagination(filters);
  const search = String(filters.search ?? "").trim();
  const values = [hospital];
  const conditions = ["r.hospital_id = $1"];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(r.room_number ILIKE $${values.length}
        OR r.room_type ILIKE $${values.length}
        OR COALESCE(r.floor_number, '') ILIKE $${values.length})`,
    );
  }

  if (filters.status === "active") {
    conditions.push("r.is_active = TRUE");
  } else if (filters.status === "inactive") {
    conditions.push("r.is_active = FALSE");
  }

  values.push(limit, offset);

  const result = await query(
    `
      SELECT
        r.*,
        d.name AS department_name,
        COUNT(DISTINCT b.id)::int AS total_beds,
        COUNT(DISTINCT b.id) FILTER (
          WHERE b.bed_status = 'available'
        )::int AS available_beds
      FROM rooms r
      LEFT JOIN departments d ON d.id = r.department_id
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY r.id, d.name
      ORDER BY r.room_number ASC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  return { data: result.rows, page, limit };
}

async function getRoom(hospitalId, roomId) {
  const result = await query(
    `
      SELECT r.*, d.name AS department_name
      FROM rooms r
      LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.id = $1 AND r.hospital_id = $2
    `,
    [requireUuid(roomId, "room ID"), requireHospitalId(hospitalId)],
  );

  if (!result.rowCount) throw httpError("Room not found.", 404);
  return result.rows[0];
}

async function validateDepartment(client, hospitalId, departmentValue) {
  const departmentId =
    departmentValue == null || String(departmentValue).trim() === ""
      ? null
      : positiveBigInt(departmentValue, "department ID");

  if (!departmentId) return null;

  const result = await client.query(
    `SELECT id FROM departments WHERE id = $1 AND hospital_id = $2`,
    [departmentId, hospitalId],
  );

  if (!result.rowCount) {
    throw httpError(
      "Department not found in this hospital. Leave Department ID empty or use an existing department belonging to your hospital.",
      400,
    );
  }

  return departmentId;
}

async function createRoom(hospitalId, input = {}) {
  const hospital = requireHospitalId(hospitalId);
  const roomNumber = requireText(input.room_number, "Room number", 50);
  const roomType = validateEnum(
    input.room_type || "general",
    ROOM_TYPES,
    "room type",
  );
  const floorNumber = optionalText(input.floor_number, "Floor number", 30);
  const dailyRate = normalizeRate(input.daily_rate);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const departmentId = await validateDepartment(
      client,
      hospital,
      input.department_id,
    );

    const result = await client.query(
      `
        INSERT INTO rooms
          (hospital_id, department_id, room_number, room_type, floor_number, daily_rate)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [hospital, departmentId, roomNumber, roomType, floorNumber, dailyRate],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw httpError(
        "A room with this number already exists in this hospital.",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function updateRoom(hospitalId, roomId, input = {}) {
  const hospital = requireHospitalId(hospitalId);
  const id = requireUuid(roomId, "room ID");

  const roomNumber = requireText(input.room_number, "Room number", 50);
  const roomType = validateEnum(
    input.room_type || "general",
    ROOM_TYPES,
    "room type",
  );
  const floorNumber = optionalText(input.floor_number, "Floor number", 30);
  const dailyRate = normalizeRate(input.daily_rate);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM rooms WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [id, hospital],
    );

    if (!existing.rowCount) throw httpError("Room not found.", 404);

    const departmentId = await validateDepartment(
      client,
      hospital,
      input.department_id,
    );

    const result = await client.query(
      `
        UPDATE rooms
        SET department_id = $3,
            room_number = $4,
            room_type = $5,
            floor_number = $6,
            daily_rate = $7,
            updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        RETURNING *
      `,
      [
        id,
        hospital,
        departmentId,
        roomNumber,
        roomType,
        floorNumber,
        dailyRate,
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw httpError(
        "A room with this number already exists in this hospital.",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function deactivateRoom(hospitalId, roomId) {
  const hospital = requireHospitalId(hospitalId);
  const id = requireUuid(roomId, "room ID");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const room = await client.query(
      `SELECT id FROM rooms WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [id, hospital],
    );

    if (!room.rowCount) throw httpError("Room not found.", 404);

    const occupied = await client.query(
      `
        SELECT 1
        FROM beds
        WHERE room_id = $1
          AND bed_status IN ('occupied', 'reserved')
        LIMIT 1
      `,
      [id],
    );

    if (occupied.rowCount) {
      throw httpError(
        "This room has occupied or reserved beds. Resolve those beds before deactivating the room.",
        409,
      );
    }

    const result = await client.query(
      `
        UPDATE rooms
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        RETURNING *
      `,
      [id, hospital],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------- BEDS ---------------------------------- */

async function listBeds(hospitalId, filters = {}) {
  const hospital = requireHospitalId(hospitalId);
  const { page, limit, offset } = pagination(filters);
  const values = [hospital];
  const conditions = ["b.hospital_id = $1"];
  const search = String(filters.search ?? "").trim();

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(b.bed_number ILIKE $${values.length}
        OR r.room_number ILIKE $${values.length}
        OR r.room_type ILIKE $${values.length})`,
    );
  }

  if (BED_STATUSES.includes(filters.status)) {
    values.push(filters.status);
    conditions.push(`b.bed_status = $${values.length}`);
  }

  values.push(limit, offset);

  const result = await query(
    `
      SELECT b.*, r.room_number, r.room_type, r.floor_number
      FROM beds b
      JOIN rooms r ON r.id = b.room_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.room_number, b.bed_number
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  return { data: result.rows, page, limit };
}

async function createBed(hospitalId, input = {}) {
  const hospital = requireHospitalId(hospitalId);
  const roomId = requireUuid(input.room_id, "room ID");
  const bedNumber = requireText(input.bed_number, "Bed number", 50);
  const notes = optionalText(input.notes, "Notes", 5000);

  const room = await query(
    `SELECT id FROM rooms WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
    [roomId, hospital],
  );

  if (!room.rowCount) {
    throw httpError("Active room not found in this hospital.", 404);
  }

  const result = await query(
    `
      INSERT INTO beds (hospital_id, room_id, bed_number, bed_status, notes)
      VALUES ($1, $2, $3, 'available', $4)
      RETURNING *
    `,
    [hospital, roomId, bedNumber, notes],
  );

  return result.rows[0];
}

async function updateBed(hospitalId, bedId, input = {}) {
  const hospital = requireHospitalId(hospitalId);
  const id = requireUuid(bedId, "bed ID");
  const bedNumber = requireText(input.bed_number, "Bed number", 50);
  const notes = optionalText(input.notes, "Notes", 5000);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bed = await client.query(
      `SELECT * FROM beds WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [id, hospital],
    );

    if (!bed.rowCount) throw httpError("Bed not found.", 404);

    const current = bed.rows[0];
    const status = validateEnum(
      input.bed_status || current.bed_status,
      BED_STATUSES,
      "bed status",
    );

    if (current.bed_status === "occupied" && status !== "occupied") {
      const activeAdmission = await client.query(
        `
          SELECT id FROM admissions
          WHERE bed_id = $1 AND admission_status = 'admitted'
          LIMIT 1
        `,
        [id],
      );

      if (activeAdmission.rowCount) {
        throw httpError(
          "This bed has an active admission. Discharge or cancel the admission before changing its status.",
          409,
        );
      }
    }

    const result = await client.query(
      `
        UPDATE beds
        SET bed_number = $3,
            bed_status = $4,
            notes = $5,
            updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        RETURNING *
      `,
      [id, hospital, bedNumber, status, notes],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      throw httpError("That bed number already exists in this room.", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

/* ---------------------------- ADMISSIONS ------------------------------- */

async function listAdmissions(hospitalId, filters = {}) {
  const hospital = requireHospitalId(hospitalId);
  const { page, limit, offset } = pagination(filters);
  const values = [hospital];
  const conditions = ["a.hospital_id = $1"];
  const search = String(filters.search ?? "").trim();

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(a.admission_number ILIKE $${values.length}
        OR p.first_name ILIKE $${values.length}
        OR p.last_name ILIKE $${values.length}
        OR p.mr_number ILIKE $${values.length}
        OR b.bed_number ILIKE $${values.length}
        OR r.room_number ILIKE $${values.length})`,
    );
  }

  if (ADMISSION_STATUSES.includes(filters.status)) {
    values.push(filters.status);
    conditions.push(`a.admission_status = $${values.length}`);
  }

  values.push(limit, offset);

  const result = await query(
    `
      SELECT
        a.*,
        p.first_name,
        p.last_name,
        p.mr_number,
        b.bed_number,
        r.room_number
      FROM admissions a
      JOIN patients p ON p.id = a.patient_id
      JOIN beds b ON b.id = a.bed_id
      JOIN rooms r ON r.id = b.room_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.admitted_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  return { data: result.rows, page, limit };
}

async function createAdmission(hospitalId, userId, input = {}) {
  const hospital = requireHospitalId(hospitalId);
  const user = positiveBigInt(userId, "user ID");
  const patientId = positiveBigInt(input.patient_id, "patient ID");
  const bedId = requireUuid(input.bed_id, "bed ID");
  const admissionNumber = requireText(
    input.admission_number,
    "Admission number",
    60,
  );
  const admissionType = validateEnum(
    input.admission_type || "routine",
    ADMISSION_TYPES,
    "admission type",
  );
  const reason = requireText(input.admission_reason, "Admission reason", 5000);
  const staffId =
    input.attending_staff_id == null ||
    String(input.attending_staff_id).trim() === ""
      ? null
      : positiveBigInt(input.attending_staff_id, "attending staff ID");

  const expectedDischarge = input.expected_discharge_at || null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const patient = await client.query(
      `SELECT id FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, hospital],
    );

    if (!patient.rowCount) {
      throw httpError("Patient not found in this hospital.", 404);
    }

    if (staffId) {
      const staff = await client.query(
        `SELECT id FROM staff_profiles WHERE id = $1 AND hospital_id = $2`,
        [staffId, hospital],
      );

      if (!staff.rowCount) {
        throw httpError(
          "Attending staff member not found in this hospital.",
          404,
        );
      }
    }

    const bed = await client.query(
      `
        SELECT b.id
        FROM beds b
        JOIN rooms r ON r.id = b.room_id
        WHERE b.id = $1
          AND b.hospital_id = $2
          AND b.bed_status = 'available'
          AND r.is_active = TRUE
        FOR UPDATE OF b
      `,
      [bedId, hospital],
    );

    if (!bed.rowCount) {
      throw httpError(
        "The selected bed is not available in this hospital.",
        409,
      );
    }

    const result = await client.query(
      `
        INSERT INTO admissions (
          hospital_id, patient_id, bed_id, attending_staff_id, admitted_by,
          admission_number, admission_type, admission_reason,
          expected_discharge_at, admission_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admitted')
        RETURNING *
      `,
      [
        hospital,
        patientId,
        bedId,
        staffId,
        user,
        admissionNumber,
        admissionType,
        reason,
        expectedDischarge,
      ],
    );

    await client.query(
      `UPDATE beds SET bed_status = 'occupied', updated_at = NOW() WHERE id = $1`,
      [bedId],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw httpError(
        "That admission number already exists in this hospital.",
        409,
      );
    }

    if (error.code === "23503") {
      throw httpError(
        "A referenced patient, bed, staff member, or user does not exist.",
        400,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function updateAdmission(hospitalId, admissionId, input = {}) {
  const hospital = requireHospitalId(hospitalId);
  const id = requireUuid(admissionId, "admission ID");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
        SELECT id, admission_status
        FROM admissions
        WHERE id = $1 AND hospital_id = $2
        FOR UPDATE
      `,
      [id, hospital],
    );

    if (!existing.rowCount) throw httpError("Admission not found.", 404);
    if (existing.rows[0].admission_status !== "admitted") {
      throw httpError("Only active admissions can be edited.", 409);
    }

    const admissionType = validateEnum(
      input.admission_type || "routine",
      ADMISSION_TYPES,
      "admission type",
    );
    const reason = requireText(
      input.admission_reason,
      "Admission reason",
      5000,
    );
    const staffId =
      input.attending_staff_id == null ||
      String(input.attending_staff_id).trim() === ""
        ? null
        : positiveBigInt(input.attending_staff_id, "attending staff ID");

    if (staffId) {
      const staff = await client.query(
        `SELECT id FROM staff_profiles WHERE id = $1 AND hospital_id = $2`,
        [staffId, hospital],
      );

      if (!staff.rowCount) {
        throw httpError(
          "Attending staff member not found in this hospital.",
          404,
        );
      }
    }

    const result = await client.query(
      `
        UPDATE admissions
        SET admission_type = $3,
            admission_reason = $4,
            attending_staff_id = $5,
            expected_discharge_at = $6,
            updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        RETURNING *
      `,
      [
        id,
        hospital,
        admissionType,
        reason,
        staffId,
        input.expected_discharge_at || null,
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function dischargeAdmission(hospitalId, admissionId, notes = "") {
  return finishAdmission(hospitalId, admissionId, "discharged", notes);
}

async function cancelAdmission(hospitalId, admissionId, reason = "") {
  return finishAdmission(hospitalId, admissionId, "cancelled", reason);
}

async function finishAdmission(hospitalId, admissionId, status, notes) {
  const hospital = requireHospitalId(hospitalId);
  const id = requireUuid(admissionId, "admission ID");
  const text = optionalText(notes, "Notes", 5000);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const admission = await client.query(
      `
        SELECT id, bed_id, admission_status
        FROM admissions
        WHERE id = $1 AND hospital_id = $2
        FOR UPDATE
      `,
      [id, hospital],
    );

    if (!admission.rowCount) throw httpError("Admission not found.", 404);

    const current = admission.rows[0];
    if (current.admission_status !== "admitted") {
      throw httpError("This admission is no longer active.", 409);
    }

    const column =
      status === "discharged" ? "discharge_notes" : "discharge_notes";

    const result = await client.query(
      `
        UPDATE admissions
        SET admission_status = $3,
            discharged_at = CASE WHEN $3 = 'discharged' THEN NOW() ELSE discharged_at END,
            ${column} = $4,
            updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        RETURNING *
      `,
      [id, hospital, status, text],
    );

    const otherActive = await client.query(
      `
        SELECT id FROM admissions
        WHERE bed_id = $1 AND admission_status = 'admitted' AND id <> $2
        LIMIT 1
      `,
      [current.bed_id, id],
    );

    if (!otherActive.rowCount) {
      await client.query(
        `
          UPDATE beds
          SET bed_status = 'available', updated_at = NOW()
          WHERE id = $1 AND hospital_id = $2 AND bed_status = 'occupied'
        `,
        [current.bed_id, hospital],
      );
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deactivateRoom,
  listBeds,
  createBed,
  updateBed,
  listAdmissions,
  createAdmission,
  updateAdmission,
  dischargeAdmission,
  cancelAdmission,
};

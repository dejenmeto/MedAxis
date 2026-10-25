const { query, pool } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");
const crypto = require("crypto");

const VALID_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

const VALID_TYPES = ["physical", "video", "emergency"];
const ACTIVE_BOOKING_STATUSES = ["scheduled", "confirmed", "in_progress"];

function validId(id) {
  return /^[1-9]\d*$/.test(String(id ?? ""));
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value ?? ""));
}

function validTimeRange(start, end) {
  return validTime(start) && validTime(end) && start < end;
}

function hospitalIdOrRespond(req, res) {
  const id = req.user?.hospitalId;

  if (!id || !validId(id)) {
    res.status(400).json({
      success: false,
      message:
        "Your account has no active hospital. Please sign in again and select a hospital.",
    });
    return null;
  }

  return String(id);
}

function appointmentNumber() {
  return `APT-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function parsePagination(queryParams) {
  const page = Math.max(1, Number.parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(queryParams.limit, 10) || 10),
  );

  return { page, limit, offset: (page - 1) * limit };
}

const list = asyncHandler(async (req, res) => {
  const hospitalId = hospitalIdOrRespond(req, res);
  if (!hospitalId) return;

  const { page, limit, offset } = parsePagination(req.query);
  const values = [hospitalId];
  const filters = ["a.hospital_id = $1"];

  if (req.query.date) {
    if (!validDate(req.query.date)) {
      return res.status(422).json({
        success: false,
        message: "Date must use YYYY-MM-DD format.",
      });
    }
    values.push(req.query.date);
    filters.push(`a.appointment_date = $${values.length}::date`);
  }

  if (req.query.from) {
    if (!validDate(req.query.from)) {
      return res.status(422).json({
        success: false,
        message: "Start date filter must use YYYY-MM-DD format.",
      });
    }
    values.push(req.query.from);
    filters.push(`a.appointment_date >= $${values.length}::date`);
  }

  if (req.query.to) {
    if (!validDate(req.query.to)) {
      return res.status(422).json({
        success: false,
        message: "End date filter must use YYYY-MM-DD format.",
      });
    }
    values.push(req.query.to);
    filters.push(`a.appointment_date <= $${values.length}::date`);
  }

  if (req.query.status) {
    if (!VALID_STATUSES.includes(req.query.status)) {
      return res.status(422).json({
        success: false,
        message: "Invalid appointment status.",
      });
    }
    values.push(req.query.status);
    filters.push(`a.status = $${values.length}`);
  }

  if (req.query.appointment_type) {
    if (!VALID_TYPES.includes(req.query.appointment_type)) {
      return res.status(422).json({
        success: false,
        message: "Invalid appointment type.",
      });
    }
    values.push(req.query.appointment_type);
    filters.push(`a.appointment_type = $${values.length}`);
  }

  if (req.query.search) {
    values.push(`%${String(req.query.search).trim().slice(0, 100)}%`);
    const n = values.length;
    filters.push(`(
      a.appointment_number ILIKE $${n}
      OR p.first_name ILIKE $${n}
      OR p.last_name ILIKE $${n}
      OR u.first_name ILIKE $${n}
      OR u.last_name ILIKE $${n}
      OR CAST(a.patient_id AS TEXT) ILIKE $${n}
    )`);
  }

  const where = filters.join(" AND ");

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN staff_profiles sp ON sp.id = a.doctor_id
     JOIN users u ON u.id = sp.user_id
     WHERE ${where}`,
    values,
  );

  const result = await query(
    `SELECT
       a.id, a.hospital_id, a.appointment_number,
       a.patient_id, a.doctor_id, a.appointment_date,
       a.start_time, a.end_time, a.status, a.appointment_type,
       a.reason, a.symptoms, a.notes, a.cancellation_reason,
       a.cancelled_at, a.created_by, a.created_at, a.updated_at,
       p.mr_number,
       p.first_name AS patient_first_name,
       p.last_name AS patient_last_name,
       u.first_name AS doctor_first_name,
       u.last_name AS doctor_last_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN staff_profiles sp ON sp.id = a.doctor_id
     JOIN users u ON u.id = sp.user_id
     WHERE ${where}
     ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  const total = countResult.rows[0].total;

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const getById = asyncHandler(async (req, res) => {
  const hospitalId = hospitalIdOrRespond(req, res);
  if (!hospitalId) return;

  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid appointment ID.",
    });
  }

  const result = await query(
    `SELECT
       a.*,
       p.mr_number,
       p.first_name AS patient_first_name,
       p.last_name AS patient_last_name,
       u.first_name AS doctor_first_name,
       u.last_name AS doctor_last_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN staff_profiles sp ON sp.id = a.doctor_id
     JOIN users u ON u.id = sp.user_id
     WHERE a.id = $1 AND a.hospital_id = $2`,
    [req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Appointment not found.",
    });
  }

  res.json({ success: true, data: result.rows[0] });
});

const create = asyncHandler(async (req, res) => {
  const hospitalId = hospitalIdOrRespond(req, res);
  if (!hospitalId) return;

  const {
    patient_id,
    doctor_id,
    appointment_date,
    start_time,
    end_time,
    appointment_type = "physical",
    reason,
    symptoms,
    notes,
  } = req.body;

  if (
    !patient_id ||
    !doctor_id ||
    !appointment_date ||
    !start_time ||
    !end_time
  ) {
    return res.status(422).json({
      success: false,
      message: "Patient, doctor, date, start time and end time are required.",
    });
  }

  if (!validId(patient_id) || !validId(doctor_id)) {
    return res.status(422).json({
      success: false,
      message: "Patient and doctor IDs must be positive integer IDs.",
    });
  }

  if (!validDate(appointment_date)) {
    return res.status(422).json({
      success: false,
      message: "Appointment date must use YYYY-MM-DD format.",
    });
  }

  if (!validTimeRange(start_time, end_time)) {
    return res.status(422).json({
      success: false,
      message:
        "Enter valid times and ensure the end time is after the start time.",
    });
  }

  if (!VALID_TYPES.includes(appointment_type)) {
    return res.status(422).json({
      success: false,
      message: "Invalid appointment type.",
    });
  }

  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    // All appointment creation/rescheduling operations lock the doctor row.
    const doctor = await client.query(
      `SELECT id
       FROM staff_profiles
       WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [doctor_id, hospitalId],
    );

    if (!doctor.rowCount) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(422).json({
        success: false,
        message: "Active doctor not found in this hospital.",
      });
    }

    const patient = await client.query(
      `SELECT id
       FROM patients
       WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
      [patient_id, hospitalId],
    );

    if (!patient.rowCount) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(422).json({
        success: false,
        message: "Active patient not found in this hospital.",
      });
    }

    const conflict = await client.query(
      `SELECT id
       FROM appointments
       WHERE hospital_id = $1
         AND doctor_id = $2
         AND appointment_date = $3::date
         AND status = ANY($4::varchar[])
         AND start_time < $6::time
         AND end_time > $5::time
       LIMIT 1`,
      [
        hospitalId,
        doctor_id,
        appointment_date,
        ACTIVE_BOOKING_STATUSES,
        start_time,
        end_time,
      ],
    );

    if (conflict.rowCount) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(409).json({
        success: false,
        message: "The doctor already has an overlapping appointment.",
      });
    }

    const result = await client.query(
      `INSERT INTO appointments (
         hospital_id, appointment_number, patient_id, doctor_id,
         appointment_date, start_time, end_time, appointment_type,
         reason, symptoms, notes, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        hospitalId,
        appointmentNumber(),
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        reason || null,
        symptoms || null,
        notes || null,
        req.user?.id || null,
      ],
    );

    await client.query("COMMIT");
    transactionOpen = false;

    res.status(201).json({
      success: true,
      message: "Appointment created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const update = asyncHandler(async (req, res) => {
  const hospitalId = hospitalIdOrRespond(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  if (!validId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid appointment ID.",
    });
  }

  const {
    appointment_date,
    start_time,
    end_time,
    doctor_id,
    patient_id,
    status,
    appointment_type,
    reason,
    symptoms,
    notes,
  } = req.body;

  if (patient_id !== undefined && !validId(patient_id)) {
    return res.status(422).json({
      success: false,
      message: "Invalid patient ID.",
    });
  }

  if (doctor_id !== undefined && !validId(doctor_id)) {
    return res.status(422).json({
      success: false,
      message: "Invalid doctor ID.",
    });
  }

  if (appointment_date !== undefined && !validDate(appointment_date)) {
    return res.status(422).json({
      success: false,
      message: "Appointment date must use YYYY-MM-DD format.",
    });
  }

  if (start_time !== undefined && !validTime(start_time)) {
    return res.status(422).json({
      success: false,
      message: "Invalid start time.",
    });
  }

  if (end_time !== undefined && !validTime(end_time)) {
    return res.status(422).json({
      success: false,
      message: "Invalid end time.",
    });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(422).json({
      success: false,
      message: "Invalid appointment status.",
    });
  }

  if (
    appointment_type !== undefined &&
    !VALID_TYPES.includes(appointment_type)
  ) {
    return res.status(422).json({
      success: false,
      message: "Invalid appointment type.",
    });
  }

  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const currentResult = await client.query(
      `SELECT * FROM appointments
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [id, hospitalId],
    );

    if (!currentResult.rowCount) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    const current = currentResult.rows[0];
    const nextDoctor = doctor_id ?? current.doctor_id;
    const nextPatient = patient_id ?? current.patient_id;
    const nextDate =
      appointment_date ?? String(current.appointment_date).slice(0, 10);
    const nextStart = start_time ?? String(current.start_time).slice(0, 8);
    const nextEnd = end_time ?? String(current.end_time).slice(0, 8);
    const nextStatus = status ?? current.status;

    if (!validTimeRange(nextStart, nextEnd)) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(422).json({
        success: false,
        message: "The end time must be after the start time.",
      });
    }

    if (patient_id !== undefined) {
      const patient = await client.query(
        `SELECT id FROM patients
         WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE`,
        [nextPatient, hospitalId],
      );

      if (!patient.rowCount) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(422).json({
          success: false,
          message: "Active patient not found in this hospital.",
        });
      }
    }

    const doctor = await client.query(
      `SELECT id FROM staff_profiles
       WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [nextDoctor, hospitalId],
    );

    if (!doctor.rowCount) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(422).json({
        success: false,
        message: "Active doctor not found in this hospital.",
      });
    }

    if (ACTIVE_BOOKING_STATUSES.includes(nextStatus)) {
      const conflict = await client.query(
        `SELECT id FROM appointments
         WHERE hospital_id = $1
           AND doctor_id = $2
           AND appointment_date = $3::date
           AND id <> $4
           AND status = ANY($5::varchar[])
           AND start_time < $7::time
           AND end_time > $6::time
         LIMIT 1`,
        [
          hospitalId,
          nextDoctor,
          nextDate,
          id,
          ACTIVE_BOOKING_STATUSES,
          nextStart,
          nextEnd,
        ],
      );

      if (conflict.rowCount) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(409).json({
          success: false,
          message: "The doctor already has an overlapping appointment.",
        });
      }
    }

    const result = await client.query(
      `UPDATE appointments
       SET patient_id = $1,
           doctor_id = $2,
           appointment_date = $3::date,
           start_time = $4::time,
           end_time = $5::time,
           status = $6,
           appointment_type = $7,
           reason = $8,
           symptoms = $9,
           notes = $10,
           updated_at = NOW()
       WHERE id = $11 AND hospital_id = $12
       RETURNING *`,
      [
        nextPatient,
        nextDoctor,
        nextDate,
        nextStart,
        nextEnd,
        nextStatus,
        appointment_type ?? current.appointment_type,
        reason === undefined ? current.reason : reason,
        symptoms === undefined ? current.symptoms : symptoms,
        notes === undefined ? current.notes : notes,
        id,
        hospitalId,
      ],
    );

    await client.query("COMMIT");
    transactionOpen = false;

    res.json({
      success: true,
      message: "Appointment updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const cancel = asyncHandler(async (req, res) => {
  const hospitalId = hospitalIdOrRespond(req, res);
  if (!hospitalId) return;

  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid appointment ID.",
    });
  }

  const reason = String(req.body?.reason || "").trim();

  const result = await query(
    `UPDATE appointments
     SET status = 'cancelled',
         cancellation_reason = $1,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
       AND hospital_id = $3
       AND status IN ('scheduled', 'confirmed')
     RETURNING id`,
    [reason || null, req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(409).json({
      success: false,
      message:
        "Appointment not found or cannot be cancelled in its current status.",
    });
  }

  res.json({
    success: true,
    message: "Appointment cancelled successfully.",
  });
});

const changeStatus = asyncHandler(async (req, res) => {
  const hospitalId = hospitalIdOrRespond(req, res);
  if (!hospitalId) return;

  const { id } = req.params;
  const { status } = req.body;

  if (!validId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid appointment ID.",
    });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(422).json({
      success: false,
      message: "Invalid appointment status.",
    });
  }

  const result = await query(
    `UPDATE appointments
     SET status = $1,
         cancellation_reason = CASE
           WHEN $1 = 'cancelled' THEN $2
           ELSE cancellation_reason
         END,
         cancelled_at = CASE
           WHEN $1 = 'cancelled' THEN NOW()
           WHEN $1 <> 'cancelled' THEN NULL
           ELSE cancelled_at
         END,
         updated_at = NOW()
     WHERE id = $3 AND hospital_id = $4
     RETURNING *`,
    [status, String(req.body.reason || "").trim() || null, id, hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Appointment not found.",
    });
  }

  res.json({
    success: true,
    message: "Appointment status updated successfully.",
    data: result.rows[0],
  });
});

module.exports = {
  list,
  getById,
  create,
  update,
  cancel,
  changeStatus,
};

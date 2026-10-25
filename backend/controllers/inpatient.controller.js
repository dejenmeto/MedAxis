const inpatient = require("../services/inpatient.service");
const { recordAudit } = require("../services/audit/audit.service");
const { asyncHandler } = require("../utils/helpers");

// Every inpatient operation must be scoped to the user's active hospital.
function hospitalId(req) {
  const id = req.user?.hospitalId;

  if (!id) {
    const error = new Error("An active hospital is required.");
    error.status = 403;
    throw error;
  }

  return id;
}

// Keep the existing audit service and its argument names.
async function audit(req, action, entityType, entityId, extra = {}) {
  await recordAudit({
    userId: req.user.id,
    hospitalId: hospitalId(req),
    action,
    entityType,
    entityId,
    req,
    ...extra,
  });
}

function notFound(res, resource) {
  return res.status(404).json({
    success: false,
    message: `${resource} not found.`,
  });
}

function listOptions(req, extra = {}) {
  return {
    page: req.query.page,
    limit: req.query.limit,
    search: String(req.query.search || "")
      .trim()
      .slice(0, 100),
    status: req.query.status || "all",
    ...extra,
  };
}

// -------------------------
// ROOMS
// -------------------------

const listRooms = asyncHandler(async (req, res) => {
  const result = await inpatient.listRooms(hospitalId(req), listOptions(req));

  // Preserve the existing paginated response shape.
  return res.json({ success: true, ...result });
});

const getRoom = asyncHandler(async (req, res) => {
  const room = await inpatient.getRoom(hospitalId(req), req.params.id);

  if (!room) return notFound(res, "Room");

  return res.json({ success: true, data: room });
});

const createRoom = asyncHandler(async (req, res) => {
  const room = await inpatient.createRoom(hospitalId(req), req.body);

  await audit(req, "inpatient.room.create", "room", room.id, {
    newValues: {
      room_number: room.room_number,
      room_type: room.room_type,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Room created successfully.",
    data: room,
  });
});

const updateRoom = asyncHandler(async (req, res) => {
  const room = await inpatient.updateRoom(
    hospitalId(req),
    req.params.id,
    req.body,
  );

  if (!room) return notFound(res, "Room");

  await audit(req, "inpatient.room.update", "room", room.id, {
    newValues: {
      room_number: room.room_number,
      room_type: room.room_type,
      is_active: room.is_active,
    },
  });

  return res.json({
    success: true,
    message: "Room updated successfully.",
    data: room,
  });
});

const deactivateRoom = asyncHandler(async (req, res) => {
  const room = await inpatient.updateRoom(hospitalId(req), req.params.id, {
    is_active: false,
  });

  if (!room) return notFound(res, "Room");

  await audit(req, "inpatient.room.deactivate", "room", room.id);

  return res.json({
    success: true,
    message: "Room deactivated successfully.",
    data: room,
  });
});

// -------------------------
// BEDS
// -------------------------

const listBeds = asyncHandler(async (req, res) => {
  const result = await inpatient.listBeds(
    hospitalId(req),
    listOptions(req, { room_id: req.query.room_id }),
  );

  return res.json({ success: true, ...result });
});

const getBed = asyncHandler(async (req, res) => {
  const bed = await inpatient.getBed(hospitalId(req), req.params.id);

  if (!bed) return notFound(res, "Bed");

  return res.json({ success: true, data: bed });
});

const createBed = asyncHandler(async (req, res) => {
  const bed = await inpatient.createBed(hospitalId(req), req.body);

  await audit(req, "inpatient.bed.create", "bed", bed.id, {
    newValues: {
      bed_number: bed.bed_number,
      bed_status: bed.bed_status,
      room_id: bed.room_id,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Bed created successfully.",
    data: bed,
  });
});

const updateBed = asyncHandler(async (req, res) => {
  const bed = await inpatient.updateBed(
    hospitalId(req),
    req.params.id,
    req.body,
  );

  if (!bed) return notFound(res, "Bed");

  await audit(req, "inpatient.bed.update", "bed", bed.id, {
    newValues: {
      bed_number: bed.bed_number,
      bed_status: bed.bed_status,
      room_id: bed.room_id,
    },
  });

  return res.json({
    success: true,
    message: "Bed updated successfully.",
    data: bed,
  });
});

// -------------------------
// ADMISSIONS
// -------------------------

const listAdmissions = asyncHandler(async (req, res) => {
  const result = await inpatient.listAdmissions(
    hospitalId(req),
    listOptions(req, { patient_id: req.query.patient_id }),
  );

  return res.json({ success: true, ...result });
});

const getAdmission = asyncHandler(async (req, res) => {
  const admission = await inpatient.getAdmission(
    hospitalId(req),
    req.params.id,
  );

  if (!admission) return notFound(res, "Admission");

  return res.json({ success: true, data: admission });
});

const createAdmission = asyncHandler(async (req, res) => {
  const admission = await inpatient.createAdmission(
    hospitalId(req),
    req.user.id,
    req.body,
  );

  await audit(req, "inpatient.admission.create", "admission", admission.id, {
    newValues: {
      admission_number: admission.admission_number,
      patient_id: admission.patient_id,
      bed_id: admission.bed_id,
      admission_type: admission.admission_type,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Patient admitted successfully.",
    data: admission,
  });
});

const updateAdmission = asyncHandler(async (req, res) => {
  const admission = await inpatient.updateAdmission(
    hospitalId(req),
    req.params.id,
    req.body,
  );

  if (!admission) return notFound(res, "Admission");

  await audit(req, "inpatient.admission.update", "admission", admission.id, {
    newValues: {
      admission_type: admission.admission_type,
      admission_reason: admission.admission_reason,
      expected_discharge_at: admission.expected_discharge_at,
      attending_staff_id: admission.attending_staff_id,
    },
  });

  return res.json({
    success: true,
    message: "Admission updated successfully.",
    data: admission,
  });
});

const dischargeAdmission = asyncHandler(async (req, res) => {
  const admission = await inpatient.dischargeAdmission(
    hospitalId(req),
    req.params.id,
    req.body?.discharge_notes,
  );

  if (!admission) return notFound(res, "Admission");

  await audit(req, "inpatient.admission.discharge", "admission", admission.id, {
    newValues: {
      admission_status: admission.admission_status,
      discharged_at: admission.discharged_at,
    },
  });

  return res.json({
    success: true,
    message: "Patient discharged successfully.",
    data: admission,
  });
});

const cancelAdmission = asyncHandler(async (req, res) => {
  const admission = await inpatient.cancelAdmission(
    hospitalId(req),
    req.params.id,
    req.body?.reason,
  );

  if (!admission) return notFound(res, "Admission");

  await audit(req, "inpatient.admission.cancel", "admission", admission.id, {
    newValues: {
      admission_status: admission.admission_status,
    },
  });

  return res.json({
    success: true,
    message: "Admission cancelled successfully.",
    data: admission,
  });
});

module.exports = {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deactivateRoom,
  listBeds,
  getBed,
  createBed,
  updateBed,
  listAdmissions,
  getAdmission,
  createAdmission,
  updateAdmission,
  dischargeAdmission,
  cancelAdmission,
};

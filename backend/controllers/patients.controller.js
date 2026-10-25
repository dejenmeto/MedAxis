const patients = require("../services/patients.service");
const { query } = require("../config/database");
const { recordAudit } = require("../services/audit/audit.service");
const { asyncHandler } = require("../utils/helpers");

function hospitalId(req) {
  if (!req.user.hospitalId) {
    const error = new Error("An active hospital is required.");
    error.status = 400;
    throw error;
  }
  return req.user.hospitalId;
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  return value;
}

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );

  const result = await patients.listPatients(hospitalId(req), {
    page,
    limit,
    search: String(req.query.search || "")
      .trim()
      .slice(0, 100),
    status: req.query.status || "all",
  });

  res.json({ success: true, ...result });
});

const getById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Invalid patient ID.",
    });
  }

  const patient = await patients.getPatient(hospitalId(req), id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      message: "Patient not found.",
    });
  }

  res.json({ success: true, data: patient });
});

const create = asyncHandler(async (req, res) => {
  const patient = await patients.createPatient(hospitalId(req), req.body);

  await recordAudit({
    userId: req.user.id,
    hospitalId: hospitalId(req),
    action: "patient.create",
    entityType: "patient",
    entityId: patient.id,
    newValues: {
      mr_number: patient.mr_number,
      patient_type: patient.patient_type,
    },
    req,
  });

  res.status(201).json({
    success: true,
    message: "Patient registered successfully.",
    data: patient,
  });
});

const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Invalid patient ID.",
    });
  }

  const previous = await patients.getPatient(hospitalId(req), id);

  if (!previous) {
    return res.status(404).json({
      success: false,
      message: "Patient not found.",
    });
  }

  const patient = await patients.updatePatient(hospitalId(req), id, req.body);

  await recordAudit({
    userId: req.user.id,
    hospitalId: hospitalId(req),
    action: "patient.update",
    entityType: "patient",
    entityId: patient.id,
    oldValues: {
      mr_number: previous.mr_number,
      patient_type: previous.patient_type,
    },
    newValues: {
      mr_number: patient.mr_number,
      patient_type: patient.patient_type,
    },
    req,
  });

  res.json({
    success: true,
    message: "Patient updated successfully.",
    data: patient,
  });
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Invalid patient ID.",
    });
  }

  const removed = await patients.deletePatient(hospitalId(req), id);

  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Active patient not found.",
    });
  }

  await recordAudit({
    userId: req.user.id,
    hospitalId: hospitalId(req),
    action: "patient.deactivate",
    entityType: "patient",
    entityId: id,
    req,
  });

  res.json({
    success: true,
    message: "Patient deactivated successfully.",
  });
});

module.exports = { list, getById, create, update, remove };

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");
const { uploadDirectory } = require("../middlewares/medicalDocumentUpload");

const CATEGORIES = [
  "lab_result",
  "prescription",
  "imaging_report",
  "discharge_summary",
  "consent_form",
  "referral",
  "clinical_note",
  "other",
];

const allowedRoles = [
  "super_admin",
  "hospital_admin",
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "radiologist",
  "pharmacist",
  "accountant",
];

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getHospitalId(req) {
  const hospitalId = req.user?.hospitalId;

  if (!hospitalId) {
    throw httpError("Your account is not assigned to a hospital.", 403);
  }

  return hospitalId;
}

function getUserId(req) {
  return req.user?.id || null;
}

function requireDocumentAccess(req) {
  if (!allowedRoles.includes(req.user?.role)) {
    throw httpError("You are not authorized to access medical documents.", 403);
  }
}

function safeOriginalName(name) {
  return path.basename(String(name || "document")).slice(0, 255);
}

async function findDocument(id, hospitalId) {
  const result = await pool.query(
    `SELECT *
     FROM medical_documents
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId],
  );

  if (!result.rowCount) {
    throw httpError("Document not found.", 404);
  }

  return result.rows[0];
}

// GET /api/documents
const listDocuments = asyncHandler(async (req, res) => {
  requireDocumentAccess(req);
  const hospitalId = getHospitalId(req);

  const {
    search = "",
    category = "",
    patientId = "",
    archived = "false",
    page = "1",
    limit = "10",
  } = req.query;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));

  const conditions = ["d.hospital_id = $1"];
  const values = [hospitalId];

  const addCondition = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (archived === "true") {
    conditions.push("d.is_archived = TRUE");
  } else {
    conditions.push("d.is_archived = FALSE");
  }

  if (search.trim()) {
    values.push(`%${search.trim()}%`);
    const p = `$${values.length}`;
    conditions.push(
      `(d.title ILIKE ${p}
        OR d.document_code ILIKE ${p}
        OR d.original_filename ILIKE ${p}
        OR COALESCE(d.description, '') ILIKE ${p})`,
    );
  }

  if (category && CATEGORIES.includes(category)) {
    addCondition("d.category = ?", category);
  }

  if (patientId) {
    addCondition("d.patient_id = ?", patientId);
  }

  const where = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM medical_documents d
     WHERE ${where}`,
    values,
  );

  const total = countResult.rows[0].total;

  const result = await pool.query(
    `SELECT
       d.id, d.hospital_id, d.patient_id, d.document_code,
       d.title, d.category, d.description, d.original_filename,
       d.mime_type, d.file_size, d.document_date, d.uploaded_by,
       d.is_archived, d.archived_at, d.created_at, d.updated_at
     FROM medical_documents d
     WHERE ${where}
     ORDER BY d.created_at DESC, d.id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, pageSize, (pageNumber - 1) * pageSize],
  );

  res.json({
    data: result.rows,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// POST /api/documents
const uploadDocument = asyncHandler(async (req, res) => {
  requireDocumentAccess(req);
  const hospitalId = getHospitalId(req);

  if (!req.file) {
    throw httpError("Please select a document to upload.");
  }

  const { patient_id, title, category, description, document_date } = req.body;

  if (!patient_id || !title?.trim() || !category) {
    await fs.unlink(req.file.path).catch(() => {});
    throw httpError("Patient, title, and category are required.");
  }

  if (!CATEGORIES.includes(category)) {
    await fs.unlink(req.file.path).catch(() => {});
    throw httpError("Invalid document category.");
  }

  if (document_date && Number.isNaN(Date.parse(document_date))) {
    await fs.unlink(req.file.path).catch(() => {});
    throw httpError("Invalid document date.");
  }

  const patientResult = await pool.query(
    "SELECT id FROM patients WHERE id = $1 AND hospital_id = $2",
    [patient_id, hospitalId],
  );

  if (!patientResult.rowCount) {
    await fs.unlink(req.file.path).catch(() => {});
    throw httpError("Patient not found in this hospital.", 404);
  }

  const code = `DOC-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  try {
    const result = await pool.query(
      `INSERT INTO medical_documents (
         hospital_id, patient_id, document_code, title, category,
         description, original_filename, stored_filename, storage_path,
         mime_type, file_size, document_date, uploaded_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING
         id, hospital_id, patient_id, document_code, title, category,
         description, original_filename, mime_type, file_size,
         document_date, uploaded_by, is_archived, created_at`,
      [
        hospitalId,
        patient_id,
        code,
        title.trim(),
        category,
        description?.trim() || null,
        safeOriginalName(req.file.originalname),
        req.file.filename,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        document_date || null,
        getUserId(req),
      ],
    );

    res.status(201).json({
      message: "Medical document uploaded successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
});

// GET /api/documents/:id/download
const downloadDocument = asyncHandler(async (req, res) => {
  requireDocumentAccess(req);
  const hospitalId = getHospitalId(req);
  const document = await findDocument(req.params.id, hospitalId);

  if (document.is_archived) {
    throw httpError("Archived documents cannot be downloaded.", 403);
  }

  // Resolve and constrain the path to the configured upload directory.
  const absolutePath = path.resolve(document.storage_path);
  const root = path.resolve(uploadDirectory) + path.sep;

  if (!absolutePath.startsWith(root)) {
    throw httpError("Invalid document storage reference.", 500);
  }

  await fs.access(absolutePath);

  res.download(absolutePath, safeOriginalName(document.original_filename));
});

// PATCH /api/documents/:id
const updateDocument = asyncHandler(async (req, res) => {
  requireDocumentAccess(req);
  const hospitalId = getHospitalId(req);
  const { title, category, description, document_date } = req.body;

  if (category && !CATEGORIES.includes(category)) {
    throw httpError("Invalid document category.");
  }

  if (document_date && Number.isNaN(Date.parse(document_date))) {
    throw httpError("Invalid document date.");
  }

  const result = await pool.query(
    `UPDATE medical_documents
     SET title = COALESCE($1, title),
         category = COALESCE($2, category),
         description = COALESCE($3, description),
         document_date = CASE
           WHEN $4::text IS NULL THEN document_date
           WHEN $4::text = '' THEN NULL
           ELSE $4::date
         END,
         updated_at = NOW()
     WHERE id = $5 AND hospital_id = $6 AND is_archived = FALSE
     RETURNING
       id, patient_id, document_code, title, category, description,
       original_filename, mime_type, file_size, document_date,
       is_archived, updated_at`,
    [
      title === undefined ? null : title.trim(),
      category || null,
      description === undefined ? null : description,
      document_date === undefined ? null : document_date,
      req.params.id,
      hospitalId,
    ],
  );

  if (!result.rowCount) {
    throw httpError("Document not found or already archived.", 404);
  }

  res.json({
    message: "Document details updated successfully.",
    data: result.rows[0],
  });
});

// PATCH /api/documents/:id/archive
const archiveDocument = asyncHandler(async (req, res) => {
  requireDocumentAccess(req);
  const hospitalId = getHospitalId(req);

  const result = await pool.query(
    `UPDATE medical_documents
     SET is_archived = TRUE,
         archived_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2 AND is_archived = FALSE
     RETURNING id, document_code, is_archived, archived_at`,
    [req.params.id, hospitalId],
  );

  if (!result.rowCount) {
    throw httpError("Document not found or already archived.", 404);
  }

  res.json({
    message: "Document archived successfully.",
    data: result.rows[0],
  });
});

module.exports = {
  listDocuments,
  uploadDocument,
  downloadDocument,
  updateDocument,
  archiveDocument,
};

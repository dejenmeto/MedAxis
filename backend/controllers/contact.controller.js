const pool = require("../config/database");

const ADMIN_ROLES = ["super_admin", "hospital_admin"];

function isAdmin(req, res) {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: "You are not authorized to manage contact messages.",
    });
    return false;
  }

  return true;
}

function getHospitalId(req) {
  const raw = req.user?.hospitalId;

  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getAdminScope(req, res) {
  if (req.user.role === "super_admin") {
    const requested = req.query.hospitalId;

    if (requested !== undefined) {
      const hospitalId = Number(requested);

      if (!Number.isSafeInteger(hospitalId) || hospitalId <= 0) {
        res.status(400).json({
          success: false,
          message: "Invalid hospital ID.",
        });
        return undefined;
      }

      return { hospitalId };
    }

    return {};
  }

  const hospitalId = getHospitalId(req);

  if (!hospitalId) {
    res.status(403).json({
      success: false,
      message: "Your account is not assigned to a hospital.",
    });
    return undefined;
  }

  return { hospitalId };
}

function applyScope(where, values, scope) {
  if (scope.hospitalId !== undefined) {
    values.push(scope.hospitalId);
    where.push(`hospital_id = $${values.length}`);
  }

  return { where, values };
}

function validText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

// POST /api/contact
// Public contact form submission.
exports.createMessage = async (req, res) => {
  const { name, email, subject, message } = req.body || {};

  if (
    !validText(name, 100) ||
    !validText(email, 254) ||
    !validText(subject, 150) ||
    !validText(message, 3000)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide a name, email, subject, and message within the allowed lengths.",
    });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  // Basic email syntax validation; the email address is not verified.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address.",
    });
  }

  try {
    // Public submissions have no hospital association by default.
    // Associate a hospital here only if the server has a trusted,
    // configured hospital ID for this public website.
    const result = await pool.query(
      `INSERT INTO contact_messages
        (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, created_at`,
      [cleanName, cleanEmail, cleanSubject, cleanMessage],
    );

    return res.status(201).json({
      success: true,
      message: "Your inquiry has been submitted successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create contact message error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit your inquiry at this time.",
    });
  }
};

// GET /api/contact/admin
// GET /api/contact/admin?status=new&page=1&limit=20&search=...
exports.listMessages = async (req, res) => {
  if (!isAdmin(req, res)) return;

  const scope = getAdminScope(req, res);
  if (scope === undefined) return;

  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const search = String(req.query.search || "")
    .trim()
    .slice(0, 150);
  const status = String(req.query.status || "").trim();

  const allowedStatuses = [
    "new",
    "read",
    "in_progress",
    "resolved",
    "archived",
  ];

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: "Page must be positive and limit must be between 1 and 100.",
    });
  }

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact message status.",
    });
  }

  try {
    const where = [];
    const values = [];

    applyScope(where, values, scope);

    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
      const position = values.length;

      where.push(
        `(name ILIKE $${position} ESCAPE '\\' ` +
          `OR email ILIKE $${position} ESCAPE '\\' ` +
          `OR subject ILIKE $${position} ESCAPE '\\')`,
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM contact_messages
       ${whereSql}`,
      values,
    );

    const offset = (page - 1) * limit;
    const listValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT
         id, hospital_id, name, email, subject, message,
         status, admin_notes, read_at, resolved_at,
         created_at, updated_at
       FROM contact_messages
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      listValues,
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("List contact messages error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load contact messages.",
    });
  }
};

// GET /api/contact/admin/summary
exports.getSummary = async (req, res) => {
  if (!isAdmin(req, res)) return;

  const scope = getAdminScope(req, res);
  if (scope === undefined) return;

  try {
    const values = [];
    const where = [];

    applyScope(where, values, scope);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'new')::int AS new,
         COUNT(*) FILTER (WHERE status = 'read')::int AS read,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
         COUNT(*) FILTER (WHERE status = 'archived')::int AS archived
       FROM contact_messages
       ${whereSql}`,
      values,
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Contact summary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load contact summary.",
    });
  }
};

// PATCH /api/contact/admin/:id
exports.updateMessage = async (req, res) => {
  if (!isAdmin(req, res)) return;

  const scope = getAdminScope(req, res);
  if (scope === undefined) return;

  const id = Number(req.params.id);
  const { status, admin_notes } = req.body || {};
  const allowedStatuses = [
    "new",
    "read",
    "in_progress",
    "resolved",
    "archived",
  ];

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact message ID.",
    });
  }

  if (status !== undefined && !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact message status.",
    });
  }

  if (
    admin_notes !== undefined &&
    admin_notes !== null &&
    (typeof admin_notes !== "string" || admin_notes.length > 5000)
  ) {
    return res.status(400).json({
      success: false,
      message: "Admin notes must not exceed 5000 characters.",
    });
  }

  if (status === undefined && admin_notes === undefined) {
    return res.status(400).json({
      success: false,
      message: "Provide a status or admin notes to update.",
    });
  }

  try {
    const values = [id];
    const where = ["id = $1"];

    applyScope(where, values, scope);

    const assignments = [];

    if (status !== undefined) {
      values.push(status);
      const pos = values.length;

      assignments.push(`status = $${pos}`);

      assignments.push(
        `read_at = CASE
          WHEN $${pos} IN ('read', 'in_progress', 'resolved', 'archived')
            THEN COALESCE(read_at, NOW())
          ELSE read_at
        END`,
      );

      assignments.push(
        `resolved_at = CASE
          WHEN $${pos} = 'resolved' THEN COALESCE(resolved_at, NOW())
          WHEN $${pos} <> 'resolved' THEN NULL
          ELSE resolved_at
        END`,
      );
    }

    if (admin_notes !== undefined) {
      values.push(admin_notes === null ? null : admin_notes.trim());
      assignments.push(`admin_notes = $${values.length}`);
    }

    assignments.push("updated_at = NOW()");

    const result = await pool.query(
      `UPDATE contact_messages
       SET ${assignments.join(", ")}
       WHERE ${where.join(" AND ")}
       RETURNING id, name, email, subject, status, admin_notes,
                 read_at, resolved_at, created_at, updated_at`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    return res.json({
      success: true,
      message: "Contact message updated.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update contact message error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update contact message.",
    });
  }
};

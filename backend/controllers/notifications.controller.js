const pool = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const ALLOWED_CATEGORIES = [
  "general",
  "appointment",
  "queue",
  "laboratory",
  "pharmacy",
  "billing",
  "emergency",
  "system",
];

const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"];

const ADMIN_ROLES = ["super_admin", "hospital_admin"];

function getUserId(req) {
  return String(req.user.id);
}

function getHospitalId(req) {
  return req.user.hospitalId ? String(req.user.hospitalId) : null;
}

function isAdmin(req) {
  return ADMIN_ROLES.includes(req.user.role);
}

function parseLimit(value, fallback = 20, maximum = 100) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function validId(value) {
  return /^\d+$/.test(String(value || ""));
}

/**
 * Ensures a user belongs to the requested hospital when the users table
 * has a hospital_id column. Some installations associate users with
 * hospitals through other profile tables, so absence of that column
 * is handled separately rather than causing a SQL error.
 */
async function validateRecipient(recipientId, hospitalId) {
  if (!validId(recipientId)) {
    const error = new Error("A valid recipient user ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const userResult = await pool.query(
    `SELECT id
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [recipientId],
  );

  if (userResult.rowCount === 0) {
    const error = new Error("Recipient user was not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!hospitalId) {
    return;
  }

  const columnResult = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'users'
       AND column_name = 'hospital_id'
     LIMIT 1`,
  );

  if (columnResult.rowCount > 0) {
    const membershipResult = await pool.query(
      `SELECT id
       FROM users
       WHERE id = $1
         AND hospital_id = $2
       LIMIT 1`,
      [recipientId, hospitalId],
    );

    if (membershipResult.rowCount === 0) {
      const error = new Error(
        "The recipient does not belong to your hospital.",
      );
      error.statusCode = 403;
      throw error;
    }
  }
}

/**
 * GET /api/notifications
 * Users can see only their own notifications.
 */
const listNotifications = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const hospitalId = getHospitalId(req);

  const page = parseLimit(req.query.page, 1, 1000000);
  const limit = parseLimit(req.query.limit, 20, 100);
  const offset = (page - 1) * limit;

  const search = String(req.query.search || "")
    .trim()
    .slice(0, 150);
  const status = String(req.query.status || "")
    .trim()
    .toLowerCase();
  const category = String(req.query.category || "")
    .trim()
    .toLowerCase();
  const priority = String(req.query.priority || "")
    .trim()
    .toLowerCase();

  const conditions = ["recipient_user_id = $1"];
  const values = [userId];

  if (hospitalId) {
    values.push(hospitalId);
    conditions.push(`(hospital_id = $${values.length} OR hospital_id IS NULL)`);
  }

  if (["unread", "read", "archived"].includes(status)) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (ALLOWED_CATEGORIES.includes(category)) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  if (ALLOWED_PRIORITIES.includes(priority)) {
    values.push(priority);
    conditions.push(`priority = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(title ILIKE $${values.length} OR message ILIKE $${values.length})`,
    );
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM notifications
     WHERE ${whereClause}`,
    values,
  );

  const listValues = [...values, limit, offset];

  const result = await pool.query(
    `SELECT
        id,
        hospital_id,
        recipient_user_id,
        created_by,
        title,
        message,
        category,
        priority,
        status,
        action_url,
        read_at,
        archived_at,
        created_at,
        updated_at
     FROM notifications
     WHERE ${whereClause}
     ORDER BY
       CASE priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'normal' THEN 3
         ELSE 4
       END,
       created_at DESC
     LIMIT $${listValues.length - 1}
     OFFSET $${listValues.length}`,
    listValues,
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  });
});

/**
 * GET /api/notifications/unread-count
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const values = [getUserId(req)];
  let hospitalCondition = "";

  const hospitalId = getHospitalId(req);

  if (hospitalId) {
    values.push(hospitalId);
    hospitalCondition = `AND (hospital_id = $2 OR hospital_id IS NULL)`;
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE recipient_user_id = $1
       AND status = 'unread'
       ${hospitalCondition}`,
    values,
  );

  res.json({
    success: true,
    unreadCount: result.rows[0].unread_count,
  });
});

/**
 * POST /api/notifications
 * Only hospital administrators and super administrators can send
 * a notification to a specified user.
 */
const createNotification = asyncHandler(async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Only administrators can create notifications.",
    });
  }

  const {
    recipientUserId,
    title,
    message,
    category = "general",
    priority = "normal",
    actionUrl = null,
  } = req.body;

  const cleanTitle = String(title || "").trim();
  const cleanMessage = String(message || "").trim();

  if (!cleanTitle || !cleanMessage) {
    return res.status(400).json({
      success: false,
      message: "Title and message are required.",
    });
  }

  if (cleanTitle.length > 180 || cleanMessage.length > 10000) {
    return res.status(400).json({
      success: false,
      message: "The title or message exceeds the allowed length.",
    });
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: "Invalid notification category.",
    });
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid notification priority.",
    });
  }

  if (
    actionUrl !== null &&
    (typeof actionUrl !== "string" ||
      actionUrl.length > 500 ||
      !actionUrl.startsWith("/") ||
      actionUrl.startsWith("//"))
  ) {
    return res.status(400).json({
      success: false,
      message: "Action URL must be a local application path.",
    });
  }

  const actorHospitalId = getHospitalId(req);
  let hospitalId = actorHospitalId;

  if (req.user.role === "super_admin" && req.body.hospitalId) {
    hospitalId = String(req.body.hospitalId);
  }

  if (req.user.role === "hospital_admin" && !actorHospitalId) {
    return res.status(403).json({
      success: false,
      message: "Your administrator account has no assigned hospital.",
    });
  }

  if (hospitalId && !validId(hospitalId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid hospital ID.",
    });
  }

  await validateRecipient(recipientUserId, hospitalId);

  const result = await pool.query(
    `INSERT INTO notifications (
       hospital_id,
       recipient_user_id,
       created_by,
       title,
       message,
       category,
       priority,
       action_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      hospitalId,
      String(recipientUserId),
      getUserId(req),
      cleanTitle,
      cleanMessage,
      category,
      priority,
      actionUrl,
    ],
  );

  res.status(201).json({
    success: true,
    message: "Notification created successfully.",
    data: result.rows[0],
  });
});

/**
 * PATCH /api/notifications/:id/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid notification ID.",
    });
  }

  const result = await pool.query(
    `UPDATE notifications
     SET status = 'read',
         read_at = COALESCE(read_at, NOW()),
         archived_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND recipient_user_id = $2
       AND status <> 'archived'
     RETURNING *`,
    [req.params.id, getUserId(req)],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Notification not found or already archived.",
    });
  }

  res.json({
    success: true,
    message: "Notification marked as read.",
    data: result.rows[0],
  });
});

/**
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const values = [getUserId(req)];
  let hospitalCondition = "";

  const hospitalId = getHospitalId(req);

  if (hospitalId) {
    values.push(hospitalId);
    hospitalCondition = `AND (hospital_id = $2 OR hospital_id IS NULL)`;
  }

  const result = await pool.query(
    `UPDATE notifications
     SET status = 'read',
         read_at = COALESCE(read_at, NOW()),
         updated_at = NOW()
     WHERE recipient_user_id = $1
       AND status = 'unread'
       ${hospitalCondition}
     RETURNING id`,
    values,
  );

  res.json({
    success: true,
    message: "All notifications marked as read.",
    updatedCount: result.rowCount,
  });
});

/**
 * PATCH /api/notifications/:id/archive
 */
const archiveNotification = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid notification ID.",
    });
  }

  const result = await pool.query(
    `UPDATE notifications
     SET status = 'archived',
         archived_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND recipient_user_id = $2
     RETURNING *`,
    [req.params.id, getUserId(req)],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Notification not found.",
    });
  }

  res.json({
    success: true,
    message: "Notification archived.",
    data: result.rows[0],
  });
});

/**
 * DELETE /api/notifications/:id
 * Users can delete only their own notification.
 */
const deleteNotification = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid notification ID.",
    });
  }

  const result = await pool.query(
    `DELETE FROM notifications
     WHERE id = $1
       AND recipient_user_id = $2
     RETURNING id`,
    [req.params.id, getUserId(req)],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Notification not found.",
    });
  }

  res.json({
    success: true,
    message: "Notification deleted.",
  });
});

module.exports = {
  listNotifications,
  getUnreadCount,
  createNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
};

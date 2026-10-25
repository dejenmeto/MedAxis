const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

const ALLOWED_ROLES = [
  "super_admin",
  "hospital_admin",
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "radiologist",
  "pharmacist",
  "accountant",
  "patient",
  "guardian",
];

// Never send password hashes to the frontend.
function publicUser(row) {
  const { password_hash, ...safeUser } = row;
  return safeUser;
}

// Resolve the hospital selected in the access token.
// Super administrators can explicitly select a hospital when needed.

function getHospitalScope(req) {
  if (req.user.role === "super_admin") {
    return req.query.hospital_id || req.body?.hospital_id || null;
  }

  return req.user.hospitalId || null;
}

// Check whether a target user belongs to the current hospital.
async function getTargetUser(userId, hospitalId) {
  const result = await pool.query(
    `SELECT u.id, u.role, u.is_active, uh.hospital_id
     FROM users u
     JOIN user_hospitals uh ON uh.user_id = u.id
     WHERE u.id = $1 AND uh.hospital_id = $2
     LIMIT 1`,
    [userId, hospitalId],
  );

  return result.rows[0] || null;
}

async function canManageTarget(req, target) {
  if (req.user.role === "super_admin") {
    return true;
  }

  if (
    req.user.role !== "hospital_admin" ||
    !req.user.hospitalId ||
    String(target.hospital_id) !== String(req.user.hospitalId)
  ) {
    return false;
  }

  // Hospital administrators cannot modify super administrators.
  return target.role !== "super_admin";
}

// GET /users
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim();
    const hospitalId = getHospitalScope(req);

    const conditions = [];
    const values = [];

    if (req.user.role !== "super_admin") {
      if (!hospitalId) {
        return res.status(403).json({
          message: "No active hospital is selected.",
        });
      }

      values.push(hospitalId);
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM user_hospitals uh
          WHERE uh.user_id = users.id
            AND uh.hospital_id = $${values.length}
        )`,
      );
    } else if (hospitalId) {
      values.push(hospitalId);
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM user_hospitals uh
          WHERE uh.user_id = users.id
            AND uh.hospital_id = $${values.length}
        )`,
      );
    }

    if (search) {
      values.push(`%${search}%`);
      const index = values.length;

      conditions.push(
        `(first_name ILIKE $${index}
          OR last_name ILIKE $${index}
          OR email ILIKE $${index})`,
      );
    }

    if (role && ALLOWED_ROLES.includes(role)) {
      values.push(role);
      conditions.push(`role = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users
       ${whereClause}`,
      values,
    );

    const listValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT
         users.id,
         users.first_name,
         users.last_name,
         users.email,
         users.role,
         users.is_active,
         users.created_at,
         users.updated_at,
         COALESCE(
           (
             SELECT uh.hospital_id
             FROM user_hospitals uh
             WHERE uh.user_id = users.id
             ORDER BY uh.is_default DESC, uh.created_at ASC
             LIMIT 1
           ),
           NULL
         ) AS hospital_id
       FROM users
       ${whereClause}
       ORDER BY users.created_at DESC
       LIMIT $${listValues.length - 1}
       OFFSET $${listValues.length}`,
      listValues,
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /users
async function create(req, res, next) {
  const client = await pool.connect();

  try {
    const { first_name, last_name, email, password, role, hospital_id } =
      req.body;

    if (
      !first_name?.trim() ||
      !last_name?.trim() ||
      !email?.trim() ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        message:
          "First name, last name, email, password and role are required.",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: "Invalid user role.",
      });
    }

    if (req.user.role === "hospital_admin" && role === "super_admin") {
      return res.status(403).json({
        message: "Hospital administrators cannot create super administrators.",
      });
    }

    const targetHospitalId =
      req.user.role === "super_admin"
        ? hospital_id || null
        : req.user.hospitalId;

    if (!targetHospitalId) {
      return res.status(400).json({
        message: "A hospital must be selected for this user.",
      });
    }

    if (String(password).length < 12) {
      return res.status(400).json({
        message: "Use a password containing at least 12 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query("BEGIN");

    // Verify the hospital exists and is active.
    const hospitalResult = await client.query(
      `SELECT id
       FROM hospitals
       WHERE id = $1 AND is_active = TRUE`,
      [targetHospitalId],
    );

    if (hospitalResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "The selected hospital does not exist or is inactive.",
      });
    }

    // The users table does not contain hospital_id.
    const userResult = await client.query(
      `INSERT INTO users (
         first_name,
         last_name,
         email,
         password_hash,
         role,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING
         id, first_name, last_name, email, role,
         is_active, created_at, updated_at`,
      [
        first_name.trim(),
        last_name.trim(),
        normalizedEmail,
        passwordHash,
        role,
      ],
    );

    const user = userResult.rows[0];

    // Assign the new user to the selected hospital.
    await client.query(
      `INSERT INTO user_hospitals (
         user_id, hospital_id, is_default
       )
       VALUES ($1, $2, TRUE)`,
      [user.id, targetHospitalId],
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "User created successfully.",
      data: {
        ...publicUser(user),
        hospital_id: String(targetHospitalId),
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction may already have ended.
    }

    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    next(error);
  } finally {
    client.release();
  }
}

// PATCH /users/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalScope(req);

    if (req.user.role !== "super_admin" && !hospitalId) {
      return res.status(403).json({
        message: "No active hospital is selected.",
      });
    }

    let target;

    if (req.user.role === "super_admin" && !hospitalId) {
      const result = await pool.query(
        `SELECT id, role, is_active, NULL::bigint AS hospital_id
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id],
      );

      target = result.rows[0] || null;
    } else {
      target = await getTargetUser(id, hospitalId);
    }

    if (!target) {
      return res.status(404).json({
        message: "User not found in the selected hospital.",
      });
    }

    if (!(await canManageTarget(req, target))) {
      return res.status(403).json({
        message: "You cannot manage this user.",
      });
    }

    const { first_name, last_name, email, role, is_active } = req.body;

    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          message: "Invalid user role.",
        });
      }

      if (req.user.role !== "super_admin" && role === "super_admin") {
        return res.status(403).json({
          message: "Only a super administrator can assign this role.",
        });
      }
    }

    if (target.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        message: "You cannot modify a super administrator.",
      });
    }

    const updates = [];
    const values = [];

    function addUpdate(column, value) {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }

    if (first_name !== undefined) {
      if (typeof first_name !== "string" || !first_name.trim()) {
        return res.status(400).json({
          message: "First name cannot be empty.",
        });
      }

      addUpdate("first_name", first_name.trim());
    }

    if (last_name !== undefined) {
      if (typeof last_name !== "string" || !last_name.trim()) {
        return res.status(400).json({
          message: "Last name cannot be empty.",
        });
      }

      addUpdate("last_name", last_name.trim());
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          message: "Email cannot be empty.",
        });
      }

      addUpdate("email", email.trim().toLowerCase());
    }

    if (role !== undefined) addUpdate("role", role);

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return res.status(400).json({
          message: "is_active must be true or false.",
        });
      }

      addUpdate("is_active", is_active);
    }

    if (!updates.length) {
      return res.status(400).json({
        message: "No supported fields provided.",
      });
    }

    addUpdate("updated_at", new Date());
    values.push(id);

    const result = await pool.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING
         id, first_name, last_name, email, role,
         is_active, created_at, updated_at`,
      values,
    );

    res.json({
      message: "User updated successfully.",
      data: {
        ...publicUser(result.rows[0]),
        hospital_id: target.hospital_id ? String(target.hospital_id) : null,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
}

// PATCH /users/:id/deactivate
async function deactivate(req, res, next) {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalScope(req);

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({
        message: "You cannot deactivate your own account.",
      });
    }

    if (req.user.role !== "super_admin" && !hospitalId) {
      return res.status(403).json({
        message: "No active hospital is selected.",
      });
    }

    let target;

    if (req.user.role === "super_admin" && !hospitalId) {
      const result = await pool.query(
        `SELECT id, role, is_active, NULL::bigint AS hospital_id
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id],
      );

      target = result.rows[0] || null;
    } else {
      target = await getTargetUser(id, hospitalId);
    }

    if (!target) {
      return res.status(404).json({
        message: "User not found in the selected hospital.",
      });
    }

    if (!(await canManageTarget(req, target))) {
      return res.status(403).json({
        message: "You cannot deactivate this user.",
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING
         id, first_name, last_name, email, role,
         is_active, created_at, updated_at`,
      [id],
    );

    res.json({
      message: "User deactivated successfully.",
      data: {
        ...publicUser(result.rows[0]),
        hospital_id: target.hospital_id ? String(target.hospital_id) : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  create,
  update,
  deactivate,
};

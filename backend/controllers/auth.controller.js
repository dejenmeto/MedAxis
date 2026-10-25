const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query, pool } = require("../config/database");
const { hashToken, generateToken, asyncHandler } = require("../utils/helpers");
const { recordAudit } = require("../services/audit/audit.service");

function createAccessToken(user, hospitalId) {
  return jwt.sign(
    {
      role: user.role,
      hospitalId: hospitalId ? String(hospitalId) : null,
    },
    process.env.JWT_SECRET,
    {
      subject: String(user.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      issuer: "medaxis-api",
      audience: "medaxis-web",
      algorithm: "HS256",
    },
  );
}

const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password || password.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const userResult = await query(
    `SELECT id, email, password_hash, first_name, last_name,
            role, is_active, locked_until
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [email],
  );

  const user = userResult.rows[0];

  // Use a generic message so login does not reveal whether an email exists.
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  if (
    !user.is_active ||
    (user.locked_until && new Date(user.locked_until) > new Date())
  ) {
    return res.status(403).json({
      success: false,
      message: "This account is unavailable. Contact an administrator.",
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    await query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= 10
             THEN NOW() + INTERVAL '15 minutes'
             ELSE locked_until
           END,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const hospitalsResult = await query(
    `SELECT h.id, h.name, h.code, uh.is_default
     FROM user_hospitals uh
     JOIN hospitals h ON h.id = uh.hospital_id
     WHERE uh.user_id = $1 AND h.is_active = TRUE
     ORDER BY uh.is_default DESC, h.name ASC`,
    [user.id],
  );

  const hospitals = hospitalsResult.rows;

  // An administrator must be explicitly assigned to a hospital.
  if (hospitals.length === 0) {
    return res.status(403).json({
      success: false,
      message: "No active hospital is assigned to this account.",
    });
  }

  const requestedHospital = req.body.hospitalId
    ? String(req.body.hospitalId)
    : null;

  const selectedHospital = requestedHospital
    ? hospitals.find((h) => String(h.id) === requestedHospital)
    : hospitals[0];

  if (!selectedHospital) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that hospital.",
    });
  }

  const refreshToken = generateToken();
  const expiresInDays = 7;

  try {
    await query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    await query(
      `INSERT INTO auth_sessions (
         user_id, token_hash, expires_at, ip_address, user_agent
       )
       VALUES (
         $1, $2, NOW() + INTERVAL '7 days', $3, $4
       )`,
      [
        user.id,
        hashToken(refreshToken),
        req.ip || null,
        req.get("user-agent") || null,
      ],
    );

    await recordAudit({
      userId: user.id,
      hospitalId: selectedHospital.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      req,
    });

    // await pool.query("COMMIT");
  } catch (error) {
    // await pool.query("ROLLBACK");
    throw error;
  }

  res.json({
    success: true,
    message: "Login successful.",
    accessToken: createAccessToken(user, selectedHospital.id),
    refreshToken,
    refreshTokenExpiresIn: expiresInDays * 24 * 60 * 60,
    user: {
      id: String(user.id),
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    },
    hospitals: hospitals.map((hospital) => ({
      id: String(hospital.id),
      name: hospital.name,
      code: hospital.code,
    })),
    activeHospitalId: String(selectedHospital.id),
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = String(req.body.refreshToken || "");

  if (!/^[a-f0-9]{96}$/.test(refreshToken)) {
    return res.status(401).json({
      success: false,
      message: "A valid refresh token is required.",
    });
  }

  const tokenHash = hashToken(refreshToken);

  const result = await query(
    `SELECT s.id AS session_id, u.id, u.email, u.first_name,
            u.last_name, u.role, u.is_active
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.is_active = TRUE`,
    [tokenHash],
  );

  const session = result.rows[0];

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please log in again.",
    });
  }

  const hospitalsResult = await query(
    `SELECT h.id, h.name, h.code
     FROM user_hospitals uh
     JOIN hospitals h ON h.id = uh.hospital_id
     WHERE uh.user_id = $1 AND h.is_active = TRUE
     ORDER BY uh.is_default DESC, h.name ASC`,
    [session.id],
  );

  if (hospitalsResult.rows.length === 0) {
    return res.status(403).json({
      success: false,
      message: "No active hospital is assigned to this account.",
    });
  }

  const hospitalId = String(hospitalsResult.rows[0].id);
  const nextRefreshToken = generateToken();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const revoked = await client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW()
       WHERE id = $1 AND revoked_at IS NULL`,
      [session.session_id],
    );

    if (revoked.rowCount !== 1) {
      throw new Error("Session was already used.");
    }

    await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [session.id, hashToken(nextRefreshToken)],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    return res.status(401).json({
      success: false,
      message: "Session could not be renewed. Please log in again.",
    });
  } finally {
    client.release();
  }

  res.json({
    success: true,
    accessToken: createAccessToken(session, hospitalId),
    refreshToken: nextRefreshToken,
    refreshTokenExpiresIn: 7 * 24 * 60 * 60,
    hospitals: hospitalsResult.rows.map((hospital) => ({
      id: String(hospital.id),
      name: hospital.name,
      code: hospital.code,
    })),
    activeHospitalId: hospitalId,
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = String(req.body.refreshToken || "");

  if (refreshToken && /^[a-f0-9]{96}$/.test(refreshToken)) {
    await query(
      `UPDATE auth_sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(refreshToken)],
    );
  }

  res.json({
    success: true,
    message: "You have been signed out.",
  });
});

const me = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, first_name, last_name, phone, role,
            is_active, last_login_at, created_at
     FROM users
     WHERE id = $1 AND is_active = TRUE`,
    [req.user.id],
  );

  if (!result.rows[0]) {
    return res.status(401).json({
      success: false,
      message: "Account not found or inactive.",
    });
  }

  res.json({
    success: true,
    user: {
      ...result.rows[0],
      id: String(result.rows[0].id),
    },
    activeHospitalId: req.user.hospitalId,
  });
});

module.exports = { login, refresh, logout, me };

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

async function bootstrapAdmin() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();

  const password = String(process.env.SUPER_ADMIN_PASSWORD || "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set a valid SUPER_ADMIN_EMAIL in .env.");
  }

  if (password.length < 12 || password.length > 200) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD must be between 12 and 200 characters.",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingAdmin = await client.query(
      `SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`,
    );

    if (existingAdmin.rowCount > 0) {
      throw new Error(
        "A super administrator already exists. Bootstrap refused.",
      );
    }

    const existingUser = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [email],
    );

    if (existingUser.rowCount > 0) {
      throw new Error(
        "That email already belongs to a user. Bootstrap refused.",
      );
    }

    const hospitalResult = await client.query(
      `INSERT INTO hospitals (name, code, city, region)
       VALUES ('MedAxis General Hospital', 'MEDAXIS-001', 'Bishoftu', 'Oromia')
       ON CONFLICT (code) DO UPDATE
         SET name = hospitals.name
       RETURNING id`,
    );

    const hospitalId = hospitalResult.rows[0].id;
    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `INSERT INTO users (
         email, password_hash, first_name, last_name, role, is_active
       )
       VALUES ($1, $2, $3, $4, 'super_admin', TRUE)
       RETURNING id, email, role`,
      [email, passwordHash, "System", "Administrator"],
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO user_hospitals (user_id, hospital_id, is_default)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (user_id, hospital_id) DO NOTHING`,
      [user.id, hospitalId],
    );

    await client.query("COMMIT");

    console.log("Super administrator created.");
    console.log("User ID:", user.id);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Hospital ID:", hospitalId);
    console.log("Keep your credentials private.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrapAdmin().catch((error) => {
  console.error("Administrator bootstrap failed:", error.message);
  process.exitCode = 1;
});

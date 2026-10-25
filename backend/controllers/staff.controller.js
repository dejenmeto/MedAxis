const { pool, query } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );
  const search = String(req.query.search || "")
    .trim()
    .slice(0, 100);
  const offset = (page - 1) * limit;

  const values = [req.user.hospitalId];
  let filter = "sp.hospital_id = $1";

  if (search) {
    values.push(`%${search}%`);
    filter += ` AND (
      u.first_name ILIKE $2 OR
      u.last_name ILIKE $2 OR
      u.email ILIKE $2 OR
      sp.employee_id ILIKE $2 OR
      sp.specialization ILIKE $2
    )`;
  }

  const count = await query(
    `SELECT COUNT(*)::int AS total
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE ${filter}`,
    values,
  );

  const result = await query(
    `SELECT sp.id, sp.employee_id, sp.specialization,
            sp.qualification, sp.experience_years,
            sp.joining_date, sp.consultation_fee, sp.is_active,
            u.id AS user_id, u.first_name, u.last_name,
            u.email, u.phone, u.role,
            d.id AS department_id, d.name AS department_name
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     LEFT JOIN departments d ON d.id = sp.department_id
     WHERE ${filter}
     ORDER BY u.last_name, u.first_name
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  console.log(
    "Staff list diagnostic:",
    result.rows.map((person) => ({
      id: person.id,
      employee_id: person.employee_id,
      department_id: person.department_id,
      department_name: person.department_name,
      phone: person.phone,
    })),
  );
  res.json({
    success: true,
    data: result.rows,
    pagination: {
      total: count.rows[0].total,
      page,
      limit,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  });
});

const create = asyncHandler(async (req, res) => {
  const {
    user_id,
    employee_id,
    department_id,
    specialization,
    qualification,
    experience_years,
    consultation_fee,
    joining_date,
  } = req.body;

  if (!user_id || !employee_id?.trim()) {
    return res.status(422).json({
      success: false,
      message: "User ID and employee ID are required.",
    });
  }

  const userResult = await query(
    `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
    [user_id],
  );

  const user = userResult.rows[0];

  if (
    !user ||
    ![
      "doctor",
      "nurse",
      "lab_technician",
      "radiologist",
      "pharmacist",
      "receptionist",
      "accountant",
      "hospital_admin",
    ].includes(user.role)
  ) {
    return res.status(422).json({
      success: false,
      message: "Select a valid active staff user.",
    });
  }

  const result = await query(
    `INSERT INTO staff_profiles (
       user_id, hospital_id, department_id, employee_id,
       specialization, qualification, experience_years,
       consultation_fee, joining_date
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      user_id,
      req.user.hospitalId,
      department_id || null,
      employee_id.trim(),
      specialization || null,
      qualification || null,
      Math.max(0, Number(experience_years) || 0),
      consultation_fee === "" || consultation_fee == null
        ? null
        : Number(consultation_fee),
      joining_date || null,
    ],
  );

  res.status(201).json({
    success: true,
    data: result.rows[0],
  });
});

const update = asyncHandler(async (req, res) => {
  const {
    department_id,
    specialization,
    qualification,
    experience_years,
    consultation_fee,
    joining_date,
    is_active,
    phone,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find the staff profile within the logged-in user's hospital.
    const existing = await client.query(
      `SELECT id, user_id
       FROM staff_profiles
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.hospitalId],
    );

    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Staff profile not found.",
      });
    }

    // If a department is selected, verify it belongs to this hospital.
    if (department_id) {
      const department = await client.query(
        `SELECT id
         FROM departments
         WHERE id = $1
           AND hospital_id = $2
           AND is_active = TRUE`,
        [department_id, req.user.hospitalId],
      );

      if (!department.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(422).json({
          success: false,
          message: "Select a valid active department.",
        });
      }
    }

    const staff = existing.rows[0];

    // Update the staff profile, including its department.
    const result = await client.query(
      `UPDATE staff_profiles
       SET department_id = $1,
           specialization = $2,
           qualification = $3,
           experience_years = $4,
           consultation_fee = $5,
           joining_date = $6,
           is_active = $7,
           updated_at = NOW()
       WHERE id = $8 AND hospital_id = $9
       RETURNING *`,
      [
        department_id || null,
        specialization || null,
        qualification || null,
        Math.max(0, Number(experience_years) || 0),
        consultation_fee === "" || consultation_fee == null
          ? null
          : Number(consultation_fee),
        joining_date || null,
        typeof is_active === "boolean" ? is_active : true,
        req.params.id,
        req.user.hospitalId,
      ],
    );

    // Update the phone number on the linked user record.
    if (phone !== undefined) {
      await client.query(
        `UPDATE users
         SET phone = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [
          typeof phone === "string" && phone.trim() ? phone.trim() : null,
          staff.user_id,
        ],
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      data: result.rows[0],
      message: "Staff profile updated successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const remove = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE staff_profiles
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE
     RETURNING id`,
    [req.params.id, req.user.hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Active staff profile not found.",
    });
  }

  res.json({
    success: true,
    message: "Staff profile deactivated.",
  });
});

module.exports = { list, create, update, remove };

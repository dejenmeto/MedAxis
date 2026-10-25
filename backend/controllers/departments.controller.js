const { query } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const list = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.id, d.hospital_id, d.name, d.code, d.description,
            d.head_user_id, d.parent_department_id, d.is_active,
            d.created_at,
            COUNT(sp.id)::int AS staff_count
     FROM departments d
     LEFT JOIN staff_profiles sp
       ON sp.department_id = d.id AND sp.is_active = TRUE
     WHERE d.hospital_id = $1
     GROUP BY d.id
     ORDER BY d.name`,
    [req.user.hospitalId],
  );

  res.json({ success: true, data: result.rows });
});

const create = asyncHandler(async (req, res) => {
  const { name, code, description, parent_department_id } = req.body;

  if (!name?.trim() || !code?.trim()) {
    return res.status(422).json({
      success: false,
      message: "Department name and code are required.",
    });
  }

  const result = await query(
    `INSERT INTO departments (
       hospital_id, name, code, description, parent_department_id
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      req.user.hospitalId,
      name.trim(),
      code.trim().toUpperCase(),
      description || null,
      parent_department_id || null,
    ],
  );

  res.status(201).json({
    success: true,
    data: result.rows[0],
  });
});

const update = asyncHandler(async (req, res) => {
  const { name, code, description, parent_department_id, is_active } = req.body;

  const result = await query(
    `UPDATE departments
     SET name = COALESCE($1, name),
         code = COALESCE($2, code),
         description = COALESCE($3, description),
         parent_department_id = $4,
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
     WHERE id = $6 AND hospital_id = $7
     RETURNING *`,
    [
      name?.trim() || null,
      code?.trim().toUpperCase() || null,
      description === undefined ? null : description,
      parent_department_id || null,
      typeof is_active === "boolean" ? is_active : null,
      req.params.id,
      req.user.hospitalId,
    ],
  );

  if (!result.rows[0]) {
    return res.status(404).json({
      success: false,
      message: "Department not found.",
    });
  }

  res.json({ success: true, data: result.rows[0] });
});

const remove = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE departments
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND hospital_id = $2 AND is_active = TRUE
     RETURNING id`,
    [req.params.id, req.user.hospitalId],
  );

  if (!result.rowCount) {
    return res.status(404).json({
      success: false,
      message: "Active department not found.",
    });
  }

  res.json({
    success: true,
    message: "Department deactivated.",
  });
});

module.exports = { list, create, update, remove };

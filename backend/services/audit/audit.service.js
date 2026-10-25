const { query } = require("../../config/database");

async function recordAudit({
  userId,
  hospitalId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  req,
}) {
  await query(
    `INSERT INTO audit_logs (
       user_id, hospital_id, action, entity_type, entity_id,
       old_values, new_values, ip_address, user_agent
     )
     VALUES (
       $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9
     )`,
    [
      userId || null,
      hospitalId || null,
      action,
      entityType || null,
      entityId || null,
      oldValues == null ? null : JSON.stringify(oldValues),
      newValues == null ? null : JSON.stringify(newValues),
      req?.ip || null,
      req?.get("user-agent") || null,
    ],
  );
}

module.exports = { recordAudit };

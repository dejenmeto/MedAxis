const pool = require("../config/database");
const { sendEmail } = require("../services/email.service");
const { sendSms } = require("../services/sms.service");

const validChannels = ["email", "sms"];
const adminRoles = ["super_admin", "hospital_admin"];

function context(req) {
  return {
    userId: Number(req.user?.id),
    hospitalId: Number(req.user?.hospitalId),
    role: req.user?.role,
  };
}

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function requireHospital(req, res) {
  const { userId, hospitalId } = context(req);

  if (!validId(userId) || !validId(hospitalId)) {
    res.status(403).json({
      message: "A valid user and hospital context are required.",
    });
    return false;
  }

  return true;
}

exports.listTemplates = async (req, res) => {
  try {
    if (!requireHospital(req, res)) return;

    const { hospitalId } = context(req);
    const result = await pool.query(
      `SELECT id, template_key, channel, subject, body,
              is_active, created_at, updated_at
       FROM communication_templates
       WHERE hospital_id = $1
       ORDER BY channel, template_key`,
      [hospitalId],
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error("List communication templates failed:", error);
    res.status(500).json({ message: "Unable to load templates." });
  }
};

exports.saveTemplate = async (req, res) => {
  try {
    if (!requireHospital(req, res)) return;

    const { userId, hospitalId } = context(req);
    const { template_key, channel, subject, body, is_active = true } = req.body;

    if (
      !template_key?.trim() ||
      !validChannels.includes(channel) ||
      !body?.trim()
    ) {
      return res.status(400).json({
        message: "Template key, valid channel, and body are required.",
      });
    }

    if (channel === "email" && !subject?.trim()) {
      return res.status(400).json({
        message: "Email templates require a subject.",
      });
    }

    const result = await pool.query(
      `INSERT INTO communication_templates
       (hospital_id, template_key, channel, subject, body, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (hospital_id, template_key, channel)
       DO UPDATE SET
         subject = EXCLUDED.subject,
         body = EXCLUDED.body,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [
        hospitalId,
        template_key.trim(),
        channel,
        subject?.trim() || null,
        body.trim(),
        Boolean(is_active),
        userId,
      ],
    );

    res.status(200).json({
      message: "Template saved successfully.",
      template: result.rows[0],
    });
  } catch (error) {
    console.error("Save communication template failed:", error);
    res.status(500).json({ message: "Unable to save template." });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    if (!requireHospital(req, res)) return;

    const { hospitalId } = context(req);
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ message: "Invalid template ID." });
    }

    const result = await pool.query(
      `DELETE FROM communication_templates
       WHERE id = $1 AND hospital_id = $2
       RETURNING id`,
      [Number(id), hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Template not found." });
    }

    res.json({ message: "Template deleted." });
  } catch (error) {
    console.error("Delete communication template failed:", error);
    res.status(500).json({ message: "Unable to delete template." });
  }
};

async function deliver({ channel, recipient, subject, body }) {
  if (channel === "email") {
    const result = await sendEmail({ to: recipient, subject, body });
    return { messageId: result.messageId || null };
  }

  return sendSms({ to: recipient, message: body });
}

exports.sendMessage = async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { userId, hospitalId, role } = context(req);

  if (!adminRoles.includes(role)) {
    return res.status(403).json({
      message:
        "Only hospital administrators can send messages from this screen.",
    });
  }

  const { channel, recipient, subject, body } = req.body;

  if (
    !validChannels.includes(channel) ||
    typeof recipient !== "string" ||
    !recipient.trim() ||
    typeof body !== "string" ||
    !body.trim()
  ) {
    return res.status(400).json({
      message: "Channel, recipient, and message body are required.",
    });
  }

  if (channel === "email" && !subject?.trim()) {
    return res.status(400).json({
      message: "An email subject is required.",
    });
  }

  // Store the attempt before contacting the provider.
  let log;

  try {
    const result = await pool.query(
      `INSERT INTO communication_logs
       (hospital_id, channel, recipient, subject, body, status, attempts, sent_by)
       VALUES ($1, $2, $3, $4, $5, 'queued', 1, $6)
       RETURNING id`,
      [
        hospitalId,
        channel,
        recipient.trim(),
        subject?.trim() || null,
        body.trim(),
        userId,
      ],
    );

    log = result.rows[0];

    const delivery = await deliver({
      channel,
      recipient: recipient.trim(),
      subject: subject?.trim(),
      body: body.trim(),
    });

    await pool.query(
      `UPDATE communication_logs
       SET status = 'sent',
           provider_message_id = $1,
           sent_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND hospital_id = $3`,
      [delivery.messageId, log.id, hospitalId],
    );

    return res.status(200).json({
      message: "Message accepted by the configured provider.",
      logId: log.id,
    });
  } catch (error) {
    console.error("Communication delivery failed:", error.message);

    if (log) {
      try {
        await pool.query(
          `UPDATE communication_logs
           SET status = 'failed',
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2 AND hospital_id = $3`,
          [String(error.message).slice(0, 2000), log.id, hospitalId],
        );
      } catch (logError) {
        console.error("Unable to update communication log:", logError.message);
      }
    }

    return res.status(502).json({
      message:
        "Message delivery failed. Check the provider settings and delivery log.",
      logId: log?.id || null,
    });
  }
};

exports.listLogs = async (req, res) => {
  try {
    if (!requireHospital(req, res)) return;

    const { hospitalId } = context(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const status = req.query.status;

    const values = [hospitalId, limit];
    let statusCondition = "";

    if (["queued", "sent", "failed"].includes(status)) {
      values.push(status);
      statusCondition = `AND status = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT id, channel, recipient, subject, status,
              provider_message_id, error_message, attempts,
              sent_by, sent_at, created_at
       FROM communication_logs
       WHERE hospital_id = $1 ${statusCondition}
       ORDER BY created_at DESC
       LIMIT $2`,
      values,
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error("List communication logs failed:", error);
    res.status(500).json({ message: "Unable to load delivery logs." });
  }
};

exports.retryMessage = async (req, res) => {
  if (!requireHospital(req, res)) return;

  const { userId, hospitalId, role } = context(req);

  if (!adminRoles.includes(role)) {
    return res.status(403).json({ message: "Administrator access required." });
  }

  const { id } = req.params;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid message ID." });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM communication_logs
       WHERE id = $1 AND hospital_id = $2 AND status = 'failed'`,
      [Number(id), hospitalId],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Failed message not found.",
      });
    }

    const record = result.rows[0];

    await pool.query(
      `UPDATE communication_logs
       SET status = 'queued', attempts = attempts + 1,
           error_message = NULL, updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2`,
      [record.id, hospitalId],
    );

    try {
      const delivery = await deliver({
        channel: record.channel,
        recipient: record.recipient,
        subject: record.subject,
        body: record.body,
      });

      await pool.query(
        `UPDATE communication_logs
         SET status = 'sent', provider_message_id = $1,
             sent_at = NOW(), sent_by = $2, updated_at = NOW()
         WHERE id = $3 AND hospital_id = $4`,
        [delivery.messageId, userId, record.id, hospitalId],
      );

      return res.json({ message: "Message retry succeeded." });
    } catch (error) {
      await pool.query(
        `UPDATE communication_logs
         SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE id = $2 AND hospital_id = $3`,
        [String(error.message).slice(0, 2000), record.id, hospitalId],
      );

      return res
        .status(502)
        .json({ message: "Retry failed. Check provider settings." });
    }
  } catch (error) {
    console.error("Retry communication failed:", error);
    return res.status(500).json({ message: "Unable to retry message." });
  }
};

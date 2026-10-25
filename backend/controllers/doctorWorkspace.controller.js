const pool = require("../config/database");

const allowedRoles = ["super_admin", "hospital_admin", "doctor"];

function getContext(req) {
  return {
    userId: Number(req.user?.id),
    hospitalId: Number(req.user?.hospitalId),
    role: req.user?.role,
  };
}

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function canManageAll(role) {
  return role === "super_admin" || role === "hospital_admin";
}

exports.getWorkspace = async (req, res) => {
  try {
    const { userId, hospitalId, role } = getContext(req);

    if (!validId(userId) || !validId(hospitalId)) {
      return res.status(403).json({
        message: "A valid hospital and user account are required.",
      });
    }

    const doctorFilter = canManageAll(role) ? "" : "AND doctor_user_id = $2";
    const taskParams = canManageAll(role) ? [hospitalId] : [hospitalId, userId];

    const tasks = await pool.query(
      `SELECT t.id, t.patient_id, t.title, t.description,
              t.priority, t.status, t.due_at, t.completed_at,
              t.created_at, t.updated_at,
              p.first_name, p.last_name
       FROM doctor_workspace_tasks t
       LEFT JOIN patients p ON p.id = t.patient_id
       WHERE t.hospital_id = $1 ${doctorFilter}
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'normal' THEN 3
           ELSE 4
         END,
         t.due_at ASC NULLS LAST,
         t.created_at DESC
       LIMIT 200`,
      taskParams,
    );

    const notes = await pool.query(
      `SELECT n.id, n.patient_id, n.note_type, n.subject,
              n.body, n.is_signed, n.signed_at,
              n.created_at, n.updated_at,
              p.first_name, p.last_name
       FROM doctor_clinical_notes n
       LEFT JOIN patients p ON p.id = n.patient_id
       WHERE n.hospital_id = $1
         ${canManageAll(role) ? "" : "AND n.doctor_user_id = $2"}
       ORDER BY n.created_at DESC
       LIMIT 100`,
      taskParams,
    );

    const summary = {
      totalTasks: tasks.rows.length,
      pendingTasks: tasks.rows.filter((t) => t.status === "pending").length,
      inProgressTasks: tasks.rows.filter((t) => t.status === "in_progress")
        .length,
      completedTasks: tasks.rows.filter((t) => t.status === "completed").length,
      clinicalNotes: notes.rows.length,
    };

    return res.json({
      summary,
      tasks: tasks.rows,
      notes: notes.rows,
    });
  } catch (error) {
    console.error("Doctor workspace load failed:", error);
    return res.status(500).json({
      message: "Unable to load the doctor workspace.",
    });
  }
};

exports.createTask = async (req, res) => {
  try {
    const { userId, hospitalId, role } = getContext(req);
    const {
      doctor_user_id,
      patient_id,
      title,
      description,
      priority = "normal",
      due_at,
    } = req.body;

    if (!validId(hospitalId) || !validId(userId)) {
      return res
        .status(403)
        .json({ message: "Valid account context required." });
    }

    if (!title?.trim()) {
      return res.status(400).json({ message: "Task title is required." });
    }

    if (!["low", "normal", "high", "urgent"].includes(priority)) {
      return res.status(400).json({ message: "Invalid task priority." });
    }

    const assignedDoctor = canManageAll(role)
      ? Number(doctor_user_id || userId)
      : userId;

    if (!validId(assignedDoctor)) {
      return res
        .status(400)
        .json({ message: "A valid doctor account is required." });
    }

    const doctorCheck = await pool.query(
      `SELECT id
   FROM staff_profiles
   WHERE user_id = $1
     AND hospital_id = $2
   LIMIT 1`,
      [assignedDoctor, hospitalId],
    );

    if (!doctorCheck.rowCount) {
      return res.status(400).json({
        message: "The selected doctor does not belong to this hospital.",
      });
    }

    if (patient_id) {
      const patientCheck = await pool.query(
        `SELECT id FROM patients WHERE id = $1 AND hospital_id = $2`,
        [patient_id, hospitalId],
      );

      if (!patientCheck.rowCount) {
        return res.status(400).json({
          message: "The selected patient was not found in this hospital.",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO doctor_workspace_tasks
       (hospital_id, doctor_user_id, patient_id, title,
        description, priority, due_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        hospitalId,
        assignedDoctor,
        patient_id || null,
        title.trim(),
        description?.trim() || null,
        priority,
        due_at || null,
        userId,
      ],
    );

    return res.status(201).json({
      message: "Doctor task created successfully.",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Create doctor task failed:", error);
    return res.status(500).json({ message: "Unable to create task." });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { userId, hospitalId, role } = getContext(req);
    const { id } = req.params;
    const { status } = req.body;

    if (!validId(id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    if (
      !["pending", "in_progress", "completed", "cancelled"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid task status." });
    }

    const values = [status, hospitalId, Number(id)];
    let ownerCondition = "";

    if (!canManageAll(role)) {
      values.push(userId);
      ownerCondition = `AND doctor_user_id = $${values.length}`;
    }

    const result = await pool.query(
      `UPDATE doctor_workspace_tasks
       SET status = $1,
           completed_at = CASE
             WHEN $1 = 'completed' THEN NOW()
             ELSE NULL
           END,
           updated_at = NOW()
       WHERE hospital_id = $2 AND id = $3 ${ownerCondition}
       RETURNING *`,
      values,
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Task not found or you do not have permission to update it.",
      });
    }

    return res.json({
      message: "Task status updated.",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Update doctor task failed:", error);
    return res.status(500).json({ message: "Unable to update task." });
  }
};

exports.createClinicalNote = async (req, res) => {
  try {
    const { userId, hospitalId, role } = getContext(req);
    const { patient_id, note_type = "progress", subject, body } = req.body;

    if (!validId(userId) || !validId(hospitalId)) {
      return res
        .status(403)
        .json({ message: "Valid account context required." });
    }

    if (!validId(patient_id) || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({
        message: "Patient, subject, and note body are required.",
      });
    }

    if (
      !["progress", "consultation", "follow_up", "discharge", "other"].includes(
        note_type,
      )
    ) {
      return res.status(400).json({ message: "Invalid clinical note type." });
    }

    if (role !== "doctor") {
      return res.status(403).json({
        message: "Only a doctor can author clinical notes in this workspace.",
      });
    }

    const patient = await pool.query(
      `SELECT id FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patient_id, hospitalId],
    );

    if (!patient.rowCount) {
      return res
        .status(404)
        .json({ message: "Patient not found in this hospital." });
    }

    const result = await pool.query(
      `INSERT INTO doctor_clinical_notes
       (hospital_id, doctor_user_id, patient_id, note_type, subject, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [hospitalId, userId, patient_id, note_type, subject.trim(), body.trim()],
    );

    return res.status(201).json({
      message: "Clinical note saved as a draft.",
      note: result.rows[0],
    });
  } catch (error) {
    console.error("Create clinical note failed:", error);
    return res.status(500).json({ message: "Unable to save clinical note." });
  }
};

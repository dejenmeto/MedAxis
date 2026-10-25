const { query } = require("../config/database");
const { asyncHandler } = require("../utils/helpers");

const overview = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospitalId;

  const [patients, staff, appointments, departments, appointmentStatuses] =
    await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE is_active)::int AS active
       FROM patients WHERE hospital_id = $1`,
        [hospitalId],
      ),
      query(
        `SELECT COUNT(*)::int AS total
       FROM staff_profiles
       WHERE hospital_id = $1 AND is_active = TRUE`,
        [hospitalId],
      ),
      query(
        `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE appointment_date = CURRENT_DATE
                  AND status NOT IN ('cancelled', 'no_show')
              )::int AS today,
              COUNT(*) FILTER (
                WHERE status = 'completed'
                  AND appointment_date = CURRENT_DATE
              )::int AS completed_today
       FROM appointments WHERE hospital_id = $1`,
        [hospitalId],
      ),
      query(
        `SELECT COUNT(*)::int AS total
       FROM departments
       WHERE hospital_id = $1 AND is_active = TRUE`,
        [hospitalId],
      ),
      query(
        `SELECT status, COUNT(*)::int AS total
       FROM appointments
       WHERE hospital_id = $1
         AND appointment_date >= CURRENT_DATE - INTERVAL '6 days'
         AND appointment_date < CURRENT_DATE + INTERVAL '1 day'
       GROUP BY status ORDER BY status`,
        [hospitalId],
      ),
    ]);

  res.json({
    success: true,
    data: {
      patients: patients.rows[0],
      staff: staff.rows[0],
      appointments: appointments.rows[0],
      departments: departments.rows[0],
      appointmentStatuses: appointmentStatuses.rows,
    },
  });
});

const recentAppointments = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT a.id, a.appointment_number, a.appointment_date,
            a.start_time, a.status,
            p.mr_number, p.first_name AS patient_first_name,
            p.last_name AS patient_last_name,
            u.first_name AS doctor_first_name,
            u.last_name AS doctor_last_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN staff_profiles sp ON sp.id = a.doctor_id
     JOIN users u ON u.id = sp.user_id
     WHERE a.hospital_id = $1
     ORDER BY a.appointment_date DESC, a.start_time DESC
     LIMIT 10`,
    [req.user.hospitalId],
  );

  res.json({ success: true, data: result.rows });
});

module.exports = { overview, recentAppointments };

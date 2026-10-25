import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import appointmentsService from "../../services/appointments.service";
import "./Appointments.css";

const STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

const TYPES = ["physical", "video", "emergency"];

const EMPTY_FORM = {
  patient_id: "",
  doctor_id: "",
  appointment_date: "",
  start_time: "",
  end_time: "",
  appointment_type: "physical",
  reason: "",
  symptoms: "",
  notes: "",
};

function extractRows(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.appointments)) {
    return response.data.appointments;
  }
  if (Array.isArray(response?.appointments)) return response.appointments;
  return [];
}

function formatDate(value) {
  if (!value) return "—";
  const date = String(value).slice(0, 10);
  const parts = date.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "—";
}

function displayName(first, last, fallback) {
  return [first, last].filter(Boolean).join(" ") || fallback;
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    search: "",
    date: "",
    status: "",
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const loadAppointments = useCallback(
    async (requestedPage = 1) => {
      setLoading(true);

      try {
        const params = {
          page: requestedPage,
          limit: pagination.limit,
        };

        if (filters.search.trim()) params.search = filters.search.trim();
        if (filters.date) params.date = filters.date;
        if (filters.status) params.status = filters.status;

        const response = await appointmentsService.list(params);
        const rows = extractRows(response);
        const serverPagination =
          response?.pagination || response?.data?.pagination;

        setAppointments(rows);
        setPagination((current) => ({
          ...current,
          ...(serverPagination || {}),
          page: serverPagination?.page || requestedPage,
          limit: serverPagination?.limit || current.limit,
          total: serverPagination?.total ?? rows.length,
          totalPages: serverPagination?.totalPages ?? 1,
        }));
      } catch (error) {
        toast.error(errorMessage(error));
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit],
  );

  useEffect(() => {
    loadAppointments(1);
  }, [loadAppointments]);

  const stats = useMemo(
    () => ({
      total: pagination.total,
      scheduled: appointments.filter((item) => item.status === "scheduled")
        .length,
      confirmed: appointments.filter((item) => item.status === "confirmed")
        .length,
      completed: appointments.filter((item) => item.status === "completed")
        .length,
    }),
    [appointments, pagination.total],
  );

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({
      patient_id: String(item.patient_id ?? ""),
      doctor_id: String(item.doctor_id ?? ""),
      appointment_date: String(item.appointment_date ?? "").slice(0, 10),
      start_time: formatTime(item.start_time),
      end_time: formatTime(item.end_time),
      appointment_type: item.appointment_type || "physical",
      reason: item.reason || "",
      symptoms: item.symptoms || "",
      notes: item.notes || "",
    });
    setModalOpen(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.patient_id.trim() ||
      !form.doctor_id.trim() ||
      !form.appointment_date ||
      !form.start_time ||
      !form.end_time
    ) {
      toast.error("Complete all required appointment fields.");
      return;
    }

    if (form.end_time <= form.start_time) {
      toast.error("End time must be later than start time.");
      return;
    }

    const payload = {
      ...form,
      patient_id: form.patient_id.trim(),
      doctor_id: form.doctor_id.trim(),
    };

    setSaving(true);

    try {
      if (editingId) {
        await appointmentsService.update(editingId, payload);
        toast.success("Appointment updated.");
      } else {
        await appointmentsService.create(payload);
        toast.success("Appointment created.");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadAppointments(1);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(item, status) {
    if (status === item.status) return;

    setActionId(item.id);

    try {
      await appointmentsService.changeStatus(item.id, status);
      toast.success("Appointment status updated.");
      await loadAppointments(pagination.page);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;

    setActionId(cancelTarget.id);

    try {
      await appointmentsService.cancel(cancelTarget.id, cancelReason);
      toast.success("Appointment cancelled.");
      setCancelTarget(null);
      setCancelReason("");
      await loadAppointments(pagination.page);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setActionId(null);
    }
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setFilters({ search: "", date: "", status: "" });
  }

  return (
    <main className="appointments-page">
      <header className="appointments-header">
        <div>
          <p className="appointments-eyebrow">HOSPITAL OPERATIONS</p>
          <h1>Appointments</h1>
          <p className="appointments-subtitle">
            Schedule, review, and manage patient appointments.
          </p>
        </div>

        <button className="appointment-primary-button" onClick={openCreate}>
          <span aria-hidden="true">＋</span> New appointment
        </button>
      </header>

      <section className="appointment-stats" aria-label="Appointment summary">
        <article className="appointment-stat">
          <span className="appointment-stat-label">All matching records</span>
          <strong>{stats.total}</strong>
          <span className="appointment-stat-note">Across current filters</span>
        </article>
        <article className="appointment-stat">
          <span className="appointment-stat-label">Scheduled on this page</span>
          <strong>{stats.scheduled}</strong>
          <span className="appointment-stat-note">Awaiting confirmation</span>
        </article>
        <article className="appointment-stat">
          <span className="appointment-stat-label">Confirmed on this page</span>
          <strong>{stats.confirmed}</strong>
          <span className="appointment-stat-note">Ready for attendance</span>
        </article>
        <article className="appointment-stat">
          <span className="appointment-stat-label">Completed on this page</span>
          <strong>{stats.completed}</strong>
          <span className="appointment-stat-note">Finished visits</span>
        </article>
      </section>

      <section className="appointments-panel">
        <div className="appointments-panel-heading">
          <div>
            <h2>Appointment register</h2>
            <p>Search records and update their workflow status.</p>
          </div>
          <button
            type="button"
            className="appointment-secondary-button"
            onClick={() => loadAppointments(pagination.page)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="appointment-filters">
          <label className="appointment-search-field">
            <span>Search</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Patient, doctor, or appointment number"
            />
          </label>

          <label>
            <span>Appointment date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
            />
          </label>

          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option value={status} key={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="appointment-secondary-button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="appointments-table-wrap">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Appointment</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date &amp; time</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="appointments-table-message">
                    Loading appointments…
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="appointments-table-message">
                    No appointments found. Create an appointment or change your
                    filters.
                  </td>
                </tr>
              ) : (
                appointments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.appointment_number}</strong>
                      <span className="appointment-cell-subtext">
                        ID: {item.id}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {displayName(
                          item.patient_first_name,
                          item.patient_last_name,
                          `Patient ${item.patient_id}`,
                        )}
                      </strong>
                      <span className="appointment-cell-subtext">
                        {item.mr_number || `Patient ID: ${item.patient_id}`}
                      </span>
                    </td>
                    <td>
                      {displayName(
                        item.doctor_first_name,
                        item.doctor_last_name,
                        `Doctor ${item.doctor_id}`,
                      )}
                    </td>
                    <td>
                      <strong>{formatDate(item.appointment_date)}</strong>
                      <span className="appointment-cell-subtext">
                        {formatTime(item.start_time)}–
                        {formatTime(item.end_time)}
                      </span>
                    </td>
                    <td>
                      <span className="appointment-type">
                        {item.appointment_type}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`appointment-status status-${item.status}`}
                      >
                        {item.status?.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="appointment-row-actions">
                        <button
                          type="button"
                          className="appointment-action-button"
                          onClick={() => openEdit(item)}
                          disabled={actionId === item.id}
                        >
                          Edit
                        </button>

                        <select
                          aria-label={`Change status for ${item.appointment_number}`}
                          value={item.status}
                          disabled={actionId === item.id}
                          onChange={(event) =>
                            handleStatusChange(item, event.target.value)
                          }
                        >
                          {STATUSES.map((status) => (
                            <option value={status} key={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>

                        {["scheduled", "confirmed"].includes(item.status) && (
                          <button
                            type="button"
                            className="appointment-action-button danger"
                            disabled={actionId === item.id}
                            onClick={() => {
                              setCancelTarget(item);
                              setCancelReason("");
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="appointments-pagination">
          <span>
            {pagination.total} record(s) · Page {pagination.page} of{" "}
            {Math.max(1, pagination.totalPages)}
          </span>
          <div>
            <button
              type="button"
              className="appointment-secondary-button"
              disabled={loading || pagination.page <= 1}
              onClick={() => loadAppointments(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="appointment-secondary-button"
              disabled={
                loading || pagination.page >= Math.max(1, pagination.totalPages)
              }
              onClick={() => loadAppointments(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {modalOpen && (
        <div
          className="appointment-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setModalOpen(false);
            }
          }}
        >
          <section
            className="appointment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-form-title"
          >
            <header className="appointment-modal-header">
              <div>
                <p className="appointments-eyebrow">
                  {editingId ? "UPDATE RECORD" : "NEW RECORD"}
                </p>
                <h2 id="appointment-form-title">
                  {editingId ? "Edit appointment" : "Create appointment"}
                </h2>
              </div>
              <button
                type="button"
                className="appointment-modal-close"
                aria-label="Close form"
                onClick={() => !saving && setModalOpen(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              <div className="appointment-form-grid">
                <label>
                  <span>Patient ID *</span>
                  <input
                    name="patient_id"
                    type="number"
                    min="1"
                    required
                    value={form.patient_id}
                    onChange={updateField}
                    placeholder="Enter patient ID"
                  />
                </label>

                <label>
                  <span>Doctor / staff profile ID *</span>
                  <input
                    name="doctor_id"
                    type="number"
                    min="1"
                    required
                    value={form.doctor_id}
                    onChange={updateField}
                    placeholder="Enter staff profile ID"
                  />
                </label>

                <label>
                  <span>Date *</span>
                  <input
                    name="appointment_date"
                    type="date"
                    required
                    value={form.appointment_date}
                    onChange={updateField}
                  />
                </label>

                <label>
                  <span>Appointment type *</span>
                  <select
                    name="appointment_type"
                    value={form.appointment_type}
                    onChange={updateField}
                    required
                  >
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Start time *</span>
                  <input
                    name="start_time"
                    type="time"
                    required
                    value={form.start_time}
                    onChange={updateField}
                  />
                </label>

                <label>
                  <span>End time *</span>
                  <input
                    name="end_time"
                    type="time"
                    required
                    value={form.end_time}
                    onChange={updateField}
                  />
                </label>

                <label className="appointment-form-full">
                  <span>Reason for appointment</span>
                  <input
                    name="reason"
                    value={form.reason}
                    onChange={updateField}
                    maxLength={500}
                    placeholder="Reason for the visit"
                  />
                </label>

                <label className="appointment-form-full">
                  <span>Symptoms</span>
                  <textarea
                    name="symptoms"
                    value={form.symptoms}
                    onChange={updateField}
                    rows={2}
                    placeholder="Patient-reported symptoms"
                  />
                </label>

                <label className="appointment-form-full">
                  <span>Notes</span>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={updateField}
                    rows={2}
                    placeholder="Additional appointment notes"
                  />
                </label>
              </div>

              <footer className="appointment-form-actions">
                <button
                  type="button"
                  className="appointment-secondary-button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="appointment-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Save changes"
                      : "Create appointment"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {cancelTarget && (
        <div className="appointment-modal-backdrop">
          <section
            className="appointment-modal appointment-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-appointment-title"
          >
            <h2 id="cancel-appointment-title">Cancel appointment?</h2>
            <p>
              This will cancel{" "}
              <strong>{cancelTarget.appointment_number}</strong>.
            </p>
            <label>
              <span>Cancellation reason</span>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Enter the reason (optional)"
              />
            </label>
            <footer className="appointment-form-actions">
              <button
                type="button"
                className="appointment-secondary-button"
                disabled={actionId === cancelTarget.id}
                onClick={() => setCancelTarget(null)}
              >
                Keep appointment
              </button>
              <button
                type="button"
                className="appointment-danger-button"
                disabled={actionId === cancelTarget.id}
                onClick={handleCancel}
              >
                {actionId === cancelTarget.id
                  ? "Cancelling…"
                  : "Confirm cancellation"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

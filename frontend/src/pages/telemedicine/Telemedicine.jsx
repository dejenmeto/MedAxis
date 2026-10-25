import { useCallback, useEffect, useState } from "react";
import {
  FiVideo,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiSearch,
  FiPlus,
  FiRefreshCw,
  FiExternalLink,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import telemedicineService from "../../services/telemedicine.service";
import "./Telemedicine.css";

const emptyForm = {
  patient_id: "",
  doctor_staff_id: "",
  patient_name: "",
  doctor_name: "",
  consultation_mode: "video",
  scheduled_at: "",
  duration_minutes: 30,
  meeting_url: "",
};

const STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export default function Telemedicine() {
  const [dashboard, setDashboard] = useState({});
  const [consultations, setConsultations] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notesForm, setNotesForm] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [stats, result] = await Promise.all([
        telemedicineService.getDashboard(),
        telemedicineService.getConsultations({
          search,
          status: statusFilter,
          limit: 100,
        }),
      ]);

      setDashboard(stats || {});
      setConsultations(Array.isArray(result) ? result : result?.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openCreateForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (consultation) => {
    setEditing(consultation);
    setForm({
      ...emptyForm,
      consultation_mode: consultation.consultation_mode || "video",
      scheduled_at: consultation.scheduled_at
        ? new Date(consultation.scheduled_at).toISOString().slice(0, 16)
        : "",
      duration_minutes: consultation.duration_minutes || 30,
      meeting_url: consultation.meeting_url || "",
    });
    setShowForm(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editing) {
        await telemedicineService.updateConsultation(editing.id, {
          consultation_mode: form.consultation_mode,
          scheduled_at: form.scheduled_at,
          duration_minutes: Number(form.duration_minutes),
          meeting_url: form.meeting_url,
        });
        toast.success("Consultation updated.");
      } else {
        await telemedicineService.createConsultation({
          ...form,
          duration_minutes: Number(form.duration_minutes),
        });
        toast.success("Consultation scheduled.");
      }

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (consultation, status) => {
    try {
      await telemedicineService.updateStatus(consultation.id, status);
      toast.success("Consultation status updated.");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openNotes = (consultation) => {
    setNotesForm({
      ...consultation,
      consultation_notes: consultation.consultation_notes || "",
      follow_up_instructions: consultation.follow_up_instructions || "",
    });
  };

  const saveNotes = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await telemedicineService.updateConsultation(notesForm.id, {
        consultation_notes: notesForm.consultation_notes,
        follow_up_instructions: notesForm.follow_up_instructions,
      });
      toast.success("Consultation notes saved.");
      setNotesForm(null);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  return (
    <main className="telemedicine-page">
      <header className="telemedicine-header">
        <div>
          <span className="telemedicine-eyebrow">CLINICAL SERVICES</span>
          <h1>Telemedicine</h1>
          <p>Schedule and manage remote patient consultations.</p>
        </div>

        <div className="telemedicine-header-actions">
          <button
            type="button"
            className="tm-button tm-button-light"
            onClick={loadData}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className="tm-button tm-button-primary"
            onClick={openCreateForm}
          >
            <FiPlus /> Schedule consultation
          </button>
        </div>
      </header>

      <section className="tm-stat-grid">
        <StatCard
          icon={<FiVideo />}
          label="All consultations"
          value={dashboard.total ?? 0}
        />
        <StatCard
          icon={<FiCalendar />}
          label="Upcoming"
          value={dashboard.upcoming ?? 0}
        />
        <StatCard
          icon={<FiClock />}
          label="In progress"
          value={dashboard.in_progress ?? 0}
        />
        <StatCard
          icon={<FiCheckCircle />}
          label="Completed"
          value={dashboard.completed ?? 0}
        />
      </section>

      <section className="tm-panel">
        <div className="tm-panel-heading">
          <div>
            <h2>Consultations</h2>
            <p>Search, update, and manage scheduled consultations.</p>
          </div>
        </div>

        <div className="tm-filters">
          <label className="tm-search">
            <FiSearch />
            <input
              type="search"
              placeholder="Search code, patient, or doctor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            aria-label="Filter by consultation status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="tm-state">Loading consultations…</div>
        ) : consultations.length === 0 ? (
          <div className="tm-state">
            <FiVideo />
            <strong>No consultations found</strong>
            <span>Try changing the filters or schedule a consultation.</span>
          </div>
        ) : (
          <div className="tm-table-wrap">
            <table className="tm-table">
              <thead>
                <tr>
                  <th>Consultation</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date and time</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.consultation_code}</strong>
                      <small>{item.duration_minutes} minutes</small>
                    </td>
                    <td>
                      {item.patient_name || `Patient #${item.patient_id}`}
                    </td>
                    <td>
                      {item.doctor_name || `Staff #${item.doctor_staff_id}`}
                    </td>
                    <td>{formatDate(item.scheduled_at)}</td>
                    <td>
                      <span className="tm-mode">{item.consultation_mode}</span>
                    </td>
                    <td>
                      <span className={`tm-status tm-status-${item.status}`}>
                        {item.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="tm-row-actions">
                        <button
                          type="button"
                          onClick={() => openNotes(item)}
                          title="Consultation notes"
                        >
                          Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          disabled={["completed", "cancelled"].includes(
                            item.status,
                          )}
                          title="Edit consultation"
                        >
                          Edit
                        </button>
                        {item.meeting_url && (
                          <a
                            href={item.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open meeting link"
                          >
                            <FiExternalLink />
                          </a>
                        )}
                        <select
                          aria-label={`Change status for ${item.consultation_code}`}
                          value={item.status}
                          onChange={(event) =>
                            changeStatus(item, event.target.value)
                          }
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="tm-modal-backdrop">
          <section
            className="tm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tm-form-title"
          >
            <div className="tm-modal-heading">
              <div>
                <h2 id="tm-form-title">
                  {editing ? "Edit consultation" : "Schedule consultation"}
                </h2>
                <p>
                  {editing
                    ? "Update the schedule or meeting details."
                    : "Use existing patient and staff record IDs."}
                </p>
              </div>
              <button
                type="button"
                className="tm-close"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={submitForm}>
              {!editing && (
                <>
                  <div className="tm-form-grid">
                    <label>
                      Patient record ID *
                      <input
                        name="patient_id"
                        type="number"
                        min="1"
                        required
                        value={form.patient_id}
                        onChange={changeForm}
                      />
                    </label>
                    <label>
                      Doctor staff record ID *
                      <input
                        name="doctor_staff_id"
                        type="number"
                        min="1"
                        required
                        value={form.doctor_staff_id}
                        onChange={changeForm}
                      />
                    </label>
                    <label>
                      Patient display name
                      <input
                        name="patient_name"
                        value={form.patient_name}
                        onChange={changeForm}
                        maxLength={200}
                      />
                    </label>
                    <label>
                      Doctor display name
                      <input
                        name="doctor_name"
                        value={form.doctor_name}
                        onChange={changeForm}
                        maxLength={200}
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="tm-form-grid">
                <label>
                  Consultation mode *
                  <select
                    name="consultation_mode"
                    value={form.consultation_mode}
                    onChange={changeForm}
                    required
                  >
                    <option value="video">Video</option>
                    <option value="phone">Phone</option>
                  </select>
                </label>
                <label>
                  Scheduled date and time *
                  <input
                    name="scheduled_at"
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={changeForm}
                    required
                  />
                </label>
                <label>
                  Duration (minutes) *
                  <input
                    name="duration_minutes"
                    type="number"
                    min="5"
                    max="240"
                    value={form.duration_minutes}
                    onChange={changeForm}
                    required
                  />
                </label>
                <label className="tm-full-width">
                  Meeting URL
                  <input
                    name="meeting_url"
                    type="url"
                    placeholder="https://..."
                    value={form.meeting_url}
                    onChange={changeForm}
                  />
                </label>
              </div>

              <div className="tm-modal-actions">
                <button
                  type="button"
                  className="tm-button tm-button-light"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tm-button tm-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Schedule"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {notesForm && (
        <div className="tm-modal-backdrop">
          <section className="tm-modal" role="dialog" aria-modal="true">
            <div className="tm-modal-heading">
              <div>
                <h2>Consultation notes</h2>
                <p>{notesForm.consultation_code}</p>
              </div>
              <button
                type="button"
                className="tm-close"
                onClick={() => setNotesForm(null)}
                aria-label="Close notes"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={saveNotes}>
              <label className="tm-textarea-label">
                Consultation summary
                <textarea
                  rows={5}
                  value={notesForm.consultation_notes}
                  onChange={(event) =>
                    setNotesForm((current) => ({
                      ...current,
                      consultation_notes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="tm-textarea-label">
                Follow-up instructions
                <textarea
                  rows={4}
                  value={notesForm.follow_up_instructions}
                  onChange={(event) =>
                    setNotesForm((current) => ({
                      ...current,
                      follow_up_instructions: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="tm-modal-actions">
                <button
                  type="button"
                  className="tm-button tm-button-light"
                  onClick={() => setNotesForm(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tm-button tm-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save notes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <article className="tm-stat-card">
      <span className="tm-stat-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

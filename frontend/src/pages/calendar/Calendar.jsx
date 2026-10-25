import { useCallback, useEffect, useState } from "react";
import calendarService from "../../services/calendar.service";
import "./Calendar.css";

const initialForm = {
  title: "",
  description: "",
  event_type: "other",
  start_at: "",
  end_at: "",
  status: "scheduled",
  doctor_staff_id: "",
  patient_id: "",
  location: "",
};

const eventTypes = [
  "appointment",
  "meeting",
  "staff_shift",
  "procedure",
  "maintenance",
  "other",
];

function toLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getErrorMessage(error) {
  return (
    error.response?.data?.message || error.message || "Something went wrong."
  );
}

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await calendarService.getEvents({
        search,
        status,
        event_type: eventType,
        from: from ? `${from}T00:00:00` : "",
        to: to ? `${to}T23:59:59` : "",
        page: 1,
        limit: 100,
      });

      setEvents(result.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, status, eventType, from, to]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(initialForm);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(item) {
    setEditingId(item.id);

    setForm({
      title: item.title || "",
      description: item.description || "",
      event_type: item.event_type || "other",
      start_at: toLocalInput(item.start_at),
      end_at: toLocalInput(item.end_at),
      status: item.status || "scheduled",
      doctor_staff_id: item.doctor_staff_id || "",
      patient_id: item.patient_id || "",
      location: item.location || "",
    });

    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...form,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        doctor_staff_id: form.doctor_staff_id
          ? Number(form.doctor_staff_id)
          : null,
        patient_id: form.patient_id ? Number(form.patient_id) : null,
      };

      if (editingId) {
        await calendarService.updateEvent(editingId, payload);
        setMessage("Calendar event updated successfully.");
      } else {
        await calendarService.createEvent(payload);
        setMessage("Calendar event created successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(initialForm);

      await loadEvents();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(item) {
    const confirmed = window.confirm(`Cancel "${item.title}"?`);

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await calendarService.cancelEvent(item.id);
      setMessage("Calendar event cancelled successfully.");
      await loadEvents();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <div>
          <p className="calendar-eyebrow">SCHEDULING</p>
          <h1>Hospital Calendar</h1>
          <p className="calendar-subtitle">
            Manage hospital events and scheduled activities.
          </p>
        </div>

        <button
          type="button"
          className="calendar-primary-button"
          onClick={openCreateForm}
        >
          + Create event
        </button>
      </header>

      {error && <div className="calendar-alert error">{error}</div>}
      {message && <div className="calendar-alert success">{message}</div>}

      <section className="calendar-filters">
        <input
          aria-label="Search events"
          placeholder="Search title, description, or location"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filter by event type"
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
        >
          <option value="">All event types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </section>

      {showForm && (
        <section className="calendar-form-card">
          <h2>{editingId ? "Edit event" : "Create event"}</h2>

          <form onSubmit={handleSubmit}>
            <div className="calendar-form-grid">
              <label>
                Event title *
                <input
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  maxLength={200}
                  required
                />
              </label>

              <label>
                Event type
                <select
                  name="event_type"
                  value={form.event_type}
                  onChange={updateField}
                >
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Start date and time *
                <input
                  type="datetime-local"
                  name="start_at"
                  value={form.start_at}
                  onChange={updateField}
                  required
                />
              </label>

              <label>
                End date and time *
                <input
                  type="datetime-local"
                  name="end_at"
                  value={form.end_at}
                  onChange={updateField}
                  required
                />
              </label>

              <label>
                Doctor staff ID (optional)
                <input
                  type="number"
                  min="1"
                  name="doctor_staff_id"
                  value={form.doctor_staff_id}
                  onChange={updateField}
                />
              </label>

              <label>
                Patient ID (optional)
                <input
                  type="number"
                  min="1"
                  name="patient_id"
                  value={form.patient_id}
                  onChange={updateField}
                />
              </label>

              <label>
                Location
                <input
                  name="location"
                  value={form.location}
                  onChange={updateField}
                  maxLength={200}
                />
              </label>

              {editingId && (
                <label>
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={updateField}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              )}

              <label className="calendar-description-field">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  rows={3}
                />
              </label>
            </div>

            <div className="calendar-form-actions">
              <button
                type="button"
                className="calendar-secondary-button"
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                Close
              </button>

              <button
                type="submit"
                className="calendar-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create event"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="calendar-events-card">
        <div className="calendar-section-heading">
          <h2>Scheduled events</h2>
          <button
            type="button"
            className="calendar-secondary-button"
            onClick={loadEvents}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="calendar-empty">Loading calendar events...</p>
        ) : events.length === 0 ? (
          <p className="calendar-empty">No events match your filters.</p>
        ) : (
          <div className="calendar-table-wrap">
            <table className="calendar-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {events.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      {item.description && <small>{item.description}</small>}
                    </td>
                    <td>{item.event_type.replaceAll("_", " ")}</td>
                    <td>{new Date(item.start_at).toLocaleString()}</td>
                    <td>{new Date(item.end_at).toLocaleString()}</td>
                    <td>
                      <span className={`calendar-status ${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.location || "—"}</td>
                    <td>
                      <div className="calendar-row-actions">
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                        >
                          Edit
                        </button>
                        {item.status !== "cancelled" && (
                          <button
                            type="button"
                            className="calendar-cancel-action"
                            onClick={() => handleCancel(item)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

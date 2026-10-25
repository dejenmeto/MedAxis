import { useCallback, useEffect, useState } from "react";
import {
  FiCalendar,
  FiClock,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";

import slotAvailabilityService from "../../services/slotAvailability.service";
import "./SlotAvailability.css";

const initialForm = {
  doctor_staff_id: "",
  slot_date: "",
  start_time: "09:00",
  end_time: "09:30",
  status: "available",
  notes: "",
};

function getToday() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 10);
}

function displayTime(value) {
  if (!value) return "—";

  const [hours, minutes] = String(value).split(":");
  const hour = Number(hours);

  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function displayDate(value) {
  if (!value) return "—";

  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export default function SlotAvailability() {
  const [slots, setSlots] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState({
    date: getToday(),
    status: "",
    doctor_staff_id: "",
  });

  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSlots = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");

      try {
        const params = {
          page,
          limit: pagination.limit,
        };

        if (filters.date) params.date = filters.date;
        if (filters.status) params.status = filters.status;
        if (filters.doctor_staff_id) {
          params.doctor_staff_id = filters.doctor_staff_id;
        }

        const result = await slotAvailabilityService.getSlots(params);

        setSlots(Array.isArray(result.data) ? result.data : []);
        setPagination(
          result.pagination || {
            page,
            limit: 20,
            total: result.data?.length || 0,
            pages: 1,
          },
        );
      } catch (err) {
        setError(getErrorMessage(err));
        setSlots([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit],
  );

  useEffect(() => {
    loadSlots(1);
  }, [loadSlots]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateFilter(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      console.log("Creating appointment slot...");

      await slotAvailabilityService.createSlot({
        ...form,
        doctor_staff_id: Number(form.doctor_staff_id),
      });

      console.log("Slot created successfully.");

      setMessage("Appointment slot created successfully.");
      setShowForm(false);
      setForm(initialForm);

      console.log("Reloading appointment slots...");
      await loadSlots(1);
      console.log("Appointment slots reloaded.");
    } catch (err) {
      console.error("Slot creation failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleBook(slot) {
    const patientId = window.prompt(
      "Enter the patient's database ID to book this slot:",
    );

    if (!patientId) return;

    if (!/^\d+$/.test(patientId.trim())) {
      setError("Patient ID must be a numeric database ID.");
      return;
    }

    setActionId(slot.id);
    setError("");
    setMessage("");

    try {
      await slotAvailabilityService.bookSlot(slot.id, patientId.trim());
      setMessage("Slot booked successfully.");
      await loadSlots(pagination.page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel(slot) {
    const confirmed = window.confirm(
      "Cancel this appointment slot? It will no longer be bookable.",
    );

    if (!confirmed) return;

    setActionId(slot.id);
    setError("");
    setMessage("");

    try {
      await slotAvailabilityService.cancelSlot(slot.id);
      setMessage("Slot cancelled successfully.");
      await loadSlots(pagination.page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  function resetFilters() {
    setFilters({
      date: getToday(),
      status: "",
      doctor_staff_id: "",
    });
  }

  const availableCount = slots.filter(
    (slot) => slot.status === "available",
  ).length;

  const bookedCount = slots.filter((slot) => slot.status === "booked").length;

  const blockedCount = slots.filter((slot) => slot.status === "blocked").length;

  return (
    <main className="slot-page">
      <header className="slot-page__header">
        <div>
          <span className="slot-page__eyebrow">APPOINTMENT MANAGEMENT</span>
          <h1>Slot Availability</h1>
          <p>
            Manage doctors' appointment times and control booking availability.
          </p>
        </div>

        <div className="slot-page__header-actions">
          <button
            type="button"
            className="slot-button slot-button--secondary"
            onClick={() => loadSlots(pagination.page)}
            disabled={loading}
          >
            <FiRefreshCw />
            Refresh
          </button>

          <button
            type="button"
            className="slot-button slot-button--primary"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setMessage("");
            }}
          >
            {showForm ? <FiXCircle /> : <FiPlus />}
            {showForm ? "Close form" : "Create slot"}
          </button>
        </div>
      </header>

      {error && (
        <div className="slot-alert slot-alert--error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="slot-alert slot-alert--success" role="status">
          {message}
        </div>
      )}

      <section className="slot-stat-grid">
        <article className="slot-stat-card">
          <span className="slot-stat-card__icon slot-stat-card__icon--blue">
            <FiCalendar />
          </span>
          <div>
            <p>Matching slots</p>
            <strong>{pagination.total}</strong>
          </div>
        </article>

        <article className="slot-stat-card">
          <span className="slot-stat-card__icon slot-stat-card__icon--green">
            <FiClock />
          </span>
          <div>
            <p>Available on this page</p>
            <strong>{availableCount}</strong>
          </div>
        </article>

        <article className="slot-stat-card">
          <span className="slot-stat-card__icon slot-stat-card__icon--purple">
            <FiCalendar />
          </span>
          <div>
            <p>Booked on this page</p>
            <strong>{bookedCount}</strong>
          </div>
        </article>

        <article className="slot-stat-card">
          <span className="slot-stat-card__icon slot-stat-card__icon--orange">
            <FiClock />
          </span>
          <div>
            <p>Blocked on this page</p>
            <strong>{blockedCount}</strong>
          </div>
        </article>
      </section>

      {showForm && (
        <section className="slot-panel">
          <div className="slot-panel__heading">
            <div>
              <h2>Create appointment slot</h2>
              <p>Use the doctor's staff profile ID from your database.</p>
            </div>
          </div>

          <form className="slot-form" onSubmit={handleCreate}>
            <label>
              Doctor staff ID
              <input
                type="number"
                name="doctor_staff_id"
                min="1"
                value={form.doctor_staff_id}
                onChange={updateForm}
                required
              />
            </label>

            <label>
              Slot date
              <input
                type="date"
                name="slot_date"
                min={getToday()}
                value={form.slot_date}
                onChange={updateForm}
                required
              />
            </label>

            <label>
              Start time
              <input
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={updateForm}
                required
              />
            </label>

            <label>
              End time
              <input
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={updateForm}
                required
              />
            </label>

            <label>
              Initial status
              <select name="status" value={form.status} onChange={updateForm}>
                <option value="available">Available</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>

            <label className="slot-form__notes">
              Notes (optional)
              <textarea
                name="notes"
                value={form.notes}
                onChange={updateForm}
                rows="3"
                maxLength="1000"
                placeholder="Add scheduling notes..."
              />
            </label>

            <div className="slot-form__actions">
              <button
                type="button"
                className="slot-button slot-button--secondary"
                onClick={() => {
                  setShowForm(false);
                  setForm(initialForm);
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="slot-button slot-button--primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save slot"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="slot-panel">
        <div className="slot-panel__heading">
          <div>
            <h2>Appointment slots</h2>
            <p>Filter the schedule to find the slot you need.</p>
          </div>
        </div>

        <div className="slot-filters">
          <label>
            <span>Date</span>
            <input
              type="date"
              name="date"
              value={filters.date}
              onChange={updateFilter}
            />
          </label>

          <label>
            <span>Doctor staff ID</span>
            <input
              type="number"
              min="1"
              name="doctor_staff_id"
              value={filters.doctor_staff_id}
              onChange={updateFilter}
              placeholder="All doctors"
            />
          </label>

          <label>
            <span>Status</span>
            <select
              name="status"
              value={filters.status}
              onChange={updateFilter}
            >
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="blocked">Blocked</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <button
            type="button"
            className="slot-button slot-button--secondary slot-filter-button"
            onClick={() => loadSlots(1)}
            disabled={loading}
          >
            <FiSearch />
            Apply filters
          </button>

          <button
            type="button"
            className="slot-button slot-button--text"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>

        <div className="slot-table-wrap">
          <table className="slot-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Doctor</th>
                <th>Patient ID</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="slot-table__empty">
                    Loading appointment slots...
                  </td>
                </tr>
              ) : slots.length === 0 ? (
                <tr>
                  <td colSpan="7" className="slot-table__empty">
                    No appointment slots match your filters.
                  </td>
                </tr>
              ) : (
                slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{displayDate(slot.slot_date)}</td>

                    <td>
                      <span className="slot-time">
                        {displayTime(slot.start_time)}
                      </span>
                      <span className="slot-time__separator"> – </span>
                      <span className="slot-time">
                        {displayTime(slot.end_time)}
                      </span>
                    </td>

                    <td>
                      {slot.doctor_name || `Staff #${slot.doctor_staff_id}`}
                    </td>

                    <td>{slot.patient_id || "—"}</td>

                    <td>
                      <span
                        className={`slot-status slot-status--${slot.status}`}
                      >
                        {slot.status}
                      </span>
                    </td>

                    <td>{slot.notes || "—"}</td>

                    <td>
                      <div className="slot-row-actions">
                        {slot.status === "available" && (
                          <button
                            type="button"
                            className="slot-action-button slot-action-button--book"
                            onClick={() => handleBook(slot)}
                            disabled={actionId === slot.id}
                          >
                            Book
                          </button>
                        )}

                        {["available", "booked", "blocked"].includes(
                          slot.status,
                        ) && (
                          <button
                            type="button"
                            className="slot-action-button slot-action-button--cancel"
                            onClick={() => handleCancel(slot)}
                            disabled={actionId === slot.id}
                            title="Cancel slot"
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

        <footer className="slot-pagination">
          <span>
            Page {pagination.page} of {Math.max(1, pagination.pages)}
            {" · "}
            {pagination.total} total slots
          </span>

          <div>
            <button
              type="button"
              className="slot-button slot-button--secondary"
              disabled={loading || pagination.page <= 1}
              onClick={() => loadSlots(pagination.page - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="slot-button slot-button--secondary"
              disabled={
                loading || pagination.page >= Math.max(1, pagination.pages)
              }
              onClick={() => loadSlots(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

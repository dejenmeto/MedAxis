import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";

import queueService from "../../services/queue.service";
import "./Queue.css";

const EMPTY_FORM = {
  patientId: "",
  hospitalId: "",
  department: "",
  priority: "normal",
  assignedTo: "",
  notes: "",
};

const STATUS_LABELS = {
  waiting: "Waiting",
  called: "Called",
  in_service: "In service",
  completed: "Completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

const STATUSES = [
  "waiting",
  "called",
  "in_service",
  "completed",
  "skipped",
  "cancelled",
];

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function today() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function StatCard({ title, value, icon: Icon, description }) {
  return (
    <article className="queue-stat-card">
      <div className="queue-stat-icon">
        <Icon />
      </div>
      <div className="queue-stat-content">
        <span>{title}</span>
        <strong>{value ?? 0}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

export default function Queue() {
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // A super admin without a hospital assignment must select a hospital ID.
  // Hospital users use their assigned hospital automatically.
  const [globalHospitalId, setGlobalHospitalId] = useState("");

  const getHospitalParams = useCallback(() => {
    return globalHospitalId.trim()
      ? { hospitalId: globalHospitalId.trim() }
      : {};
  }, [globalHospitalId]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        ...getHospitalParams(),
        date,
        search: search.trim(),
        status: statusFilter,
        priority: priorityFilter,
        department: departmentFilter.trim(),
        page,
        limit: 10,
      };

      const [queueResponse, dashboardResponse] = await Promise.all([
        queueService.getAll(params),
        queueService.getDashboard({
          ...getHospitalParams(),
          date,
        }),
      ]);

      setEntries(queueResponse.data?.data || []);
      setPagination(
        queueResponse.data?.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      );
      setSummary(dashboardResponse.data?.data || {});
    } catch (error) {
      toast.error(getErrorMessage(error));
      setEntries([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [
    date,
    search,
    statusFilter,
    priorityFilter,
    departmentFilter,
    page,
    getHospitalParams,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateForm() {
    setEditingEntry(null);
    setForm({
      ...EMPTY_FORM,
      hospitalId: globalHospitalId,
    });
    setShowForm(true);
  }

  function openEditForm(entry) {
    setEditingEntry(entry);
    setForm({
      patientId: String(entry.patient_id),
      hospitalId: globalHospitalId,
      department: entry.department || "",
      priority: entry.priority || "normal",
      assignedTo: entry.assigned_to ? String(entry.assigned_to) : "",
      notes: entry.notes || "",
    });
    setShowForm(true);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.department.trim()) {
      toast.error("Enter a department or service point.");
      return;
    }

    if (!editingEntry && !form.patientId.trim()) {
      toast.error("Enter the existing patient ID.");
      return;
    }

    const payload = {
      department: form.department.trim(),
      priority: form.priority,
      assignedTo: form.assignedTo || null,
      notes: form.notes.trim(),
      ...(globalHospitalId.trim()
        ? { hospitalId: globalHospitalId.trim() }
        : {}),
    };

    if (!editingEntry) {
      payload.patientId = form.patientId.trim();
    }

    setSaving(true);

    try {
      if (editingEntry) {
        await queueService.update(
          editingEntry.id,
          payload,
          getHospitalParams(),
        );
        toast.success("Queue entry updated.");
      } else {
        await queueService.create(payload);
        toast.success("Patient added to the queue.");
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(entry, status) {
    try {
      await queueService.updateStatus(entry.id, status, getHospitalParams());
      toast.success(
        `Patient marked as ${STATUS_LABELS[status].toLowerCase()}.`,
      );
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function cancelEntry(entry) {
    const confirmed = window.confirm(`Cancel queue entry ${entry.queue_code}?`);

    if (!confirmed) return;

    try {
      await queueService.cancel(entry.id, getHospitalParams());
      toast.success("Queue entry cancelled.");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setDepartmentFilter("");
    setPage(1);
  }

  return (
    <main className="queue-page">
      <header className="queue-page-header">
        <div>
          <span className="queue-eyebrow">PATIENT SERVICES</span>
          <h1>Queue & Patient Flow</h1>
          <p>Manage waiting patients and track service progress.</p>
        </div>

        <div className="queue-header-actions">
          <button
            type="button"
            className="queue-button queue-button-secondary"
            onClick={loadData}
            disabled={loading}
          >
            <FiRefreshCw />
            Refresh
          </button>

          <button
            type="button"
            className="queue-button queue-button-primary"
            onClick={openCreateForm}
          >
            <FiPlus />
            Add to queue
          </button>
        </div>
      </header>

      <section className="queue-toolbar" aria-label="Queue settings">
        <label>
          Queue date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Hospital ID
          <input
            type="number"
            min="1"
            placeholder="Super admin only"
            value={globalHospitalId}
            onChange={(event) => {
              setGlobalHospitalId(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </section>

      <section className="queue-stats-grid">
        <StatCard
          title="Today's queue"
          value={summary.total}
          icon={FiUsers}
          description="Total registered entries"
        />
        <StatCard
          title="Waiting"
          value={summary.waiting}
          icon={FiClock}
          description="Awaiting service"
        />
        <StatCard
          title="In service"
          value={summary.in_service}
          icon={FiActivity}
          description="Currently being served"
        />
        <StatCard
          title="Completed"
          value={summary.completed}
          icon={FiCheckCircle}
          description="Service completed"
        />
        <StatCard
          title="Urgent cases"
          value={summary.urgent_active}
          icon={FiAlertCircle}
          description="Active urgent or high priority"
        />
      </section>

      <section className="queue-panel">
        <div className="queue-panel-heading">
          <div>
            <h2>Patient queue</h2>
            <p>
              {pagination.total} queue entries for {date || "all dates"}
            </p>
          </div>
        </div>

        <div className="queue-filters">
          <label className="queue-search">
            <FiSearch />
            <input
              type="search"
              placeholder="Search queue code, patient ID, department..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            <FiFilter />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label>
            <input
              type="text"
              placeholder="Department"
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <button
            type="button"
            className="queue-button queue-button-secondary"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>

        {loading ? (
          <div className="queue-state">
            <span className="queue-spinner" />
            <p>Loading patient queue...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="queue-state">
            <FiUsers />
            <h3>No queue entries found</h3>
            <p>Try changing your filters or add a patient to the queue.</p>
          </div>
        ) : (
          <>
            <div className="queue-table-wrapper">
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Queue number</th>
                    <th>Patient ID</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned staff</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <strong className="queue-code">
                          {entry.queue_code}
                        </strong>
                        <small>Number {entry.queue_number}</small>
                      </td>
                      <td>#{entry.patient_id}</td>
                      <td>{entry.department}</td>
                      <td>
                        <span
                          className={`queue-priority priority-${entry.priority}`}
                        >
                          {entry.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`queue-status status-${entry.status}`}>
                          {STATUS_LABELS[entry.status] || entry.status}
                        </span>
                      </td>
                      <td>{entry.assigned_to || "Unassigned"}</td>
                      <td>
                        <div className="queue-row-actions">
                          {entry.status !== "completed" &&
                            entry.status !== "cancelled" && (
                              <>
                                <button
                                  type="button"
                                  title="Edit queue entry"
                                  onClick={() => openEditForm(entry)}
                                >
                                  Edit
                                </button>

                                {entry.status === "waiting" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeStatus(entry, "called")
                                    }
                                  >
                                    Call
                                  </button>
                                )}

                                {entry.status === "called" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeStatus(entry, "in_service")
                                    }
                                  >
                                    Start
                                  </button>
                                )}

                                {entry.status === "in_service" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeStatus(entry, "completed")
                                    }
                                  >
                                    Complete
                                  </button>
                                )}

                                {["waiting", "called"].includes(
                                  entry.status,
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeStatus(entry, "skipped")
                                    }
                                  >
                                    Skip
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="queue-cancel-action"
                                  title="Cancel queue entry"
                                  onClick={() => cancelEntry(entry)}
                                >
                                  <FiX />
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="queue-pagination">
              <span>
                Page {pagination.page} of {Math.max(1, pagination.totalPages)}
              </span>
              <div>
                <button
                  type="button"
                  className="queue-button queue-button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="queue-button queue-button-secondary"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next <FiArrowRight />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {showForm && (
        <div
          className="queue-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowForm(false);
          }}
        >
          <section
            className="queue-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-form-title"
          >
            <header>
              <div>
                <h2 id="queue-form-title">
                  {editingEntry ? "Edit queue entry" : "Add patient to queue"}
                </h2>
                <p>
                  {editingEntry
                    ? "Update service and assignment details."
                    : "Use the ID of a patient already registered in MedAxis."}
                </p>
              </div>
              <button
                type="button"
                className="queue-modal-close"
                aria-label="Close form"
                onClick={() => setShowForm(false)}
              >
                <FiX />
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              {!editingEntry && (
                <label>
                  Existing patient ID *
                  <input
                    name="patientId"
                    type="number"
                    min="1"
                    required
                    value={form.patientId}
                    onChange={handleInputChange}
                    placeholder="Enter patient database ID"
                  />
                </label>
              )}

              <label>
                Department / service point *
                <input
                  name="department"
                  type="text"
                  maxLength="120"
                  required
                  value={form.department}
                  onChange={handleInputChange}
                  placeholder="e.g. Outpatient, Laboratory"
                />
              </label>

              <label>
                Priority
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleInputChange}
                >
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <label>
                Assigned staff user ID (optional)
                <input
                  name="assignedTo"
                  type="number"
                  min="1"
                  value={form.assignedTo}
                  onChange={handleInputChange}
                  placeholder="Enter staff account ID"
                />
              </label>

              <label>
                Notes (optional)
                <textarea
                  name="notes"
                  rows="3"
                  maxLength="2000"
                  value={form.notes}
                  onChange={handleInputChange}
                  placeholder="Additional queue notes"
                />
              </label>

              <footer>
                <button
                  type="button"
                  className="queue-button queue-button-secondary"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="queue-button queue-button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingEntry
                      ? "Save changes"
                      : "Add to queue"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

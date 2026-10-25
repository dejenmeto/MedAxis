import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClipboard,
  FiEdit2,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import auditComplianceService from "../../services/auditCompliance.service";
import "./AuditCompliance.css";

const emptyForm = {
  title: "",
  category: "",
  description: "",
  status: "pending",
  priority: "medium",
  due_date: "",
  assigned_to: "",
  notes: "",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const displayValue = (value) => {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function AuditCompliance() {
  const [tab, setTab] = useState("checks");
  const [summary, setSummary] = useState(null);
  const [checks, setChecks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadSummary = useCallback(async () => {
    try {
      const response = await auditComplianceService.getSummary();
      setSummary(response.data?.data || null);
    } catch {
      toast.error("Could not load Audit & Compliance summary.");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page,
        limit: 10,
        ...(search.trim() ? { search: search.trim() } : {}),
      };

      if (tab === "checks") {
        if (status) params.status = status;
        if (priority) params.priority = priority;

        const response = await auditComplianceService.getChecks(params);

        setChecks(response.data?.data || []);
        setPagination(
          response.data?.pagination || {
            page: 1,
            total: 0,
            totalPages: 1,
            limit: 10,
          },
        );
      } else {
        const response = await auditComplianceService.getLogs(params);

        setLogs(response.data?.data || []);
        setPagination(
          response.data?.pagination || {
            page: 1,
            total: 0,
            totalPages: 1,
            limit: 10,
          },
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Could not load Audit & Compliance records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority, tab]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      category: item.category || "",
      description: item.description || "",
      status: item.status || "pending",
      priority: item.priority || "medium",
      due_date: item.due_date ? String(item.due_date).slice(0, 10) : "",
      assigned_to: item.assigned_to ?? "",
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.category.trim()) {
      toast.error("Title and category are required.");
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      category: form.category.trim(),
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
    };

    setSaving(true);

    try {
      if (editingId) {
        await auditComplianceService.updateCheck(editingId, payload);
        toast.success("Compliance check updated.");
      } else {
        await auditComplianceService.createCheck(payload);
        toast.success("Compliance check created.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await Promise.all([loadData(), loadSummary()]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save the compliance check.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete the compliance check "${item.title}"?`)) {
      return;
    }

    try {
      await auditComplianceService.deleteCheck(item.id);
      toast.success("Compliance check deleted.");
      await Promise.all([loadData(), loadSummary()]);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Could not delete the compliance check.",
      );
    }
  };

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setPage(1);
    setSearch("");
    setStatus("");
    setPriority("");
  };

  const totalPages = Math.max(1, pagination.totalPages || 1);

  return (
    <main className="ac-page">
      <header className="ac-header">
        <div>
          <span className="ac-eyebrow">GOVERNANCE & OVERSIGHT</span>
          <h1>Audit & Compliance</h1>
          <p>
            Review system activity and manage hospital compliance requirements.
          </p>
        </div>

        <button
          type="button"
          className="ac-button ac-button-primary"
          onClick={openCreate}
          disabled={tab !== "checks"}
        >
          <FiPlus /> New compliance check
        </button>
      </header>

      <section className="ac-stats">
        <article className="ac-stat-card">
          <span className="ac-stat-icon">
            <FiClipboard />
          </span>
          <div>
            <span>Total checks</span>
            <strong>{summary?.compliance?.total ?? "—"}</strong>
          </div>
        </article>

        <article className="ac-stat-card">
          <span className="ac-stat-icon ac-icon-warning">
            <FiAlertTriangle />
          </span>
          <div>
            <span>Pending</span>
            <strong>{summary?.compliance?.pending ?? "—"}</strong>
          </div>
        </article>

        <article className="ac-stat-card">
          <span className="ac-stat-icon ac-icon-success">
            <FiCheckCircle />
          </span>
          <div>
            <span>Completed</span>
            <strong>{summary?.compliance?.completed ?? "—"}</strong>
          </div>
        </article>

        <article className="ac-stat-card">
          <span className="ac-stat-icon ac-icon-danger">
            <FiActivity />
          </span>
          <div>
            <span>Overdue</span>
            <strong>{summary?.compliance?.overdue ?? "—"}</strong>
          </div>
        </article>

        <article className="ac-stat-card">
          <span className="ac-stat-icon">
            <FiFileText />
          </span>
          <div>
            <span>Audit events</span>
            <strong>{summary?.auditEvents ?? "—"}</strong>
          </div>
        </article>
      </section>

      <section className="ac-panel">
        <div className="ac-toolbar">
          <div className="ac-tabs">
            <button
              type="button"
              className={tab === "checks" ? "active" : ""}
              onClick={() => changeTab("checks")}
            >
              Compliance checks
            </button>
            <button
              type="button"
              className={tab === "logs" ? "active" : ""}
              onClick={() => changeTab("logs")}
            >
              Audit history
            </button>
          </div>

          <button
            type="button"
            className="ac-button ac-button-light"
            onClick={() => {
              loadData();
              loadSummary();
            }}
            title="Refresh records"
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="ac-filters">
          <label className="ac-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={
                tab === "checks"
                  ? "Search title, category, description..."
                  : "Search action, entity, user ID..."
              }
            />
          </label>

          {tab === "checks" && (
            <>
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>

              <select
                aria-label="Filter by priority"
                value={priority}
                onChange={(event) => {
                  setPriority(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </>
          )}
        </div>

        {loading ? (
          <div className="ac-state">Loading records...</div>
        ) : tab === "checks" ? (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Compliance requirement</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due date</th>
                  <th>Assigned user ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.category}</small>
                      {item.description && (
                        <p className="ac-description">{item.description}</p>
                      )}
                    </td>
                    <td>
                      <span className={`ac-badge priority-${item.priority}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`ac-badge status-${item.status}`}>
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>{item.assigned_to ?? "Unassigned"}</td>
                    <td>
                      <div className="ac-actions">
                        <button
                          type="button"
                          title="Edit check"
                          onClick={() => openEdit(item)}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          className="danger"
                          title="Delete check"
                          onClick={() => handleDelete(item)}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!checks.length && (
                  <tr>
                    <td colSpan="6" className="ac-empty">
                      No compliance checks found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User ID</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>IP address</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.user_id ?? "System"}</td>
                    <td>
                      <strong>{log.action}</strong>
                    </td>
                    <td>{log.entity_type || "—"}</td>
                    <td>{log.entity_id ?? "—"}</td>
                    <td>{log.ip_address || "—"}</td>
                    <td>
                      <details className="ac-log-details">
                        <summary>View</summary>
                        <div>
                          <strong>Previous values</strong>
                          <pre>{displayValue(log.old_values)}</pre>
                          <strong>New values</strong>
                          <pre>{displayValue(log.new_values)}</pre>
                          <strong>User agent</strong>
                          <p>{log.user_agent || "—"}</p>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}

                {!logs.length && (
                  <tr>
                    <td colSpan="7" className="ac-empty">
                      No audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="ac-pagination">
          <span>{pagination.total ?? 0} record(s)</span>
          <div>
            <button
              type="button"
              className="ac-button ac-button-light"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="ac-button ac-button-light"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {showForm && (
        <div
          className="ac-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <section
            className="ac-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ac-form-title"
          >
            <header>
              <div>
                <h2 id="ac-form-title">
                  {editingId ? "Edit compliance check" : "New compliance check"}
                </h2>
                <p>Record a compliance requirement and its deadline.</p>
              </div>
              <button
                type="button"
                className="ac-close"
                aria-label="Close form"
                onClick={() => setShowForm(false)}
              >
                <FiX />
              </button>
            </header>

            <form onSubmit={handleSave}>
              <label>
                Title *
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>

              <label>
                Category *
                <input
                  required
                  maxLength={100}
                  placeholder="e.g. Patient privacy"
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                />
              </label>

              <label>
                Description
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>

              <div className="ac-form-grid">
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value })
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                    <option value="waived">Waived</option>
                  </select>
                </label>

                <label>
                  Priority
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({ ...form, priority: event.target.value })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>

                <label>
                  Due date
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(event) =>
                      setForm({ ...form, due_date: event.target.value })
                    }
                  />
                </label>

                <label>
                  Assigned user ID
                  <input
                    type="number"
                    min="1"
                    value={form.assigned_to}
                    onChange={(event) =>
                      setForm({ ...form, assigned_to: event.target.value })
                    }
                    placeholder="Optional user ID"
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                />
              </label>

              <footer>
                <button
                  type="button"
                  className="ac-button ac-button-light"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ac-button ac-button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create check"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

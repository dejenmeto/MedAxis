import { useCallback, useEffect, useState } from "react";
import {
  FiShield,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiEdit2,
  FiClipboard,
  FiX,
} from "react-icons/fi";

import service from "../../services/infectionControl.service";
import "./InfectionControl.css";

const emptyCase = {
  case_number: "",
  patient_id: "",
  infection_type: "",
  suspected_source: "",
  department: "",
  detected_at: "",
  severity: "moderate",
  isolation_required: false,
  isolation_precautions: "",
  status: "reported",
  outcome_notes: "",
};

const emptyAction = {
  case_id: "",
  action_title: "",
  action_description: "",
  due_date: "",
};

const caseStatuses = [
  "reported",
  "under_review",
  "confirmed",
  "monitoring",
  "resolved",
  "closed",
];
const severities = ["low", "moderate", "high", "critical"];
const actionStatuses = ["pending", "in_progress", "completed", "cancelled"];

const readable = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const dateValue = (value) => (value ? String(value).slice(0, 10) : "");

export default function InfectionControl() {
  const [cases, setCases] = useState([]);
  const [actions, setActions] = useState([]);
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [actionForm, setActionForm] = useState(emptyAction);
  const [editingId, setEditingId] = useState(null);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [caseResult, actionResult] = await Promise.all([
        service.getCases({
          page,
          limit: 10,
          search: search.trim(),
          status,
          severity,
        }),
        service.getActions({ status: actionStatus }),
      ]);

      setCases(caseResult.data || []);
      setPagination(
        caseResult.pagination || {
          page: 1,
          total: 0,
          totalPages: 1,
        },
      );
      setActions(actionResult.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load infection-control records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, status, severity, actionStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateCaseField = (event) => {
    const { name, value, type, checked } = event.target;
    setCaseForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const updateActionField = (event) => {
    const { name, value } = event.target;
    setActionForm((current) => ({ ...current, [name]: value }));
  };

  const closeCaseForm = () => {
    setCaseForm(emptyCase);
    setEditingId(null);
    setShowCaseForm(false);
  };

  const editCase = (item) => {
    setCaseForm({
      ...emptyCase,
      ...item,
      patient_id: item.patient_id || "",
      detected_at: item.detected_at
        ? new Date(item.detected_at).toISOString().slice(0, 16)
        : "",
      isolation_required: Boolean(item.isolation_required),
    });
    setEditingId(item.id);
    setShowCaseForm(true);
    setError("");
    setNotice("");
  };

  const saveCase = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...caseForm,
        patient_id: caseForm.patient_id || null,
        detected_at: caseForm.detected_at || null,
      };

      if (editingId) {
        await service.updateCase(editingId, payload);
        setNotice("Infection-control case updated.");
      } else {
        await service.createCase(payload);
        setNotice("Infection-control case recorded.");
      }

      closeCaseForm();
      setPage(1);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save the infection-control case.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveAction = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await service.createAction({
        ...actionForm,
        case_id: Number(actionForm.case_id),
      });

      setActionForm(emptyAction);
      setShowActionForm(false);
      setNotice("Preventive action recorded.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save the preventive action.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeActionStatus = async (action, nextStatus) => {
    setError("");
    setNotice("");

    try {
      await service.updateAction(action.id, { status: nextStatus });
      setNotice("Preventive action status updated.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update the preventive action.",
      );
    }
  };

  const criticalCases = cases.filter(
    (item) => item.severity === "critical",
  ).length;

  const isolationCases = cases.filter((item) => item.isolation_required).length;

  const openActions = actions.filter((item) =>
    ["pending", "in_progress"].includes(item.status),
  ).length;

  return (
    <main className="infection-page">
      <header className="infection-header">
        <div>
          <p className="infection-eyebrow">PATIENT SAFETY</p>
          <h1>
            <FiShield /> Infection Prevention & Control
          </h1>
          <p className="infection-subtitle">
            Record cases, track precautions, and follow preventive actions.
          </p>
        </div>

        <button
          className="infection-button infection-button-primary"
          onClick={() => {
            closeCaseForm();
            setShowCaseForm(true);
          }}
        >
          <FiPlus /> Record Case
        </button>
      </header>

      {error && (
        <div className="infection-alert infection-alert-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="infection-alert infection-alert-success" role="status">
          {notice}
        </div>
      )}

      <section className="infection-stats">
        <article>
          <span>Cases on current page</span>
          <strong>{cases.length}</strong>
        </article>
        <article>
          <span>Critical cases on current page</span>
          <strong>{criticalCases}</strong>
        </article>
        <article>
          <span>Cases requiring isolation on current page</span>
          <strong>{isolationCases}</strong>
        </article>
        <article>
          <span>Open preventive actions loaded</span>
          <strong>{openActions}</strong>
        </article>
      </section>

      {showCaseForm && (
        <section className="infection-panel">
          <div className="infection-panel-heading">
            <h2>{editingId ? "Edit Case" : "Record Infection-Control Case"}</h2>
            <button
              className="infection-icon-button"
              type="button"
              onClick={closeCaseForm}
              aria-label="Close case form"
            >
              <FiX />
            </button>
          </div>

          <form className="infection-form" onSubmit={saveCase}>
            <label>
              Case number *
              <input
                name="case_number"
                value={caseForm.case_number}
                onChange={updateCaseField}
                required
                maxLength={60}
              />
            </label>

            <label>
              Infection type *
              <input
                name="infection_type"
                value={caseForm.infection_type}
                onChange={updateCaseField}
                placeholder="Use approved clinical terminology"
                required
              />
            </label>

            <label>
              Patient ID (optional)
              <input
                type="number"
                min="1"
                name="patient_id"
                value={caseForm.patient_id}
                onChange={updateCaseField}
                placeholder="Existing patient database ID"
              />
            </label>

            <label>
              Department
              <input
                name="department"
                value={caseForm.department}
                onChange={updateCaseField}
                placeholder="e.g. ICU, Surgery"
              />
            </label>

            <label>
              Suspected source
              <input
                name="suspected_source"
                value={caseForm.suspected_source}
                onChange={updateCaseField}
              />
            </label>

            <label>
              Detection date and time
              <input
                type="datetime-local"
                name="detected_at"
                value={caseForm.detected_at}
                onChange={updateCaseField}
              />
            </label>

            <label>
              Severity
              <select
                name="severity"
                value={caseForm.severity}
                onChange={updateCaseField}
              >
                {severities.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Case status
              <select
                name="status"
                value={caseForm.status}
                onChange={updateCaseField}
              >
                {caseStatuses.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="infection-checkbox">
              <input
                type="checkbox"
                name="isolation_required"
                checked={caseForm.isolation_required}
                onChange={updateCaseField}
              />
              Isolation precautions required
            </label>

            <label className="infection-form-wide">
              Isolation precautions
              <textarea
                name="isolation_precautions"
                value={caseForm.isolation_precautions || ""}
                onChange={updateCaseField}
                rows={2}
              />
            </label>

            <label className="infection-form-wide">
              Outcome / investigation notes
              <textarea
                name="outcome_notes"
                value={caseForm.outcome_notes || ""}
                onChange={updateCaseField}
                rows={3}
              />
            </label>

            <div className="infection-form-actions infection-form-wide">
              <button
                type="button"
                className="infection-button"
                onClick={closeCaseForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="infection-button infection-button-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Record Case"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="infection-panel">
        <div className="infection-panel-heading">
          <div>
            <h2>Infection-Control Cases</h2>
            <p>Review and update recorded cases.</p>
          </div>
          <button
            className="infection-button"
            onClick={loadData}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="infection-filters">
          <label className="infection-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search case, infection, source, department..."
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter cases by status"
          >
            <option value="">All case statuses</option>
            {caseStatuses.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>

          <select
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              setPage(1);
            }}
            aria-label="Filter cases by severity"
          >
            <option value="">All severities</option>
            {severities.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="infection-empty">
            Loading infection-control records...
          </p>
        ) : cases.length === 0 ? (
          <p className="infection-empty">No matching cases found.</p>
        ) : (
          <div className="infection-table-wrap">
            <table className="infection-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Infection</th>
                  <th>Department</th>
                  <th>Detected</th>
                  <th>Severity</th>
                  <th>Isolation</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.case_number}</strong>
                      <small>
                        {item.patient_first_name || item.patient_last_name
                          ? `${item.patient_first_name || ""} ${item.patient_last_name || ""}`.trim()
                          : item.patient_id
                            ? `Patient ID: ${item.patient_id}`
                            : "No patient linked"}
                      </small>
                    </td>
                    <td>{item.infection_type}</td>
                    <td>{item.department || "—"}</td>
                    <td>
                      {item.detected_at
                        ? new Date(item.detected_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={`infection-pill severity-${item.severity}`}
                      >
                        {readable(item.severity)}
                      </span>
                    </td>
                    <td>{item.isolation_required ? "Required" : "No"}</td>
                    <td>
                      <span className="infection-pill">
                        {readable(item.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="infection-icon-button"
                        onClick={() => editCase(item)}
                        title="Edit case"
                        aria-label={`Edit case ${item.case_number}`}
                      >
                        <FiEdit2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="infection-pagination">
          <span>
            {pagination.total} case(s) · Page {pagination.page || page} of{" "}
            {Math.max(1, pagination.totalPages || 1)}
          </span>
          <div>
            <button
              className="infection-button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              className="infection-button"
              disabled={loading || page >= (pagination.totalPages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="infection-panel">
        <div className="infection-panel-heading">
          <div>
            <h2>
              <FiClipboard /> Preventive Actions
            </h2>
            <p>Record and track infection-prevention follow-up tasks.</p>
          </div>
          <button
            className="infection-button infection-button-primary"
            onClick={() => {
              setActionForm(emptyAction);
              setShowActionForm((current) => !current);
            }}
          >
            <FiPlus /> New Action
          </button>
        </div>

        {showActionForm && (
          <form className="infection-form" onSubmit={saveAction}>
            <label>
              Related case *
              <select
                name="case_id"
                value={actionForm.case_id}
                onChange={updateActionField}
                required
              >
                <option value="">Select case</option>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.case_number} — {item.infection_type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Action title *
              <input
                name="action_title"
                value={actionForm.action_title}
                onChange={updateActionField}
                required
              />
            </label>

            <label>
              Due date
              <input
                type="date"
                name="due_date"
                value={actionForm.due_date}
                onChange={updateActionField}
              />
            </label>

            <label className="infection-form-wide">
              Description
              <textarea
                name="action_description"
                value={actionForm.action_description}
                onChange={updateActionField}
                rows={3}
              />
            </label>

            <div className="infection-form-actions infection-form-wide">
              <button
                type="button"
                className="infection-button"
                onClick={() => setShowActionForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="infection-button infection-button-primary"
                disabled={saving || cases.length === 0}
              >
                {saving ? "Saving..." : "Create Action"}
              </button>
            </div>
          </form>
        )}

        <div className="infection-filters">
          <label>
            Filter actions
            <select
              value={actionStatus}
              onChange={(event) => setActionStatus(event.target.value)}
            >
              <option value="">All action statuses</option>
              {actionStatuses.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {actions.length === 0 ? (
          <p className="infection-empty">No preventive actions found.</p>
        ) : (
          <div className="infection-table-wrap">
            <table className="infection-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Action</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.case_number}</strong>
                      <small>{item.infection_type}</small>
                    </td>
                    <td>
                      {item.action_title}
                      {item.action_description && (
                        <small>{item.action_description}</small>
                      )}
                    </td>
                    <td>{dateValue(item.due_date) || "—"}</td>
                    <td>
                      <select
                        value={item.status}
                        onChange={(event) =>
                          changeActionStatus(item, event.target.value)
                        }
                        aria-label={`Status for action ${item.action_title}`}
                      >
                        {actionStatuses.map((option) => (
                          <option key={option} value={option}>
                            {readable(option)}
                          </option>
                        ))}
                      </select>
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

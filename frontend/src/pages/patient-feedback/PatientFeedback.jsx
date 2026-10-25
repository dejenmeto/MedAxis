import { useCallback, useEffect, useState } from "react";
import {
  FiMessageSquare,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiEdit2,
  FiClipboard,
  FiX,
  FiArrowLeft,
} from "react-icons/fi";

import service from "../../services/patientFeedback.service";
import "./PatientFeedback.css";

const emptyFeedback = {
  reference_number: "",
  patient_id: "",
  feedback_type: "complaint",
  category: "",
  subject: "",
  description: "",
  department: "",
  priority: "medium",
  status: "received",
  submitted_by_name: "",
  submitted_by_contact: "",
  confidential: false,
  resolution_summary: "",
};

const emptyNote = {
  note_type: "investigation",
  note: "",
  is_internal: true,
};

const types = ["complaint", "compliment", "suggestion", "service_concern"];

const priorities = ["low", "medium", "high", "urgent"];

const statuses = [
  "received",
  "under_review",
  "investigating",
  "awaiting_response",
  "resolved",
  "closed",
];

const noteTypes = [
  "investigation",
  "contact_attempt",
  "decision",
  "resolution",
  "other",
];

const readable = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function PatientFeedback() {
  const [records, setRecords] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState(emptyFeedback);
  const [noteForm, setNoteForm] = useState(emptyNote);
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
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
      const result = await service.getFeedback({
        page,
        limit: 10,
        search: search.trim(),
        status,
        type,
        priority,
      });

      setRecords(result.data || []);
      setPagination(
        result.pagination || {
          page: 1,
          total: 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load patient feedback records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type, priority]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFeedbackField = (event) => {
    const { name, value, type: inputType, checked } = event.target;

    setFeedbackForm((current) => ({
      ...current,
      [name]: inputType === "checkbox" ? checked : value,
    }));
  };

  const updateNoteField = (event) => {
    const { name, value, type: inputType, checked } = event.target;

    setNoteForm((current) => ({
      ...current,
      [name]: inputType === "checkbox" ? checked : value,
    }));
  };

  const closeForm = () => {
    setFeedbackForm(emptyFeedback);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setFeedbackForm(emptyFeedback);
    setEditingId(null);
    setShowForm(true);
    setError("");
    setNotice("");
  };

  const editRecord = (record) => {
    setFeedbackForm({
      ...emptyFeedback,
      ...record,
      patient_id: record.patient_id || "",
      submitted_by_name: record.submitted_by_name || "",
      submitted_by_contact: record.submitted_by_contact || "",
      resolution_summary: record.resolution_summary || "",
      confidential: Boolean(record.confidential),
    });

    setEditingId(record.id);
    setShowForm(true);
    setError("");
    setNotice("");
  };

  const saveFeedback = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...feedbackForm,
        patient_id: feedbackForm.patient_id || null,
      };

      if (editingId) {
        // The original reference number is immutable after creation.
        delete payload.reference_number;
        await service.updateFeedback(editingId, payload);
        setNotice("Feedback record updated.");
      } else {
        await service.createFeedback(payload);
        setNotice("Feedback recorded successfully.");
      }

      closeForm();
      setPage(1);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save the feedback record.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openRecord = async (record) => {
    setSelected(record);
    setNotes([]);
    setNoteForm(emptyNote);
    setShowNoteForm(false);
    setError("");
    setNotice("");

    try {
      const result = await service.getNotes(record.id);
      setNotes(result.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load investigation notes.",
      );
    }
  };

  const saveNote = async (event) => {
    event.preventDefault();
    if (!selected) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await service.createNote(selected.id, noteForm);
      const result = await service.getNotes(selected.id);
      setNotes(result.data || []);
      setNoteForm(emptyNote);
      setShowNoteForm(false);
      setNotice("Investigation note added.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save the investigation note.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (record, nextStatus) => {
    setError("");
    setNotice("");

    try {
      const result = await service.updateFeedback(record.id, {
        status: nextStatus,
      });

      setNotice("Feedback status updated.");

      if (selected?.id === record.id) {
        setSelected(result.data);
      }

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to update the feedback status.",
      );
    }
  };

  const summary = {
    open: records.filter(
      (record) => !["resolved", "closed"].includes(record.status),
    ).length,
    urgent: records.filter((record) => record.priority === "urgent").length,
    complaints: records.filter((record) => record.feedback_type === "complaint")
      .length,
  };

  return (
    <main className="feedback-page">
      <header className="feedback-header">
        <div>
          <p className="feedback-eyebrow">QUALITY & PATIENT EXPERIENCE</p>
          <h1>
            <FiMessageSquare /> Complaints & Patient Feedback
          </h1>
          <p className="feedback-subtitle">
            Register concerns, investigate issues, and document resolutions.
          </p>
        </div>

        <button
          className="feedback-button feedback-button-primary"
          onClick={openCreateForm}
        >
          <FiPlus /> Record Feedback
        </button>
      </header>

      {error && (
        <div className="feedback-alert feedback-alert-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="feedback-alert feedback-alert-success" role="status">
          {notice}
        </div>
      )}

      <section className="feedback-stats">
        <article>
          <span>Records on current page still open</span>
          <strong>{summary.open}</strong>
        </article>
        <article>
          <span>Urgent records on current page</span>
          <strong>{summary.urgent}</strong>
        </article>
        <article>
          <span>Complaints on current page</span>
          <strong>{summary.complaints}</strong>
        </article>
        <article>
          <span>Total matching records</span>
          <strong>{pagination.total}</strong>
        </article>
      </section>

      {showForm && (
        <section className="feedback-panel">
          <div className="feedback-panel-heading">
            <h2>{editingId ? "Edit Feedback" : "Record New Feedback"}</h2>
            <button
              type="button"
              className="feedback-icon-button"
              onClick={closeForm}
              aria-label="Close feedback form"
            >
              <FiX />
            </button>
          </div>

          <form className="feedback-form" onSubmit={saveFeedback}>
            <label>
              Reference number *
              <input
                name="reference_number"
                value={feedbackForm.reference_number}
                onChange={updateFeedbackField}
                required
                disabled={Boolean(editingId)}
                maxLength={60}
                placeholder="e.g. FB-2026-001"
              />
            </label>

            <label>
              Feedback type *
              <select
                name="feedback_type"
                value={feedbackForm.feedback_type}
                onChange={updateFeedbackField}
                required
              >
                {types.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Category *
              <input
                name="category"
                value={feedbackForm.category}
                onChange={updateFeedbackField}
                required
                placeholder="e.g. Waiting time, cleanliness"
              />
            </label>

            <label className="feedback-form-wide">
              Subject *
              <input
                name="subject"
                value={feedbackForm.subject}
                onChange={updateFeedbackField}
                required
                maxLength={200}
              />
            </label>

            <label className="feedback-form-wide">
              Description *
              <textarea
                name="description"
                value={feedbackForm.description}
                onChange={updateFeedbackField}
                required
                rows={4}
              />
            </label>

            <label>
              Patient ID (optional)
              <input
                type="number"
                min="1"
                name="patient_id"
                value={feedbackForm.patient_id}
                onChange={updateFeedbackField}
                placeholder="Existing patient database ID"
              />
            </label>

            <label>
              Department
              <input
                name="department"
                value={feedbackForm.department}
                onChange={updateFeedbackField}
                placeholder="e.g. Reception, Pharmacy"
              />
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={feedbackForm.priority}
                onChange={updateFeedbackField}
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                name="status"
                value={feedbackForm.status}
                onChange={updateFeedbackField}
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Submitted by
              <input
                name="submitted_by_name"
                value={feedbackForm.submitted_by_name}
                onChange={updateFeedbackField}
              />
            </label>

            <label>
              Contact information
              <input
                name="submitted_by_contact"
                value={feedbackForm.submitted_by_contact}
                onChange={updateFeedbackField}
                placeholder="Optional contact details"
              />
            </label>

            <label className="feedback-checkbox">
              <input
                type="checkbox"
                name="confidential"
                checked={feedbackForm.confidential}
                onChange={updateFeedbackField}
              />
              Mark this record confidential
            </label>

            <label className="feedback-form-wide">
              Resolution summary
              <textarea
                name="resolution_summary"
                value={feedbackForm.resolution_summary}
                onChange={updateFeedbackField}
                rows={3}
              />
            </label>

            <div className="feedback-form-actions feedback-form-wide">
              <button
                type="button"
                className="feedback-button"
                onClick={closeForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="feedback-button feedback-button-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Record Feedback"}
              </button>
            </div>
          </form>
        </section>
      )}

      {selected && (
        <section className="feedback-panel">
          <div className="feedback-panel-heading">
            <div>
              <p className="feedback-eyebrow">FEEDBACK DETAILS</p>
              <h2>
                {selected.reference_number} — {selected.subject}
              </h2>
            </div>
            <button
              type="button"
              className="feedback-button"
              onClick={() => setSelected(null)}
            >
              <FiArrowLeft /> Back to List
            </button>
          </div>

          <div className="feedback-detail-grid">
            <div>
              <span>Type</span>
              <strong>{readable(selected.feedback_type)}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{selected.category}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{readable(selected.priority)}</strong>
            </div>
            <div>
              <span>Department</span>
              <strong>{selected.department || "Not specified"}</strong>
            </div>
            <div>
              <span>Received</span>
              <strong>{new Date(selected.received_at).toLocaleString()}</strong>
            </div>
            <div>
              <span>Confidential</span>
              <strong>{selected.confidential ? "Yes" : "No"}</strong>
            </div>
          </div>

          <h3>Description</h3>
          <p className="feedback-description">{selected.description}</p>

          <label className="feedback-status-control">
            Update status
            <select
              value={selected.status}
              onChange={(event) => changeStatus(selected, event.target.value)}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>

          <h3>Investigation Notes</h3>
          <div className="feedback-notes">
            {notes.length === 0 ? (
              <p className="feedback-empty">
                No investigation notes recorded yet.
              </p>
            ) : (
              notes.map((note) => (
                <article key={note.id} className="feedback-note">
                  <div>
                    <strong>{readable(note.note_type)}</strong>
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <p>{note.note}</p>
                  {note.is_internal && <small>Internal note</small>}
                </article>
              ))
            )}
          </div>

          <button
            className="feedback-button feedback-button-primary"
            onClick={() => setShowNoteForm((current) => !current)}
          >
            <FiPlus /> Add Investigation Note
          </button>

          {showNoteForm && (
            <form
              className="feedback-form feedback-note-form"
              onSubmit={saveNote}
            >
              <label>
                Note type
                <select
                  name="note_type"
                  value={noteForm.note_type}
                  onChange={updateNoteField}
                >
                  {noteTypes.map((item) => (
                    <option key={item} value={item}>
                      {readable(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="feedback-form-wide">
                Note *
                <textarea
                  name="note"
                  value={noteForm.note}
                  onChange={updateNoteField}
                  required
                  rows={3}
                />
              </label>

              <label className="feedback-checkbox">
                <input
                  type="checkbox"
                  name="is_internal"
                  checked={noteForm.is_internal}
                  onChange={updateNoteField}
                />
                Internal staff note
              </label>

              <div className="feedback-form-actions feedback-form-wide">
                <button
                  type="button"
                  className="feedback-button"
                  onClick={() => setShowNoteForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="feedback-button feedback-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Note"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="feedback-panel">
        <div className="feedback-panel-heading">
          <div>
            <h2>Feedback Register</h2>
            <p>Search records and follow their progress.</p>
          </div>
          <button
            className="feedback-button"
            onClick={loadData}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="feedback-filters">
          <label className="feedback-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search reference, subject, category, department..."
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by feedback status"
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by feedback type"
          >
            <option value="">All types</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            {priorities.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="feedback-empty">Loading feedback records...</p>
        ) : records.length === 0 ? (
          <p className="feedback-empty">No matching feedback records found.</p>
        ) : (
          <div className="feedback-table-wrap">
            <table className="feedback-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.reference_number}</strong>
                      {record.confidential && <small>Confidential</small>}
                    </td>
                    <td>{record.subject}</td>
                    <td>{readable(record.feedback_type)}</td>
                    <td>{record.department || "—"}</td>
                    <td>
                      <span
                        className={`feedback-pill priority-${record.priority}`}
                      >
                        {readable(record.priority)}
                      </span>
                    </td>
                    <td>
                      <select
                        value={record.status}
                        onChange={(event) =>
                          changeStatus(record, event.target.value)
                        }
                        aria-label={`Status for ${record.reference_number}`}
                      >
                        {statuses.map((item) => (
                          <option key={item} value={item}>
                            {readable(item)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(record.received_at).toLocaleDateString()}</td>
                    <td>
                      <div className="feedback-row-actions">
                        <button
                          className="feedback-icon-button"
                          onClick={() => openRecord(record)}
                          title="View details and notes"
                          aria-label={`View ${record.reference_number}`}
                        >
                          <FiClipboard />
                        </button>
                        <button
                          className="feedback-icon-button"
                          onClick={() => editRecord(record)}
                          title="Edit feedback"
                          aria-label={`Edit ${record.reference_number}`}
                        >
                          <FiEdit2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="feedback-pagination">
          <span>
            {pagination.total} record(s) · Page {pagination.page || page} of{" "}
            {Math.max(1, pagination.totalPages || 1)}
          </span>
          <div>
            <button
              className="feedback-button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              className="feedback-button"
              disabled={loading || page >= (pagination.totalPages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

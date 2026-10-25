import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";

import doctorWorkspaceService from "../../services/doctorWorkspace.service";
import "./DoctorWorkspace.css";

const emptyTask = {
  title: "",
  description: "",
  patient_id: "",
  priority: "normal",
  due_at: "",
};

const emptyNote = {
  patient_id: "",
  note_type: "progress",
  subject: "",
  body: "",
};

function getErrorMessage(error) {
  return (
    error?.response?.data?.message || "Something went wrong. Please try again."
  );
}

function patientName(item) {
  const name = [item.first_name, item.last_name].filter(Boolean).join(" ");
  return (
    name ||
    (item.patient_id ? `Patient #${item.patient_id}` : "No patient linked")
  );
}

export default function DoctorWorkspace() {
  const [data, setData] = useState({
    summary: {},
    tasks: [],
    notes: [],
  });
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [noteForm, setNoteForm] = useState(emptyNote);
  const [activeTab, setActiveTab] = useState("tasks");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await doctorWorkspaceService.getWorkspace();
      setData({
        summary: result.summary || {},
        tasks: result.tasks || [],
        notes: result.notes || [],
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const updateTaskField = (event) => {
    const { name, value } = event.target;
    setTaskForm((current) => ({ ...current, [name]: value }));
  };

  const updateNoteField = (event) => {
    const { name, value } = event.target;
    setNoteForm((current) => ({ ...current, [name]: value }));
  };

  const submitTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await doctorWorkspaceService.createTask({
        ...taskForm,
        patient_id: taskForm.patient_id || null,
        due_at: taskForm.due_at || null,
      });

      setTaskForm(emptyTask);
      setMessage("Task created successfully.");
      setActiveTab("tasks");
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await doctorWorkspaceService.createClinicalNote({
        ...noteForm,
        patient_id: Number(noteForm.patient_id),
      });

      setNoteForm(emptyNote);
      setMessage("Clinical note saved as a draft.");
      setActiveTab("notes");
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changeTaskStatus = async (task, status) => {
    setError("");
    setMessage("");

    try {
      await doctorWorkspaceService.updateTaskStatus(task.id, status);
      setMessage("Task status updated.");
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const visibleTasks = data.tasks.filter((task) => {
    const searchText =
      `${task.title} ${task.description || ""} ${patientName(task)}`.toLowerCase();
    return (
      searchText.includes(search.toLowerCase()) &&
      (statusFilter === "all" || task.status === statusFilter)
    );
  });

  const visibleNotes = data.notes.filter((note) => {
    const searchText =
      `${note.subject} ${note.body} ${patientName(note)}`.toLowerCase();
    return searchText.includes(search.toLowerCase());
  });

  const summaryCards = [
    {
      label: "Total tasks",
      value: data.summary.totalTasks ?? 0,
      icon: FiClipboard,
      color: "blue",
    },
    {
      label: "Pending",
      value: data.summary.pendingTasks ?? 0,
      icon: FiClock,
      color: "amber",
    },
    {
      label: "In progress",
      value: data.summary.inProgressTasks ?? 0,
      icon: FiActivity,
      color: "purple",
    },
    {
      label: "Clinical notes",
      value: data.summary.clinicalNotes ?? 0,
      icon: FiFileText,
      color: "green",
    },
  ];

  return (
    <main className="doctor-workspace">
      <header className="doctor-workspace__header">
        <div>
          <p className="doctor-workspace__eyebrow">CLINICAL OPERATIONS</p>
          <h1>Doctor Workspace</h1>
          <p className="doctor-workspace__subtitle">
            Manage clinical tasks and record patient notes in one place.
          </p>
        </div>

        <button
          type="button"
          className="doctor-workspace__refresh"
          onClick={loadWorkspace}
          disabled={loading}
        >
          <FiRefreshCw /> Refresh
        </button>
      </header>

      {error && (
        <div className="doctor-workspace__alert doctor-workspace__alert--error">
          <FiAlertCircle /> {error}
        </div>
      )}

      {message && (
        <div className="doctor-workspace__alert doctor-workspace__alert--success">
          <FiCheckCircle /> {message}
        </div>
      )}

      <section className="doctor-workspace__summary">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <article className="doctor-workspace__metric" key={label}>
            <span className={`doctor-workspace__metric-icon ${color}`}>
              <Icon />
            </span>
            <div>
              <p>{label}</p>
              <strong>{loading ? "—" : value}</strong>
            </div>
          </article>
        ))}
      </section>

      <nav
        className="doctor-workspace__tabs"
        aria-label="Doctor workspace sections"
      >
        <button
          type="button"
          className={activeTab === "tasks" ? "active" : ""}
          onClick={() => setActiveTab("tasks")}
        >
          <FiClipboard /> Tasks
        </button>
        <button
          type="button"
          className={activeTab === "notes" ? "active" : ""}
          onClick={() => setActiveTab("notes")}
        >
          <FiFileText /> Clinical notes
        </button>
        <button
          type="button"
          className={activeTab === "new-task" ? "active" : ""}
          onClick={() => setActiveTab("new-task")}
        >
          <FiPlus /> New task
        </button>
        <button
          type="button"
          className={activeTab === "new-note" ? "active" : ""}
          onClick={() => setActiveTab("new-note")}
        >
          <FiPlus /> New note
        </button>
      </nav>

      {(activeTab === "tasks" || activeTab === "notes") && (
        <section className="doctor-workspace__panel">
          <div className="doctor-workspace__toolbar">
            <div className="doctor-workspace__search">
              <FiSearch />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks, notes, or patients..."
                aria-label="Search workspace"
              />
            </div>

            {activeTab === "tasks" && (
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter task status"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}
          </div>

          {loading ? (
            <div className="doctor-workspace__empty">Loading workspace...</div>
          ) : activeTab === "tasks" ? (
            visibleTasks.length ? (
              <div className="doctor-workspace__list">
                {visibleTasks.map((task) => (
                  <article className="doctor-workspace__item" key={task.id}>
                    <div className="doctor-workspace__item-main">
                      <div className="doctor-workspace__item-heading">
                        <h3>{task.title}</h3>
                        <span
                          className={`doctor-workspace__badge priority-${task.priority}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <p>{task.description || "No additional description."}</p>
                      <div className="doctor-workspace__metadata">
                        <span>{patientName(task)}</span>
                        {task.due_at && (
                          <span>
                            Due {new Date(task.due_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="doctor-workspace__item-actions">
                      <span
                        className={`doctor-workspace__badge status-${task.status}`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                      {task.status !== "completed" &&
                        task.status !== "cancelled" && (
                          <select
                            value={task.status}
                            onChange={(event) =>
                              changeTaskStatus(task, event.target.value)
                            }
                            aria-label={`Update status for ${task.title}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="doctor-workspace__empty">
                No tasks match your search.
              </div>
            )
          ) : visibleNotes.length ? (
            <div className="doctor-workspace__list">
              {visibleNotes.map((note) => (
                <article className="doctor-workspace__item" key={note.id}>
                  <div className="doctor-workspace__item-main">
                    <div className="doctor-workspace__item-heading">
                      <h3>{note.subject}</h3>
                      <span className="doctor-workspace__badge">
                        {note.note_type}
                      </span>
                    </div>
                    <p className="doctor-workspace__note-body">{note.body}</p>
                    <div className="doctor-workspace__metadata">
                      <span>{patientName(note)}</span>
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className="doctor-workspace__badge status-pending">
                    Draft
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="doctor-workspace__empty">
              No clinical notes match your search.
            </div>
          )}
        </section>
      )}

      {activeTab === "new-task" && (
        <form className="doctor-workspace__form" onSubmit={submitTask}>
          <h2>Create a clinical task</h2>
          <p>
            Doctors create tasks for their own workspace. Hospital
            administrators can assign a task to a doctor using the API.
          </p>

          <label>
            Task title *
            <input
              name="title"
              value={taskForm.title}
              onChange={updateTaskField}
              required
              maxLength={200}
              placeholder="e.g. Review laboratory result"
            />
          </label>

          <label>
            Patient ID (optional)
            <input
              type="number"
              min="1"
              name="patient_id"
              value={taskForm.patient_id}
              onChange={updateTaskField}
              placeholder="Existing patient ID"
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={taskForm.description}
              onChange={updateTaskField}
              rows="3"
              placeholder="Task details..."
            />
          </label>

          <div className="doctor-workspace__form-grid">
            <label>
              Priority
              <select
                name="priority"
                value={taskForm.priority}
                onChange={updateTaskField}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>

            <label>
              Due date and time
              <input
                type="datetime-local"
                name="due_at"
                value={taskForm.due_at}
                onChange={updateTaskField}
              />
            </label>
          </div>

          <button className="doctor-workspace__submit" disabled={saving}>
            {saving ? "Saving..." : "Create task"}
          </button>
        </form>
      )}

      {activeTab === "new-note" && (
        <form className="doctor-workspace__form" onSubmit={submitNote}>
          <h2>Write a clinical note</h2>
          <p>
            Notes are saved as drafts. This first version does not sign or lock
            notes.
          </p>

          <label>
            Patient ID *
            <input
              type="number"
              min="1"
              name="patient_id"
              value={noteForm.patient_id}
              onChange={updateNoteField}
              required
              placeholder="Existing patient ID"
            />
          </label>

          <label>
            Note type
            <select
              name="note_type"
              value={noteForm.note_type}
              onChange={updateNoteField}
            >
              <option value="progress">Progress</option>
              <option value="consultation">Consultation</option>
              <option value="follow_up">Follow-up</option>
              <option value="discharge">Discharge</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Subject *
            <input
              name="subject"
              value={noteForm.subject}
              onChange={updateNoteField}
              required
              maxLength={200}
              placeholder="Brief note title"
            />
          </label>

          <label>
            Clinical note *
            <textarea
              name="body"
              value={noteForm.body}
              onChange={updateNoteField}
              rows="7"
              required
              placeholder="Record relevant clinical observations..."
            />
          </label>

          <button className="doctor-workspace__submit" disabled={saving}>
            {saving ? "Saving..." : "Save draft"}
          </button>
        </form>
      )}
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import nursingService from "../../services/nursing.service";
import "./Nursing.css";

const RESOURCE_CONFIG = {
  assessments: {
    label: "Assessments",
    title: "Nursing assessment",
    required: ["patient_id"],
    fields: [
      { name: "patient_id", label: "Patient ID", required: true },
      { name: "admission_id", label: "Admission ID (optional)" },
      {
        name: "assessed_at",
        label: "Assessment date and time",
        type: "datetime-local",
      },
      { name: "chief_complaint", label: "Chief complaint", type: "textarea" },
      {
        name: "general_appearance",
        label: "General appearance",
        type: "textarea",
      },
      {
        name: "pain_score",
        label: "Pain score (0–10)",
        type: "number",
        min: 0,
        max: 10,
      },
      {
        name: "fall_risk",
        label: "Fall risk",
        type: "select",
        options: ["low", "moderate", "high"],
      },
      {
        name: "pressure_injury_risk",
        label: "Pressure injury risk",
        type: "select",
        options: ["low", "moderate", "high"],
      },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  carePlans: {
    label: "Care plans",
    title: "Nursing care plan",
    required: ["patient_id", "nursing_diagnosis", "goals", "interventions"],
    fields: [
      { name: "patient_id", label: "Patient ID", required: true },
      { name: "admission_id", label: "Admission ID (optional)" },
      {
        name: "nursing_diagnosis",
        label: "Nursing diagnosis",
        required: true,
        type: "textarea",
      },
      { name: "goals", label: "Care goals", required: true, type: "textarea" },
      {
        name: "interventions",
        label: "Interventions",
        required: true,
        type: "textarea",
      },
      { name: "evaluation", label: "Evaluation", type: "textarea" },
      {
        name: "plan_status",
        label: "Status",
        type: "select",
        options: ["active", "completed", "discontinued"],
      },
    ],
  },
  observations: {
    label: "Observations",
    title: "Patient observation",
    required: ["patient_id", "observation_type", "observation_value"],
    fields: [
      { name: "patient_id", label: "Patient ID", required: true },
      { name: "admission_id", label: "Admission ID (optional)" },
      {
        name: "observation_type",
        label: "Observation type",
        required: true,
        type: "select",
        options: [
          "temperature",
          "blood_pressure",
          "heart_rate",
          "respiratory_rate",
          "oxygen_saturation",
          "weight",
          "height",
          "intake",
          "output",
          "blood_glucose",
          "other",
        ],
      },
      { name: "observation_value", label: "Value", required: true },
      { name: "unit", label: "Unit (e.g. °C, mmHg, bpm)" },
      {
        name: "observed_at",
        label: "Observation date and time",
        type: "datetime-local",
      },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
};

const EMPTY_FORM = {
  assessments: {
    patient_id: "",
    admission_id: "",
    assessed_at: "",
    chief_complaint: "",
    general_appearance: "",
    pain_score: "",
    fall_risk: "",
    pressure_injury_risk: "",
    notes: "",
  },
  carePlans: {
    patient_id: "",
    admission_id: "",
    nursing_diagnosis: "",
    goals: "",
    interventions: "",
    evaluation: "",
    plan_status: "active",
  },
  observations: {
    patient_id: "",
    admission_id: "",
    observation_type: "temperature",
    observation_value: "",
    unit: "",
    observed_at: "",
    notes: "",
  },
};

function extractPayload(response) {
  const body = response?.data;

  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  if (Array.isArray(body)) return body;

  return [];
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function toInputDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function normalizeForm(resource, form) {
  const result = { ...form };

  for (const field of ["patient_id", "admission_id"]) {
    if (result[field] === "") {
      result[field] = null;
    }
  }

  if (resource === "assessments") {
    if (!result.assessed_at) {
      delete result.assessed_at;
    }

    result.pain_score =
      result.pain_score === "" ? null : Number(result.pain_score);
  }

  if (resource === "observations" && !result.observed_at) {
    delete result.observed_at;
  }

  return result;
}

export default function Nursing() {
  const [activeTab, setActiveTab] = useState("assessments");
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM.assessments);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const config = RESOURCE_CONFIG[activeTab];
  const resource = nursingService[activeTab];

  const loadRecords = useCallback(async () => {
    setLoading(true);

    try {
      const response = await resource.list({
        page,
        limit: 10,
        search: search.trim() || undefined,
        patientId: patientId.trim() || undefined,
      });

      const body = response.data || {};
      setRecords(extractPayload(response));

      if (body.pagination) {
        setPagination(body.pagination);
      } else if (body.data?.pagination) {
        setPagination(body.data.pagination);
      } else {
        setPagination({
          page,
          limit: 10,
          total: extractPayload(response).length,
          totalPages: 1,
        });
      }
    } catch (error) {
      console.error("Failed to load Nursing records:", error);
      toast.error(
        error.response?.data?.message ||
          "Could not load Nursing records. Check your login and API.",
      );
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [resource, page, search, patientId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  function changeTab(tab) {
    setActiveTab(tab);
    setForm(EMPTY_FORM[tab]);
    setEditingId(null);
    setShowForm(false);
    setPage(1);
  }

  function openCreateForm() {
    setForm({ ...EMPTY_FORM[activeTab] });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(record) {
    const nextForm = { ...EMPTY_FORM[activeTab] };

    for (const field of config.fields) {
      const value = record[field.name];

      if (value !== undefined && value !== null) {
        nextForm[field.name] =
          field.type === "datetime-local" ? toInputDate(value) : String(value);
      }
    }

    setForm(nextForm);
    setEditingId(record.id);
    setShowForm(true);
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();

    const missing = config.required.find(
      (field) =>
        form[field] === undefined ||
        form[field] === null ||
        String(form[field]).trim() === "",
    );

    if (missing) {
      toast.error(`Please complete the required field: ${missing}.`);
      return;
    }

    setSaving(true);

    try {
      const payload = normalizeForm(activeTab, form);

      if (editingId) {
        await resource.update(editingId, payload);
        toast.success("Nursing record updated.");
      } else {
        await resource.create(payload);
        toast.success("Nursing record created.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM[activeTab] });
      await loadRecords();
    } catch (error) {
      console.error("Failed to save Nursing record:", error);
      toast.error(
        error.response?.data?.message || "Could not save Nursing record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record) {
    const confirmed = window.confirm(
      "Delete this Nursing record? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      await resource.remove(record.id);
      toast.success("Nursing record deleted.");

      if (records.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadRecords();
      }
    } catch (error) {
      console.error("Failed to delete Nursing record:", error);
      toast.error(
        error.response?.data?.message || "Could not delete Nursing record.",
      );
    }
  }

  return (
    <main className="nursing-page">
      <header className="nursing-header">
        <div>
          <p className="nursing-eyebrow">CLINICAL CARE</p>
          <h1>Nursing</h1>
          <p className="nursing-subtitle">
            Manage nursing assessments, care plans, and patient observations.
          </p>
        </div>

        <button
          type="button"
          className="nursing-primary-button"
          onClick={openCreateForm}
        >
          + New {config.label.slice(0, -1)}
        </button>
      </header>

      <section className="nursing-tabs" aria-label="Nursing record types">
        {Object.entries(RESOURCE_CONFIG).map(([key, item]) => (
          <button
            type="button"
            key={key}
            className={activeTab === key ? "active" : ""}
            onClick={() => changeTab(key)}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="nursing-toolbar">
        <label>
          <span>Search records</span>
          <input
            type="search"
            placeholder="Search notes, diagnoses, or observations..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          <span>Filter by patient ID</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Patient ID"
            value={patientId}
            onChange={(event) => {
              setPatientId(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <button
          type="button"
          className="nursing-secondary-button"
          onClick={loadRecords}
          disabled={loading}
        >
          Refresh
        </button>
      </section>

      {showForm && (
        <section className="nursing-form-card">
          <div className="nursing-form-heading">
            <div>
              <h2>
                {editingId ? "Edit" : "Create"} {config.title}
              </h2>
              <p>Complete the relevant clinical record fields.</p>
            </div>

            <button
              type="button"
              className="nursing-close-button"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={submitForm}>
            <div className="nursing-form-grid">
              {config.fields.map((field) => (
                <label
                  key={field.name}
                  className={
                    field.type === "textarea"
                      ? "nursing-field nursing-field-wide"
                      : "nursing-field"
                  }
                >
                  <span>
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>

                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={form[field.name] ?? ""}
                      required={field.required}
                      onChange={(event) =>
                        updateField(field.name, event.target.value)
                      }
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={form[field.name] ?? ""}
                      required={field.required}
                      onChange={(event) =>
                        updateField(field.name, event.target.value)
                      }
                    >
                      {field.name !== "observation_type" && (
                        <option value="">Select...</option>
                      )}
                      {field.options.map((option) => (
                        <option value={option} key={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || "text"}
                      min={field.min}
                      max={field.max}
                      step={field.type === "number" ? 1 : undefined}
                      value={form[field.name] ?? ""}
                      required={field.required}
                      onChange={(event) =>
                        updateField(field.name, event.target.value)
                      }
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="nursing-form-actions">
              <button
                type="button"
                className="nursing-secondary-button"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="nursing-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create record"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="nursing-records-card">
        <div className="nursing-records-heading">
          <div>
            <h2>{config.label}</h2>
            <p>{pagination.total} record(s)</p>
          </div>
        </div>

        {loading ? (
          <div className="nursing-state">Loading Nursing records...</div>
        ) : records.length === 0 ? (
          <div className="nursing-state">
            <h3>No records found</h3>
            <p>Create a record or change your search filters.</p>
          </div>
        ) : (
          <div className="nursing-table-wrap">
            <table className="nursing-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  {config.fields
                    .filter((field) => field.name !== "patient_id")
                    .slice(0, 4)
                    .map((field) => (
                      <th key={field.name}>{field.label}</th>
                    ))}
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{displayValue(record.patient_id)}</td>
                    {config.fields
                      .filter((field) => field.name !== "patient_id")
                      .slice(0, 4)
                      .map((field) => (
                        <td key={field.name}>
                          {displayValue(record[field.name])}
                        </td>
                      ))}
                    <td>
                      <div className="nursing-row-actions">
                        <button
                          type="button"
                          onClick={() => openEditForm(record)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="nursing-delete-button"
                          onClick={() => deleteRecord(record)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="nursing-pagination">
          <span>
            Page {pagination.page || page} of{" "}
            {Math.max(pagination.totalPages || 1, 1)}
          </span>

          <div>
            <button
              type="button"
              className="nursing-secondary-button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="nursing-secondary-button"
              disabled={
                loading ||
                (pagination.totalPages
                  ? page >= pagination.totalPages
                  : records.length < 10)
              }
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

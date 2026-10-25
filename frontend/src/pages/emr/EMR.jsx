import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiActivity, FiPlus, FiSearch, FiRefreshCw } from "react-icons/fi";
import api from "../../services/api";
import "./EMR.css";

const emptyForm = {
  patient_id: "",
  encounter_type: "outpatient",
  chief_complaint: "",
  history_of_present_illness: "",
  examination_notes: "",
  assessment: "",
  plan: "",
};

function rowsFrom(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.encounters)) return data.encounters;
  return [];
}

export default function EMR() {
  const [encounters, setEncounters] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadEncounters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/emr/encounters", {
        params: { search: search.trim() || undefined, page: 1, limit: 100 },
      });
      setEncounters(rowsFrom(response));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load medical records.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadEncounters();
  }, [loadEncounters]);

  async function createEncounter(event) {
    event.preventDefault();

    if (!form.patient_id.trim()) {
      toast.error("Enter the patient ID.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/emr/encounters", form);
      toast.success("Encounter created.");
      setForm(emptyForm);
      setShowForm(false);
      await loadEncounters();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create encounter.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="emr-page">
      <header className="emr-heading">
        <div>
          <span className="emr-eyebrow">CLINICAL WORKSPACE</span>
          <h1>Medical records</h1>
          <p>Review patient encounters and document clinical assessments.</p>
        </div>
        <button className="emr-primary" onClick={() => setShowForm(true)}>
          <FiPlus /> New encounter
        </button>
      </header>

      <section className="emr-stat">
        <span className="emr-stat-icon">
          <FiActivity />
        </span>
        <div>
          <small>Encounters displayed</small>
          <strong>{encounters.length}</strong>
        </div>
        <button
          className="emr-icon-button"
          onClick={loadEncounters}
          disabled={loading}
          aria-label="Refresh"
        >
          <FiRefreshCw />
        </button>
      </section>

      <section className="emr-panel">
        <div className="emr-toolbar">
          <div className="emr-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search encounters..."
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table emr-table align-middle">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Encounter</th>
                <th>Complaint</th>
                <th>Clinician</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="emr-empty">
                    Loading records...
                  </td>
                </tr>
              ) : encounters.length === 0 ? (
                <tr>
                  <td colSpan="6" className="emr-empty">
                    No encounters found.
                  </td>
                </tr>
              ) : (
                encounters.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.first_name || ""} {item.last_name || ""}
                      </strong>
                      <small>{item.mr_number || item.patient_id}</small>
                    </td>
                    <td>{item.encounter_number || item.id}</td>
                    <td>{item.chief_complaint || "—"}</td>
                    <td>{item.clinician_name || item.clinician_id || "—"}</td>
                    <td>
                      <span
                        className={`emr-status status-${item.encounter_status || "open"}`}
                      >
                        {item.encounter_status || "open"}
                      </span>
                    </td>
                    <td>
                      {item.started_at
                        ? new Date(item.started_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="emr-backdrop">
          <section className="emr-modal" role="dialog" aria-modal="true">
            <header className="emr-modal-heading">
              <div>
                <span className="emr-eyebrow">NEW RECORD</span>
                <h2>Clinical encounter</h2>
              </div>
              <button
                type="button"
                className="emr-close"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <form className="emr-form" onSubmit={createEncounter}>
              <label>
                Patient ID *
                <input
                  value={form.patient_id}
                  onChange={(e) =>
                    setForm({ ...form, patient_id: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Encounter type
                <select
                  value={form.encounter_type}
                  onChange={(e) =>
                    setForm({ ...form, encounter_type: e.target.value })
                  }
                >
                  <option value="outpatient">Outpatient</option>
                  <option value="inpatient">Inpatient</option>
                  <option value="emergency">Emergency</option>
                  <option value="telemedicine">Telemedicine</option>
                </select>
              </label>
              <label>
                Chief complaint
                <textarea
                  rows="2"
                  value={form.chief_complaint}
                  onChange={(e) =>
                    setForm({ ...form, chief_complaint: e.target.value })
                  }
                />
              </label>
              <label>
                History of present illness
                <textarea
                  rows="3"
                  value={form.history_of_present_illness}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      history_of_present_illness: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Examination notes
                <textarea
                  rows="3"
                  value={form.examination_notes}
                  onChange={(e) =>
                    setForm({ ...form, examination_notes: e.target.value })
                  }
                />
              </label>
              <label>
                Assessment
                <textarea
                  rows="2"
                  value={form.assessment}
                  onChange={(e) =>
                    setForm({ ...form, assessment: e.target.value })
                  }
                />
              </label>
              <label>
                Plan
                <textarea
                  rows="2"
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                />
              </label>
              <div className="emr-actions">
                <button
                  type="button"
                  className="emr-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="emr-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save encounter"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

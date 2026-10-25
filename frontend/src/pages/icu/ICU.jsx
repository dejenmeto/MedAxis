import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiGrid,
  FiCheckCircle,
  FiClipboard,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import toast from "react-hot-toast";
import icuService from "../../services/icu.service";
import "./ICU.css";

const emptyUnit = {
  unit_code: "",
  unit_name: "",
  unit_type: "general",
  floor_number: "",
  description: "",
};

const emptyBed = {
  unit_id: "",
  bed_code: "",
  monitoring_level: "standard",
  equipment_notes: "",
};

const emptyStay = {
  patient_id: "",
  admission_id: "",
  bed_id: "",
  attending_staff_id: "",
  stay_number: "",
  admission_reason: "",
  admission_diagnosis: "",
  clinical_summary: "",
};

const emptyObservation = {
  stay_id: "",
  heart_rate: "",
  respiratory_rate: "",
  oxygen_saturation: "",
  systolic_bp: "",
  diastolic_bp: "",
  temperature_c: "",
  gcs_score: "",
  pain_score: "",
  urine_output_ml: "",
  notes: "",
};

const emptyNote = {
  stay_id: "",
  note_type: "progress",
  note_text: "",
};

function unwrap(response) {
  return response?.data?.data ?? [];
}

function StatCard({ title, value, icon: Icon, detail }) {
  return (
    <article className="icu-stat-card">
      <div className="icu-stat-top">
        <span>{title}</span>
        <span className="icu-stat-icon">
          <Icon />
        </span>
      </div>
      <strong>{value ?? 0}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="icu-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function ICU() {
  const [activeTab, setActiveTab] = useState("overview");
  const [summary, setSummary] = useState({});
  const [units, setUnits] = useState([]);
  const [beds, setBeds] = useState([]);
  const [stays, setStays] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [observations, setObservations] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedStay, setSelectedStay] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [unitForm, setUnitForm] = useState(emptyUnit);
  const [bedForm, setBedForm] = useState(emptyBed);
  const [stayForm, setStayForm] = useState(emptyStay);
  const [observationForm, setObservationForm] = useState(emptyObservation);
  const [noteForm, setNoteForm] = useState(emptyNote);
  const [transferForm, setTransferForm] = useState({
    stay_id: "",
    to_bed_id: "",
    transfer_reason: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    const requests = await Promise.allSettled([
      icuService.getSummary(),
      icuService.getUnits(),
      icuService.getBeds({ page: 1, limit: 100 }),
      icuService.getStays({ page: 1, limit: 100 }),
      icuService.getTransfers(),
    ]);

    const [
      summaryResult,
      unitsResult,
      bedsResult,
      staysResult,
      transfersResult,
    ] = requests;

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value?.data?.data ?? {});
    }

    if (unitsResult.status === "fulfilled") {
      setUnits(unwrap(unitsResult.value));
    }

    if (bedsResult.status === "fulfilled") {
      setBeds(unwrap(bedsResult.value));
    } else {
      console.error("Failed to load ICU beds:", bedsResult.reason);
    }

    if (staysResult.status === "fulfilled") {
      setStays(unwrap(staysResult.value));
    } else {
      console.error("Failed to load ICU stays:", staysResult.reason);
    }

    if (transfersResult.status === "fulfilled") {
      setTransfers(unwrap(transfersResult.value));
    } else {
      console.error("Failed to load ICU transfers:", transfersResult.reason);
    }

    const failedRequests = requests.filter(
      (result) => result.status === "rejected",
    );

    if (failedRequests.length > 0) {
      toast.error(
        `${failedRequests.length} ICU data request(s) failed. Check the browser console.`,
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadStayDetails = async (stayId) => {
    if (!stayId) {
      setObservations([]);
      setNotes([]);
      return;
    }

    try {
      const [observationResponse, noteResponse] = await Promise.all([
        icuService.getObservations(stayId),
        icuService.getNotes(stayId),
      ]);
      setObservations(unwrap(observationResponse));
      setNotes(unwrap(noteResponse));
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to load clinical records.",
      );
    }
  };

  const submit = async (event, action, data, reset) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await action(data);
      toast.success("ICU record saved successfully.");
      reset();
      await loadData();

      const stayId = data.stay_id || selectedStay;
      if (stayId) {
        setSelectedStay(stayId);
        await loadStayDetails(stayId);
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to save this ICU record.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredBeds = beds.filter((bed) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      bed.bed_code?.toLowerCase().includes(term) ||
      bed.unit_name?.toLowerCase().includes(term)
    );
  });

  const filteredStays = stays.filter((stay) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      stay.stay_number?.toLowerCase().includes(term) ||
      stay.admission_reason?.toLowerCase().includes(term)
    );
  });

  const tabs = [
    ["overview", "Overview"],
    ["units", "ICU Units"],
    ["beds", "Beds"],
    ["stays", "Patient Stays"],
    ["observations", "Vital Signs"],
    ["notes", "Clinical Notes"],
    ["transfers", "Transfers"],
  ];

  return (
    <main className="icu-page">
      <header className="icu-header">
        <div>
          <span className="icu-eyebrow">MEDAXIS · CRITICAL CARE</span>
          <h1>ICU & Critical Care</h1>
          <p>
            Manage critical-care beds, admissions and clinical observations.
          </p>
        </div>
        <button className="icu-button icu-button-secondary" onClick={loadData}>
          <FiRefreshCw /> Refresh
        </button>
      </header>

      <nav className="icu-tabs" aria-label="ICU sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? "active" : ""}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="icu-empty">
          <FiRefreshCw /> Loading ICU records…
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <>
              <section className="icu-stat-grid">
                <StatCard
                  title="ICU Units"
                  value={summary.total_units}
                  icon={FiActivity}
                  detail="Active units"
                />
                <StatCard
                  title="Total Beds"
                  value={summary.total_beds}
                  icon={FiGrid}
                  detail="Active ICU beds"
                />
                <StatCard
                  title="Available Beds"
                  value={summary.available_beds}
                  icon={FiCheckCircle}
                  detail="Ready for admission"
                />
                <StatCard
                  title="Active Stays"
                  value={summary.active_stays}
                  icon={FiUsers}
                  detail="Current ICU patients"
                />
                <StatCard
                  title="Observations"
                  value={summary.observations_24h}
                  icon={FiClipboard}
                  detail="Recorded in the last 24 hours"
                />
              </section>

              <section className="icu-panel">
                <div className="icu-panel-heading">
                  <div>
                    <h2>Current ICU stays</h2>
                    <p>Recent active critical-care admissions</p>
                  </div>
                  <button
                    className="icu-button"
                    onClick={() => setActiveTab("stays")}
                  >
                    View stays
                  </button>
                </div>
                <StayTable
                  stays={stays
                    .filter((stay) => stay.stay_status === "active")
                    .slice(0, 8)}
                />
              </section>
            </>
          )}

          {activeTab === "units" && (
            <section className="icu-two-column">
              <section className="icu-panel">
                <h2>Create ICU unit</h2>
                <form
                  onSubmit={(e) =>
                    submit(
                      e,
                      icuService.createUnit,
                      { ...unitForm, department_id: null },
                      () => setUnitForm(emptyUnit),
                    )
                  }
                >
                  <Field label="Unit code">
                    <input
                      required
                      maxLength="50"
                      value={unitForm.unit_code}
                      onChange={(e) =>
                        setUnitForm({ ...unitForm, unit_code: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Unit name">
                    <input
                      required
                      maxLength="150"
                      value={unitForm.unit_name}
                      onChange={(e) =>
                        setUnitForm({ ...unitForm, unit_name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Unit type">
                    <select
                      value={unitForm.unit_type}
                      onChange={(e) =>
                        setUnitForm({ ...unitForm, unit_type: e.target.value })
                      }
                    >
                      <option value="general">General</option>
                      <option value="adult">Adult</option>
                      <option value="pediatric">Pediatric</option>
                      <option value="neonatal">Neonatal</option>
                      <option value="cardiac">Cardiac</option>
                    </select>
                  </Field>
                  <Field label="Floor">
                    <input
                      value={unitForm.floor_number}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          floor_number: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      value={unitForm.description}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          description: e.target.value,
                        })
                      }
                      rows="3"
                    />
                  </Field>
                  <button className="icu-button" disabled={saving}>
                    <FiPlus /> Create unit
                  </button>
                </form>
              </section>
              <section className="icu-panel">
                <h2>ICU units</h2>
                <div className="icu-record-list">
                  {units.map((unit) => (
                    <article key={unit.id} className="icu-record">
                      <div>
                        <strong>{unit.unit_name}</strong>
                        <small>
                          {unit.unit_code} · {unit.unit_type}
                        </small>
                      </div>
                      <span>
                        {unit.available_beds ?? 0}/{unit.total_beds ?? 0} beds
                        free
                      </span>
                    </article>
                  ))}
                  {!units.length && (
                    <p className="icu-muted">No units created yet.</p>
                  )}
                </div>
              </section>
            </section>
          )}

          {activeTab === "beds" && (
            <>
              <section className="icu-panel">
                <h2>Add ICU bed</h2>
                <form
                  className="icu-form-grid"
                  onSubmit={(e) =>
                    submit(e, icuService.createBed, bedForm, () =>
                      setBedForm(emptyBed),
                    )
                  }
                >
                  <Field label="ICU unit">
                    <select
                      required
                      value={bedForm.unit_id}
                      onChange={(e) =>
                        setBedForm({ ...bedForm, unit_id: e.target.value })
                      }
                    >
                      <option value="">Select unit</option>
                      {units
                        .filter((unit) => unit.is_active)
                        .map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.unit_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Bed code">
                    <input
                      required
                      value={bedForm.bed_code}
                      onChange={(e) =>
                        setBedForm({ ...bedForm, bed_code: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Monitoring level">
                    <select
                      value={bedForm.monitoring_level}
                      onChange={(e) =>
                        setBedForm({
                          ...bedForm,
                          monitoring_level: e.target.value,
                        })
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="continuous">Continuous</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </Field>
                  <Field label="Equipment notes">
                    <input
                      value={bedForm.equipment_notes}
                      onChange={(e) =>
                        setBedForm({
                          ...bedForm,
                          equipment_notes: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <button className="icu-button" disabled={saving}>
                    <FiPlus /> Add bed
                  </button>
                </form>
              </section>

              <section className="icu-panel">
                <div className="icu-panel-heading">
                  <h2>ICU beds</h2>
                  <label className="icu-search">
                    <FiSearch />
                    <input
                      placeholder="Search bed or unit"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="icu-bed-grid">
                  {filteredBeds.map((bed) => (
                    <article
                      key={bed.id}
                      className={`icu-bed-card status-${bed.bed_status}`}
                    >
                      <div className="icu-bed-title">
                        <FiGrid />
                        <strong>{bed.bed_code}</strong>
                      </div>
                      <span>{bed.unit_name}</span>
                      <span className="icu-status">{bed.bed_status}</span>
                      <small>{bed.monitoring_level} monitoring</small>
                    </article>
                  ))}
                  {!filteredBeds.length && (
                    <p className="icu-muted">
                      No beds found. Create a unit first.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "stays" && (
            <>
              <section className="icu-panel">
                <h2>Admit patient to ICU</h2>
                <form
                  onSubmit={(e) =>
                    submit(
                      e,
                      icuService.createStay,
                      {
                        ...stayForm,
                        patient_id: Number(stayForm.patient_id),
                        admission_id: stayForm.admission_id || null,
                        attending_staff_id: stayForm.attending_staff_id || null,
                      },
                      () => setStayForm(emptyStay),
                    )
                  }
                >
                  <div className="icu-form-grid">
                    <Field label="Patient ID">
                      <input
                        required
                        type="number"
                        min="1"
                        value={stayForm.patient_id}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            patient_id: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Linked inpatient admission UUID (optional)">
                      <input
                        value={stayForm.admission_id}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            admission_id: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Available ICU bed">
                      <select
                        required
                        value={stayForm.bed_id}
                        onChange={(e) =>
                          setStayForm({ ...stayForm, bed_id: e.target.value })
                        }
                      >
                        <option value="">Select bed</option>
                        {beds
                          .filter((bed) => bed.bed_status === "available")
                          .map((bed) => (
                            <option key={bed.id} value={bed.id}>
                              {bed.bed_code} — {bed.unit_name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Attending staff ID (optional)">
                      <input
                        type="number"
                        min="1"
                        value={stayForm.attending_staff_id}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            attending_staff_id: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Stay number">
                      <input
                        required
                        value={stayForm.stay_number}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            stay_number: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Admission reason">
                      <input
                        required
                        value={stayForm.admission_reason}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            admission_reason: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Admission diagnosis">
                      <input
                        value={stayForm.admission_diagnosis}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            admission_diagnosis: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Clinical summary">
                      <input
                        value={stayForm.clinical_summary}
                        onChange={(e) =>
                          setStayForm({
                            ...stayForm,
                            clinical_summary: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <button className="icu-button" disabled={saving}>
                    <FiPlus /> Admit patient
                  </button>
                </form>
              </section>

              <section className="icu-panel">
                <div className="icu-panel-heading">
                  <h2>Patient stays</h2>
                  <label className="icu-search">
                    <FiSearch />
                    <input
                      placeholder="Search stay or reason"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <StayTable
                  stays={filteredStays}
                  onSelect={(id) => {
                    setSelectedStay(id);
                    setObservationForm({ ...emptyObservation, stay_id: id });
                    setNoteForm({ ...emptyNote, stay_id: id });
                    setTransferForm((previous) => ({
                      ...previous,
                      stay_id: id,
                    }));
                    setActiveTab("observations");
                    loadStayDetails(id);
                  }}
                  onDischarge={async (stay) => {
                    if (
                      !window.confirm(`Discharge ICU stay ${stay.stay_number}?`)
                    )
                      return;
                    try {
                      await icuService.dischargeStay(stay.id, {});
                      toast.success("ICU stay discharged.");
                      await loadData();
                    } catch (error) {
                      toast.error(
                        error?.response?.data?.message || "Discharge failed.",
                      );
                    }
                  }}
                />
              </section>
            </>
          )}

          {activeTab === "observations" && (
            <>
              <section className="icu-panel">
                <h2>Record vital signs</h2>
                <Field label="Active ICU stay">
                  <select
                    value={selectedStay}
                    onChange={(e) => {
                      setSelectedStay(e.target.value);
                      setObservationForm({
                        ...emptyObservation,
                        stay_id: e.target.value,
                      });
                      setNoteForm({ ...emptyNote, stay_id: e.target.value });
                      loadStayDetails(e.target.value);
                    }}
                  >
                    <option value="">Select patient stay</option>
                    {stays
                      .filter((stay) => stay.stay_status === "active")
                      .map((stay) => (
                        <option key={stay.id} value={stay.id}>
                          {stay.stay_number} · {stay.admission_reason}
                        </option>
                      ))}
                  </select>
                </Field>
                <form
                  onSubmit={(e) =>
                    submit(
                      e,
                      icuService.createObservation,
                      Object.fromEntries(
                        Object.entries(observationForm).map(([key, value]) => [
                          key,
                          value === "" ? null : value,
                        ]),
                      ),
                      () =>
                        setObservationForm({
                          ...emptyObservation,
                          stay_id: selectedStay,
                        }),
                    )
                  }
                >
                  <div className="icu-form-grid">
                    {[
                      ["heart_rate", "Heart rate (bpm)"],
                      ["respiratory_rate", "Respiratory rate (/min)"],
                      ["oxygen_saturation", "Oxygen saturation (%)"],
                      ["systolic_bp", "Systolic BP"],
                      ["diastolic_bp", "Diastolic BP"],
                      ["temperature_c", "Temperature (°C)"],
                      ["gcs_score", "GCS (3–15)"],
                      ["pain_score", "Pain score (0–10)"],
                      ["urine_output_ml", "Urine output (mL)"],
                    ].map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          step="any"
                          value={observationForm[key]}
                          onChange={(e) =>
                            setObservationForm({
                              ...observationForm,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label="Observation notes">
                    <textarea
                      rows="3"
                      value={observationForm.notes}
                      onChange={(e) =>
                        setObservationForm({
                          ...observationForm,
                          notes: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <button
                    className="icu-button"
                    disabled={saving || !selectedStay}
                  >
                    <FiPlus /> Record observation
                  </button>
                </form>
              </section>

              <section className="icu-panel">
                <h2>Recorded observations</h2>
                <div className="icu-table-wrap">
                  <table className="icu-table">
                    <thead>
                      <tr>
                        <th>Recorded</th>
                        <th>Heart rate</th>
                        <th>Respiratory rate</th>
                        <th>SpO₂</th>
                        <th>Blood pressure</th>
                        <th>Temperature</th>
                        <th>GCS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {observations.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.observed_at).toLocaleString()}</td>
                          <td>{item.heart_rate ?? "—"}</td>
                          <td>{item.respiratory_rate ?? "—"}</td>
                          <td>{item.oxygen_saturation ?? "—"}%</td>
                          <td>
                            {item.systolic_bp ?? "—"}/{item.diastolic_bp ?? "—"}
                          </td>
                          <td>{item.temperature_c ?? "—"}</td>
                          <td>{item.gcs_score ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!observations.length && (
                    <p className="icu-muted">
                      Select a stay to view observations.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "notes" && (
            <>
              <section className="icu-panel">
                <h2>Add clinical note</h2>
                <form
                  onSubmit={(e) =>
                    submit(e, icuService.createNote, noteForm, () =>
                      setNoteForm({ ...emptyNote, stay_id: selectedStay }),
                    )
                  }
                >
                  <Field label="Active ICU stay">
                    <select
                      required
                      value={noteForm.stay_id}
                      onChange={(e) => {
                        setNoteForm({ ...noteForm, stay_id: e.target.value });
                        setSelectedStay(e.target.value);
                        loadStayDetails(e.target.value);
                      }}
                    >
                      <option value="">Select patient stay</option>
                      {stays
                        .filter((stay) => stay.stay_status === "active")
                        .map((stay) => (
                          <option key={stay.id} value={stay.id}>
                            {stay.stay_number}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Note type">
                    <select
                      value={noteForm.note_type}
                      onChange={(e) =>
                        setNoteForm({ ...noteForm, note_type: e.target.value })
                      }
                    >
                      <option value="admission">Admission</option>
                      <option value="progress">Progress</option>
                      <option value="procedure">Procedure</option>
                      <option value="handover">Handover</option>
                      <option value="consultation">Consultation</option>
                      <option value="discharge">Discharge</option>
                    </select>
                  </Field>
                  <Field label="Clinical note">
                    <textarea
                      required
                      rows="5"
                      value={noteForm.note_text}
                      onChange={(e) =>
                        setNoteForm({ ...noteForm, note_text: e.target.value })
                      }
                    />
                  </Field>
                  <button
                    className="icu-button"
                    disabled={saving || !noteForm.stay_id}
                  >
                    <FiPlus /> Save note
                  </button>
                </form>
              </section>
              <section className="icu-panel">
                <h2>Clinical notes</h2>
                {notes.map((note) => (
                  <article className="icu-note" key={note.id}>
                    <div>
                      <strong>{note.note_type}</strong>
                      <small>
                        {new Date(note.created_at).toLocaleString()}
                      </small>
                    </div>
                    <p>{note.note_text}</p>
                  </article>
                ))}
                {!notes.length && (
                  <p className="icu-muted">
                    Select a stay to view clinical notes.
                  </p>
                )}
              </section>
            </>
          )}

          {activeTab === "transfers" && (
            <>
              <section className="icu-panel">
                <h2>Transfer to another ICU bed</h2>
                <form
                  onSubmit={(e) =>
                    submit(e, icuService.createTransfer, transferForm, () =>
                      setTransferForm({
                        stay_id: "",
                        to_bed_id: "",
                        transfer_reason: "",
                        notes: "",
                      }),
                    )
                  }
                >
                  <Field label="Active ICU stay">
                    <select
                      required
                      value={transferForm.stay_id}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          stay_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select stay</option>
                      {stays
                        .filter((stay) => stay.stay_status === "active")
                        .map((stay) => (
                          <option key={stay.id} value={stay.id}>
                            {stay.stay_number} · {stay.bed_code}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Destination bed">
                    <select
                      required
                      value={transferForm.to_bed_id}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          to_bed_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select available bed</option>
                      {beds
                        .filter((bed) => bed.bed_status === "available")
                        .map((bed) => (
                          <option key={bed.id} value={bed.id}>
                            {bed.bed_code} · {bed.unit_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Transfer reason">
                    <input
                      required
                      value={transferForm.transfer_reason}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          transfer_reason: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      rows="3"
                      value={transferForm.notes}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          notes: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <button className="icu-button" disabled={saving}>
                    <FiPlus /> Complete transfer
                  </button>
                </form>
              </section>
              <section className="icu-panel">
                <h2>Transfer history</h2>
                <div className="icu-table-wrap">
                  <table className="icu-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Reason</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {new Date(item.requested_at).toLocaleString()}
                          </td>
                          <td>{item.from_bed_code}</td>
                          <td>{item.to_bed_code}</td>
                          <td>{item.transfer_reason}</td>
                          <td>
                            <span className="icu-status">
                              {item.transfer_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!transfers.length && (
                    <p className="icu-muted">No transfers recorded.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
      <footer className="icu-footer">
        <FiAlertCircle /> Clinical records must be reviewed by authorized care
        staff.
      </footer>
    </main>
  );
}

function StayTable({ stays, onSelect, onDischarge }) {
  return (
    <div className="icu-table-wrap">
      <table className="icu-table">
        <thead>
          <tr>
            <th>Stay number</th>
            <th>Bed</th>
            <th>Reason</th>
            <th>Admitted</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {stays.map((stay) => (
            <tr key={stay.id}>
              <td>{stay.stay_number}</td>
              <td>{stay.bed_code || "—"}</td>
              <td>{stay.admission_reason}</td>
              <td>{new Date(stay.admitted_at).toLocaleString()}</td>
              <td>
                <span className={`icu-status status-${stay.stay_status}`}>
                  {stay.stay_status}
                </span>
              </td>
              <td className="icu-actions">
                {onSelect && (
                  <button
                    className="icu-link-button"
                    onClick={() => onSelect(stay.id)}
                  >
                    Clinical records
                  </button>
                )}
                {onDischarge && stay.stay_status === "active" && (
                  <button
                    className="icu-link-button danger"
                    onClick={() => onDischarge(stay)}
                  >
                    Discharge
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!stays.length && <p className="icu-muted">No ICU stays found.</p>}
    </div>
  );
}

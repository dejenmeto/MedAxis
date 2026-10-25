import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiClipboard,
  FiEdit2,
  FiHeart,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import maternityService from "../../services/maternity.service";
import "./Maternity.css";

const RESOURCES = [
  {
    key: "pregnancies",
    title: "Pregnancies",
    icon: FiUsers,
    description: "Maternal registration and pregnancy history",
    fields: [
      ["patient_id", "Patient ID", "number", true],
      ["pregnancy_number", "Pregnancy number", "text", true],
      ["admission_id", "Inpatient admission UUID", "uuid"],
      ["gravida", "Gravida", "number"],
      ["para", "Para", "number"],
      ["abortions", "Previous abortions", "number"],
      ["living_children", "Living children", "number"],
      ["last_menstrual_period", "Last menstrual period", "date"],
      ["estimated_delivery_date", "Expected delivery date", "date"],
      ["actual_delivery_date", "Actual delivery date", "date"],
      ["gestational_age_weeks", "Gestational age (weeks)", "number"],
      ["gestational_age_days", "Additional gestational days", "number"],
      [
        "pregnancy_type",
        "Pregnancy type",
        "select",
        false,
        ["singleton", "multiple"],
      ],
      [
        "blood_group",
        "Blood group",
        "select",
        false,
        ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      ],
      [
        "rhesus_factor",
        "Rhesus factor",
        "select",
        false,
        ["positive", "negative"],
      ],
      [
        "risk_level",
        "Risk level",
        "select",
        false,
        ["low", "moderate", "high", "critical"],
      ],
      [
        "pregnancy_status",
        "Pregnancy status",
        "select",
        false,
        [
          "antenatal",
          "in_labor",
          "delivered",
          "postpartum",
          "pregnancy_loss",
          "cancelled",
        ],
      ],
      ["assigned_staff_id", "Assigned staff ID", "number"],
      ["medical_history", "Medical history", "textarea"],
      ["obstetric_history", "Obstetric history", "textarea"],
      ["allergies", "Allergies", "textarea"],
      ["notes", "Notes", "textarea"],
    ],
    columns: [
      "pregnancy_number",
      "patient_id",
      "pregnancy_status",
      "risk_level",
      "estimated_delivery_date",
    ],
    label: "pregnancy_number",
  },
  {
    key: "antenatal-visits",
    title: "Antenatal Care",
    icon: FiCalendar,
    description: "Prenatal visits and clinical assessments",
    fields: [
      ["maternity_record_id", "Pregnancy record UUID", "uuid", true],
      ["visit_number", "Visit number", "number", true],
      ["visit_date", "Visit date and time", "datetime"],
      ["gestational_age_weeks", "Gestational age (weeks)", "number"],
      ["gestational_age_days", "Additional gestational days", "number"],
      ["systolic_bp", "Systolic blood pressure", "number"],
      ["diastolic_bp", "Diastolic blood pressure", "number"],
      ["weight_kg", "Weight (kg)", "number"],
      ["temperature_c", "Temperature (°C)", "number"],
      ["fetal_heart_rate", "Fetal heart rate", "number"],
      ["fundal_height_cm", "Fundal height (cm)", "number"],
      ["urine_protein", "Urine protein", "text"],
      ["urine_glucose", "Urine glucose", "text"],
      ["hemoglobin_g_dl", "Hemoglobin (g/dL)", "number"],
      ["symptoms", "Symptoms", "textarea"],
      ["examination_findings", "Examination findings", "textarea"],
      ["assessment", "Clinical assessment", "textarea"],
      ["treatment_plan", "Treatment plan", "textarea"],
      ["danger_signs", "Danger signs", "textarea"],
      ["next_visit_date", "Next visit date", "date"],
      ["attended_by", "Attending staff ID", "number"],
    ],
    columns: [
      "visit_number",
      "maternity_record_id",
      "visit_date",
      "gestational_age_weeks",
      "next_visit_date",
    ],
    label: "visit_number",
  },
  {
    key: "labor",
    title: "Labor Records",
    icon: FiActivity,
    description: "Labor episodes and progress",
    fields: [
      ["maternity_record_id", "Pregnancy record UUID", "uuid", true],
      ["admission_id", "Inpatient admission UUID", "uuid"],
      ["labor_number", "Labor number", "text", true],
      ["labor_onset_at", "Labor onset", "datetime"],
      ["membrane_rupture_at", "Membrane rupture", "datetime"],
      ["full_dilation_at", "Full dilation time", "datetime"],
      ["delivery_started_at", "Delivery started at", "datetime"],
      ["labor_completed_at", "Labor completed at", "datetime"],
      [
        "labor_status",
        "Labor status",
        "select",
        false,
        ["active", "completed", "transferred", "cancelled"],
      ],
      ["presentation", "Presentation", "text"],
      ["induction_method", "Induction method", "text"],
      ["analgesia_method", "Analgesia method", "text"],
      [
        "membrane_status",
        "Membrane status",
        "select",
        false,
        ["intact", "ruptured", "unknown"],
      ],
      ["complications", "Complications", "textarea"],
      ["clinical_notes", "Clinical notes", "textarea"],
      ["attending_staff_id", "Attending staff ID", "number"],
    ],
    columns: [
      "labor_number",
      "maternity_record_id",
      "labor_status",
      "labor_onset_at",
    ],
    label: "labor_number",
  },
  {
    key: "fetal-observations",
    title: "Fetal Monitoring",
    icon: FiActivity,
    description: "Fetal and maternal labor observations",
    fields: [
      ["labor_record_id", "Labor record UUID", "uuid", true],
      ["observed_at", "Observation date and time", "datetime"],
      ["fetal_heart_rate", "Fetal heart rate", "number"],
      [
        "contraction_frequency_per_10_min",
        "Contractions per 10 minutes",
        "number",
      ],
      [
        "contraction_duration_seconds",
        "Contraction duration (seconds)",
        "number",
      ],
      ["cervical_dilation_cm", "Cervical dilation (cm)", "number"],
      ["cervical_effacement_percent", "Cervical effacement (%)", "number"],
      ["fetal_station", "Fetal station", "number"],
      ["maternal_systolic_bp", "Maternal systolic BP", "number"],
      ["maternal_diastolic_bp", "Maternal diastolic BP", "number"],
      ["maternal_pulse", "Maternal pulse", "number"],
      ["notes", "Notes", "textarea"],
    ],
    columns: [
      "labor_record_id",
      "observed_at",
      "fetal_heart_rate",
      "cervical_dilation_cm",
    ],
    label: "observed_at",
  },
  {
    key: "deliveries",
    title: "Deliveries",
    icon: FiHeart,
    description: "Delivery details and outcomes",
    fields: [
      ["maternity_record_id", "Pregnancy record UUID", "uuid", true],
      ["labor_record_id", "Labor record UUID", "uuid", true],
      ["delivery_number", "Delivery number", "text", true],
      ["delivery_at", "Delivery date and time", "datetime"],
      [
        "delivery_method",
        "Delivery method",
        "select",
        true,
        ["vaginal", "assisted_vaginal", "cesarean", "other"],
      ],
      [
        "delivery_outcome",
        "Delivery outcome",
        "select",
        true,
        ["live_birth", "stillbirth", "mixed", "pregnancy_loss"],
      ],
      ["placenta_delivered_at", "Placenta delivered at", "datetime"],
      ["placenta_complete", "Placenta complete", "checkbox"],
      ["blood_loss_ml", "Blood loss (mL)", "number"],
      ["episiotomy_performed", "Episiotomy performed", "checkbox"],
      ["perineal_tear_degree", "Perineal tear degree", "number"],
      ["maternal_complications", "Maternal complications", "textarea"],
      ["newborn_complications", "Newborn complications", "textarea"],
      ["delivery_notes", "Delivery notes", "textarea"],
      ["attending_staff_id", "Attending staff ID", "number"],
    ],
    columns: [
      "delivery_number",
      "delivery_at",
      "delivery_method",
      "delivery_outcome",
    ],
    label: "delivery_number",
  },
  {
    key: "newborns",
    title: "Newborns",
    icon: FiHeart,
    description: "Newborn details and initial assessments",
    fields: [
      ["delivery_id", "Delivery record UUID", "uuid", true],
      ["maternity_record_id", "Pregnancy record UUID", "uuid", true],
      ["patient_id", "Registered patient ID (optional)", "number"],
      ["newborn_number", "Newborn number", "number"],
      ["newborn_identifier", "Newborn identifier", "text"],
      ["date_of_birth", "Date of birth", "datetime"],
      [
        "sex",
        "Sex",
        "select",
        false,
        ["female", "male", "indeterminate", "unknown"],
      ],
      ["birth_weight_grams", "Birth weight (grams)", "number"],
      ["length_cm", "Length (cm)", "number"],
      ["head_circumference_cm", "Head circumference (cm)", "number"],
      ["apgar_1_min", "Apgar score (1 minute)", "number"],
      ["apgar_5_min", "Apgar score (5 minutes)", "number"],
      ["apgar_10_min", "Apgar score (10 minutes)", "number"],
      ["resuscitation_required", "Resuscitation required", "checkbox"],
      ["resuscitation_details", "Resuscitation details", "textarea"],
      [
        "feeding_method",
        "Feeding method",
        "select",
        false,
        ["breastfeeding", "formula", "mixed", "not_started", "other"],
      ],
      [
        "newborn_status",
        "Newborn status",
        "select",
        false,
        ["stable", "observation", "nicu", "transferred", "deceased"],
      ],
      ["congenital_conditions", "Congenital conditions", "textarea"],
      ["clinical_notes", "Clinical notes", "textarea"],
    ],
    columns: [
      "newborn_identifier",
      "delivery_id",
      "date_of_birth",
      "sex",
      "birth_weight_grams",
      "newborn_status",
    ],
    label: "newborn_identifier",
  },
  {
    key: "postnatal-visits",
    title: "Postnatal Care",
    icon: FiClipboard,
    description: "Maternal recovery and newborn follow-up",
    fields: [
      ["maternity_record_id", "Pregnancy record UUID", "uuid", true],
      ["newborn_id", "Newborn UUID (optional)", "uuid"],
      ["visit_number", "Visit number", "number", true],
      [
        "visit_type",
        "Visit type",
        "select",
        true,
        ["maternal", "newborn", "combined"],
      ],
      ["visit_at", "Visit date and time", "datetime"],
      ["next_visit_date", "Next visit date", "date"],
      ["maternal_systolic_bp", "Maternal systolic BP", "number"],
      ["maternal_diastolic_bp", "Maternal diastolic BP", "number"],
      ["maternal_temperature_c", "Maternal temperature (°C)", "number"],
      ["maternal_assessment", "Maternal assessment", "textarea"],
      ["maternal_treatment_plan", "Maternal treatment plan", "textarea"],
      ["newborn_assessment", "Newborn assessment", "textarea"],
      ["newborn_feeding_notes", "Newborn feeding notes", "textarea"],
      ["danger_signs", "Danger signs", "textarea"],
      ["counseling_notes", "Counseling notes", "textarea"],
      ["attended_by", "Attending staff ID", "number"],
    ],
    columns: [
      "visit_number",
      "maternity_record_id",
      "visit_type",
      "visit_at",
      "next_visit_date",
    ],
    label: "visit_number",
  },
];

const EMPTY_SUMMARY = {
  total_pregnancies: 0,
  antenatal: 0,
  in_labor: 0,
  high_risk: 0,
  deliveries_this_month: 0,
  newborns_this_month: 0,
};

function emptyForm(resource) {
  return Object.fromEntries(
    resource.fields.map(([name, , type]) => [
      name,
      type === "checkbox" ? false : "",
    ]),
  );
}

function unwrap(response) {
  return response?.data?.data ?? [];
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function fieldType(type) {
  if (type === "datetime") return "datetime-local";
  if (type === "date") return "date";
  if (type === "number") return "number";
  return "text";
}

function formatForInput(value, type) {
  if (!value) return "";
  if (type === "date") return String(value).slice(0, 10);
  if (type === "datetime") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  return value;
}

export default function Maternity() {
  const [activeKey, setActiveKey] = useState("pregnancies");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const activeResource = useMemo(
    () => RESOURCES.find((item) => item.key === activeKey) ?? RESOURCES[0],
    [activeKey],
  );

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [summaryResult, recordsResult] = await Promise.all([
        maternityService.getSummary(),
        maternityService.getRecords(activeKey, {
          page,
          limit: 10,
          search,
        }),
      ]);

      setSummary({
        ...EMPTY_SUMMARY,
        ...(summaryResult?.data?.data ?? {}),
      });

      setRecords(unwrap(recordsResult));
      setPagination(
        recordsResult?.data?.pagination ?? { page, limit: 10, total: 0 },
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to load maternity records.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeKey, page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setForm(emptyForm(activeResource));
    setEditingId(null);
    setShowForm(false);
  }, [activeResource]);

  const changeTab = (key) => {
    setActiveKey(key);
    setPage(1);
    setSearch("");
  };

  const startCreate = () => {
    setForm(emptyForm(activeResource));
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (record) => {
    const next = emptyForm(activeResource);

    for (const [name, , type] of activeResource.fields) {
      next[name] =
        type === "checkbox"
          ? Boolean(record[name])
          : formatForInput(record[name], type);
    }

    setForm(next);
    setEditingId(record.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {};

    for (const [name, , type] of activeResource.fields) {
      const value = form[name];

      if (type === "checkbox") {
        payload[name] = Boolean(value);
      } else if (value === "" || value === undefined) {
        payload[name] = null;
      } else if (type === "number") {
        payload[name] = Number(value);
      } else {
        payload[name] = value;
      }
    }

    try {
      if (editingId) {
        await maternityService.updateRecord(activeKey, editingId, payload);
        toast.success("Maternity record updated.");
      } else {
        await maternityService.createRecord(activeKey, payload);
        toast.success("Maternity record created.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm(activeResource));
      await loadData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to save this record.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record) => {
    const label = record[activeResource.label] || record.id;
    const confirmed = window.confirm(
      `Delete "${label}"? This cannot be undone if no linked records prevent deletion.`,
    );

    if (!confirmed) return;

    try {
      await maternityService.deleteRecord(activeKey, record.id);
      toast.success("Record deleted.");
      await loadData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Unable to delete this record. It may be linked to other clinical records.",
      );
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
  );

  const summaryCards = [
    ["Total pregnancies", summary.total_pregnancies, FiUsers],
    ["Antenatal", summary.antenatal, FiCalendar],
    ["In labor", summary.in_labor, FiActivity],
    ["High risk", summary.high_risk, FiHeart],
    ["Deliveries this month", summary.deliveries_this_month, FiClipboard],
    ["Newborns this month", summary.newborns_this_month, FiHeart],
  ];

  return (
    <main className="maternity-page">
      <header className="maternity-header">
        <div>
          <span className="maternity-eyebrow">MEDAXIS / CLINICAL SERVICES</span>
          <h1>Maternity &amp; Women’s Health</h1>
          <p>
            Manage pregnancy, antenatal care, labor, delivery and postnatal
            records.
          </p>
        </div>

        <button className="maternity-button primary" onClick={startCreate}>
          <FiPlus /> Add {activeResource.title.replace(/s$/, "")}
        </button>
      </header>

      <section className="maternity-summary">
        {summaryCards.map(([label, value, Icon]) => (
          <article className="maternity-stat" key={label}>
            <span className="maternity-stat-icon">
              <Icon />
            </span>
            <div>
              <p>{label}</p>
              <strong>{Number(value || 0).toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <nav className="maternity-tabs" aria-label="Maternity sections">
        {RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <button
              key={resource.key}
              className={activeKey === resource.key ? "active" : ""}
              onClick={() => changeTab(resource.key)}
            >
              <Icon />
              <span>{resource.title}</span>
            </button>
          );
        })}
      </nav>

      {showForm && (
        <section className="maternity-panel maternity-form-panel">
          <div className="maternity-panel-heading">
            <div>
              <h2>{editingId ? "Edit record" : "Create record"}</h2>
              <p>{activeResource.description}</p>
            </div>
            <button
              className="maternity-icon-button"
              type="button"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              <FiX />
            </button>
          </div>

          <form onSubmit={submitForm}>
            <div className="maternity-form-grid">
              {activeResource.fields.map(
                ([name, label, type, required, options]) => (
                  <label
                    className={`maternity-field ${type === "textarea" ? "wide" : ""} ${type === "checkbox" ? "check-field" : ""}`}
                    key={name}
                  >
                    {type === "checkbox" ? (
                      <>
                        <input
                          type="checkbox"
                          checked={Boolean(form[name])}
                          onChange={(event) =>
                            updateField(name, event.target.checked)
                          }
                        />
                        <span>{label}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {label}
                          {required ? " *" : ""}
                        </span>

                        {type === "textarea" ? (
                          <textarea
                            value={form[name] ?? ""}
                            onChange={(event) =>
                              updateField(name, event.target.value)
                            }
                            rows={3}
                            required={Boolean(required)}
                          />
                        ) : type === "select" ? (
                          <select
                            value={form[name] ?? ""}
                            onChange={(event) =>
                              updateField(name, event.target.value)
                            }
                            required={Boolean(required)}
                          >
                            <option value="">Select…</option>
                            {(options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={fieldType(type)}
                            value={form[name] ?? ""}
                            onChange={(event) =>
                              updateField(name, event.target.value)
                            }
                            required={Boolean(required)}
                            min={
                              type === "number"
                                ? name === "fetal_station"
                                  ? -5
                                  : 0
                                : undefined
                            }
                            step={type === "number" ? "any" : undefined}
                            placeholder={
                              type === "uuid" ? "Enter the existing UUID" : ""
                            }
                          />
                        )}
                      </>
                    )}
                  </label>
                ),
              )}
            </div>

            <div className="maternity-form-actions">
              <button
                className="maternity-button secondary"
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="maternity-button primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create record"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="maternity-panel">
        <div className="maternity-panel-heading records-heading">
          <div>
            <h2>{activeResource.title}</h2>
            <p>{activeResource.description}</p>
          </div>

          <button
            className="maternity-icon-button"
            type="button"
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh records"
          >
            <FiRefreshCw className={loading ? "spinning" : ""} />
          </button>
        </div>

        <div className="maternity-toolbar">
          <label className="maternity-search">
            <FiSearch />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${activeResource.title.toLowerCase()}…`}
            />
          </label>

          <span className="maternity-record-count">
            {pagination.total || 0} record(s)
          </span>
        </div>

        <div className="maternity-table-wrap">
          <table className="maternity-table">
            <thead>
              <tr>
                {activeResource.columns.map((column) => (
                  <th key={column}>{column.replaceAll("_", " ")}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={activeResource.columns.length + 1}
                    className="maternity-empty"
                  >
                    Loading records…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeResource.columns.length + 1}
                    className="maternity-empty"
                  >
                    <FiClipboard />
                    <strong>No records found</strong>
                    <span>Create a record or change your search.</span>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    {activeResource.columns.map((column) => (
                      <td key={column}>
                        {column.endsWith("_status") ||
                        column === "risk_level" ? (
                          <span
                            className={`maternity-status ${String(record[column] || "").toLowerCase()}`}
                          >
                            {displayValue(record[column]).replaceAll("_", " ")}
                          </span>
                        ) : (
                          displayValue(record[column])
                        )}
                      </td>
                    ))}

                    <td>
                      <div className="maternity-row-actions">
                        <button
                          className="maternity-icon-button edit"
                          type="button"
                          onClick={() => startEdit(record)}
                          title="Edit record"
                          aria-label="Edit record"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          className="maternity-icon-button delete"
                          type="button"
                          onClick={() => deleteRecord(record)}
                          title="Delete record"
                          aria-label="Delete record"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="maternity-pagination">
          <span>
            Page {page} of {totalPages}
          </span>
          <div>
            <button
              className="maternity-button secondary"
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <button
              className="maternity-button secondary"
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

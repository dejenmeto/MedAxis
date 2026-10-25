import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiDroplet,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
  FiPackage,
  FiUsers,
  FiClipboard,
} from "react-icons/fi";
import toast from "react-hot-toast";
import bloodBankService from "../../services/bloodBank.service";
import "./BloodBank.css";

const RESOURCES = {
  donors: {
    label: "Donors",
    icon: FiUsers,
    columns: [
      "donor_number",
      "first_name",
      "last_name",
      "blood_group",
      "rh_type",
      "phone",
      "eligibility_status",
    ],
    fields: [
      ["donor_number", "Donor number", "text", true],
      ["first_name", "First name", "text", true],
      ["last_name", "Last name", "text", true],
      ["date_of_birth", "Date of birth", "date"],
      ["sex", "Sex", "select", false, ["female", "male", "other", "unknown"]],
      ["phone", "Phone", "text"],
      ["email", "Email", "email"],
      ["blood_group", "ABO group", "select", false, ["A", "B", "AB", "O"]],
      [
        "rh_type",
        "Rh type",
        "select",
        false,
        ["positive", "negative", "unknown"],
      ],
      [
        "eligibility_status",
        "Eligibility",
        "select",
        false,
        ["pending", "eligible", "deferred", "permanently_deferred"],
      ],
      ["last_donation_date", "Last donation date", "date"],
      ["address", "Address", "text"],
      ["notes", "Notes", "textarea"],
    ],
  },

  donations: {
    label: "Donations",
    icon: FiDroplet,
    columns: [
      "donation_number",
      "donor_id",
      "donated_at",
      "donation_type",
      "volume_ml",
      "collection_status",
    ],
    fields: [
      ["donation_number", "Donation number", "text", true],
      ["donor_id", "Donor UUID", "text", true],
      ["donated_at", "Donation date/time", "datetime-local"],
      [
        "donation_type",
        "Donation type",
        "select",
        false,
        ["whole_blood", "apheresis", "autologous", "other"],
      ],
      ["volume_ml", "Volume (ml)", "number", true],
      [
        "collection_status",
        "Collection status",
        "select",
        false,
        ["collected", "processing", "completed", "discarded", "cancelled"],
      ],
      ["notes", "Notes", "textarea"],
    ],
  },

  screening: {
    label: "Screening tests",
    icon: FiActivity,
    columns: ["donation_id", "test_name", "result", "tested_at"],
    fields: [
      ["donation_id", "Donation UUID", "text", true],
      ["test_name", "Test name", "text", true],
      [
        "result",
        "Test result",
        "select",
        true,
        [
          "negative",
          "positive",
          "reactive",
          "non_reactive",
          "inconclusive",
          "pending",
        ],
      ],
      ["tested_at", "Tested at", "datetime-local"],
      ["notes", "Notes", "textarea"],
    ],
  },

  units: {
    label: "Blood inventory",
    icon: FiPackage,
    columns: [
      "unit_number",
      "component_type",
      "blood_group",
      "rh_type",
      "status",
      "expires_at",
    ],
    fields: [
      ["unit_number", "Unit / bag number", "text", true],
      ["donation_id", "Donation UUID", "text", true],
      [
        "component_type",
        "Component",
        "select",
        true,
        [
          "whole_blood",
          "red_cells",
          "platelets",
          "plasma",
          "cryoprecipitate",
          "other",
        ],
      ],
      ["blood_group", "ABO group", "select", true, ["A", "B", "AB", "O"]],
      ["rh_type", "Rh type", "select", true, ["positive", "negative"]],
      ["volume_ml", "Volume (ml)", "number"],
      ["collected_at", "Collected at", "datetime-local"],
      ["expires_at", "Expires at", "datetime-local", true],
      ["storage_location", "Storage location", "text"],
      ["notes", "Notes", "textarea"],
    ],
  },

  requests: {
    label: "Blood requests",
    icon: FiClipboard,
    columns: [
      "request_number",
      "patient_id",
      "requested_component",
      "blood_group",
      "rh_type",
      "units_requested",
      "urgency",
      "status",
    ],
    fields: [
      ["request_number", "Request number", "text", true],
      ["patient_id", "Patient database ID", "number", true],
      [
        "requested_component",
        "Requested component",
        "select",
        true,
        [
          "whole_blood",
          "red_cells",
          "platelets",
          "plasma",
          "cryoprecipitate",
          "other",
        ],
      ],
      ["blood_group", "ABO group", "select", true, ["A", "B", "AB", "O"]],
      [
        "rh_type",
        "Rh type",
        "select",
        true,
        ["positive", "negative", "unknown"],
      ],
      ["units_requested", "Units requested", "number", true],
      [
        "urgency",
        "Urgency",
        "select",
        false,
        ["routine", "urgent", "emergency"],
      ],
      ["clinical_indication", "Clinical indication", "textarea", true],
      ["needed_by", "Needed by", "datetime-local"],
      ["notes", "Notes", "textarea"],
    ],
  },

  crossmatches: {
    label: "Compatibility tests",
    icon: FiActivity,
    columns: ["request_id", "blood_unit_id", "result", "tested_at"],
    fields: [
      ["request_id", "Request UUID", "text", true],
      ["blood_unit_id", "Blood unit UUID", "text", true],
      [
        "result",
        "Crossmatch result",
        "select",
        true,
        ["compatible", "incompatible", "pending", "inconclusive"],
      ],
      ["tested_at", "Tested at", "datetime-local"],
      ["notes", "Notes", "textarea"],
    ],
  },

  issues: {
    label: "Issue records",
    icon: FiPackage,
    columns: [
      "issue_number",
      "request_id",
      "blood_unit_id",
      "received_by_name",
      "destination",
      "issued_at",
    ],
    fields: [
      ["issue_number", "Issue number", "text", true],
      ["request_id", "Request UUID", "text", true],
      ["blood_unit_id", "Blood unit UUID", "text", true],
      ["received_by_name", "Received by", "text"],
      ["destination", "Ward / destination", "text"],
      ["notes", "Notes", "textarea"],
    ],
  },
};

const EMPTY_SUMMARY = {
  donors: { total: 0, eligible: 0 },
  donations: { total: 0, last_30_days: 0 },
  availableUnits: 0,
  requests: { total: 0, urgent: 0 },
  expiringWithin7Days: 0,
  stockByBloodGroup: [],
};

function pretty(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

function displayValue(field, value) {
  if (value === null || value === undefined) return "";
  if (field[2] === "datetime-local" && value) {
    return String(value).slice(0, 16);
  }
  return String(value);
}

export default function BloodBank() {
  const [active, setActive] = useState("units");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const config = RESOURCES[active];

  const loadSummary = useCallback(async () => {
    try {
      const response = await bloodBankService.getSummary();
      setSummary(response.data?.data || EMPTY_SUMMARY);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Could not load the blood bank summary.",
      );
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);

    try {
      const response = await bloodBankService.getRecords(active, {
        search,
        page,
        limit: 10,
      });

      setRecords(response.data?.data || []);
      setPagination(
        response.data?.pagination || { page: 1, pages: 1, total: 0 },
      );
    } catch (error) {
      setRecords([]);
      toast.error(
        error.response?.data?.message || `Could not load ${config.label}.`,
      );
    } finally {
      setLoading(false);
    }
  }, [active, search, page, config.label]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  function openCreate() {
    setEditing(null);

    const initial = {};
    config.fields.forEach(([name]) => {
      initial[name] = "";
    });

    if (active === "donations") initial.volume_ml = "450";
    if (active === "requests") {
      initial.units_requested = "1";
      initial.urgency = "routine";
    }

    setForm(initial);
    setModalOpen(true);
  }

  function openEdit(record) {
    setEditing(record);

    const initial = {};
    config.fields.forEach((field) => {
      initial[field[0]] = displayValue(field, record[field[0]]);
    });

    setForm(initial);
    setModalOpen(true);
  }

  function changeField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {};

    config.fields.forEach(([key, , type]) => {
      if (form[key] === "" || form[key] === undefined) return;

      if (type === "number") {
        payload[key] = Number(form[key]);
      } else if (type === "datetime-local") {
        payload[key] = new Date(form[key]).toISOString();
      } else {
        payload[key] = form[key];
      }
    });

    try {
      if (active === "issues" && !editing) {
        await bloodBankService.issueUnit(payload);
      } else if (editing) {
        await bloodBankService.updateRecord(active, editing.id, payload);
      } else {
        await bloodBankService.createRecord(active, payload);
      }

      toast.success(editing ? "Record updated." : "Record saved.");
      setModalOpen(false);
      await Promise.all([loadRecords(), loadSummary()]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save the record.",
      );
      console.error(
        "Blood bank request failed:",
        error.response?.data || error,
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(record) {
    if (
      !window.confirm(
        "Delete this record? Linked records may prevent deletion.",
      )
    ) {
      return;
    }

    try {
      await bloodBankService.deleteRecord(active, record.id);
      toast.success("Record deleted.");
      await Promise.all([loadRecords(), loadSummary()]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not delete the record.",
      );
    }
  }

  return (
    <main className="blood-bank-page">
      <header className="bb-page-header">
        <div>
          <span className="bb-eyebrow">MEDAXIS · CLINICAL SERVICES</span>
          <h1>Blood Bank Management</h1>
          <p>
            Manage donors, donations, screening, inventory, requests, and
            issues.
          </p>
        </div>

        <button
          className="bb-btn bb-btn-secondary"
          onClick={() => {
            loadSummary();
            loadRecords();
          }}
          disabled={loading}
        >
          <FiRefreshCw /> Refresh
        </button>
      </header>

      <section className="bb-stat-grid">
        <article className="bb-stat-card">
          <span className="bb-stat-icon">
            <FiUsers />
          </span>
          <div>
            <p>Registered donors</p>
            <strong>{summary.donors?.total ?? 0}</strong>
            <small>{summary.donors?.eligible ?? 0} eligible</small>
          </div>
        </article>

        <article className="bb-stat-card">
          <span className="bb-stat-icon">
            <FiDroplet />
          </span>
          <div>
            <p>Available units</p>
            <strong>{summary.availableUnits ?? 0}</strong>
            <small>Cleared and unexpired</small>
          </div>
        </article>

        <article className="bb-stat-card">
          <span className="bb-stat-icon">
            <FiClipboard />
          </span>
          <div>
            <p>Open requests</p>
            <strong>{summary.requests?.total ?? 0}</strong>
            <small>{summary.requests?.urgent ?? 0} urgent / emergency</small>
          </div>
        </article>

        <article
          className={`bb-stat-card ${summary.expiringWithin7Days ? "bb-stat-warning" : ""}`}
        >
          <span className="bb-stat-icon">
            <FiAlertTriangle />
          </span>
          <div>
            <p>Expiring within 7 days</p>
            <strong>{summary.expiringWithin7Days ?? 0}</strong>
            <small>Review stock promptly</small>
          </div>
        </article>
      </section>

      <section className="bb-stock-panel">
        <h2>Available stock by blood group</h2>
        <p>Only cleared and unexpired units are counted.</p>

        <div className="bb-stock-chips">
          {summary.stockByBloodGroup?.length ? (
            summary.stockByBloodGroup.map((item) => (
              <span
                key={`${item.blood_group}-${item.rh_type}`}
                className="bb-stock-chip"
              >
                <b>
                  {item.blood_group}
                  {item.rh_type === "positive" ? "+" : "−"}
                </b>
                <strong>{item.units}</strong>
                <small>units</small>
              </span>
            ))
          ) : (
            <span className="bb-empty-inline">
              No eligible stock is available.
            </span>
          )}
        </div>
      </section>

      <section className="bb-workspace">
        <nav className="bb-resource-tabs" aria-label="Blood bank resources">
          {Object.entries(RESOURCES).map(([key, item]) => {
            const Icon = item.icon;

            return (
              <button
                key={key}
                className={
                  active === key ? "bb-resource-tab active" : "bb-resource-tab"
                }
                onClick={() => {
                  setActive(key);
                  setSearch("");
                  setPage(1);
                }}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="bb-table-panel">
          <div className="bb-table-heading">
            <div>
              <h2>{config.label}</h2>
              <p>{pagination.total} total records</p>
            </div>

            <button className="bb-btn bb-btn-primary" onClick={openCreate}>
              <FiPlus /> Add record
            </button>
          </div>

          <div className="bb-filters">
            <label className="bb-search">
              <FiSearch />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={`Search ${config.label.toLowerCase()}...`}
              />
            </label>
          </div>

          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column}>{pretty(column)}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={config.columns.length + 1}
                      className="bb-table-state"
                    >
                      Loading records…
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={config.columns.length + 1}
                      className="bb-table-state"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      {config.columns.map((column) => (
                        <td key={column}>
                          <span
                            className={
                              [
                                "status",
                                "eligibility_status",
                                "result",
                              ].includes(column)
                                ? `bb-status bb-status-${String(record[column] || "").replaceAll("_", "-")}`
                                : ""
                            }
                          >
                            {pretty(record[column])}
                          </span>
                        </td>
                      ))}

                      <td>
                        <div className="bb-row-actions">
                          {active !== "issues" && (
                            <button
                              title="Edit record"
                              onClick={() => openEdit(record)}
                            >
                              <FiEdit2 />
                            </button>
                          )}
                          <button
                            title="Delete record"
                            onClick={() => removeRecord(record)}
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

          <div className="bb-pagination">
            <span>
              Page {pagination.page || page} of{" "}
              {Math.max(1, pagination.pages || 1)}
            </span>

            <div>
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <button
                disabled={page >= (pagination.pages || 1) || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </section>

      {modalOpen && (
        <div
          className="bb-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section className="bb-modal" role="dialog" aria-modal="true">
            <div className="bb-modal-header">
              <div>
                <span className="bb-eyebrow">
                  {editing ? "UPDATE RECORD" : "NEW RECORD"}
                </span>
                <h2>
                  {editing ? "Edit" : "Add"} {config.label}
                </h2>
              </div>
              <button
                className="bb-icon-button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={submit}>
              <div className="bb-form-grid">
                {config.fields.map(([key, label, type, required, options]) => (
                  <label
                    className={
                      type === "textarea"
                        ? "bb-field bb-field-wide"
                        : "bb-field"
                    }
                    key={key}
                  >
                    <span>
                      {label}
                      {required && <b> *</b>}
                    </span>

                    {type === "select" ? (
                      <select
                        required={Boolean(required)}
                        value={form[key] ?? ""}
                        onChange={(event) =>
                          changeField(key, event.target.value)
                        }
                      >
                        <option value="">Select…</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {pretty(option)}
                          </option>
                        ))}
                      </select>
                    ) : type === "textarea" ? (
                      <textarea
                        rows="3"
                        required={Boolean(required)}
                        value={form[key] ?? ""}
                        onChange={(event) =>
                          changeField(key, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        required={Boolean(required)}
                        type={type || "text"}
                        min={type === "number" ? 1 : undefined}
                        value={form[key] ?? ""}
                        onChange={(event) =>
                          changeField(key, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>

              <p className="bb-form-note">
                <FiAlertTriangle />
                Use real IDs for linked records. Newly created inventory units
                must undergo the approved screening and release workflow before
                they can be issued.
              </p>

              <div className="bb-modal-actions">
                <button
                  type="button"
                  className="bb-btn bb-btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bb-btn bb-btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Create record"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

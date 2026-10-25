import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiShield,
  FiUsers,
  FiFileText,
  FiDollarSign,
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import insuranceService from "../../services/insurance.service";
import "./Insurance.css";

const CONFIG = {
  providers: {
    label: "Providers",
    singular: "Provider",
    fields: [
      ["provider_code", "Provider code", "text", true],
      ["name", "Provider name", "text", true],
      ["contact_person", "Contact person", "text"],
      ["phone", "Phone", "text"],
      ["email", "Email", "email"],
      ["address", "Address", "textarea"],
      ["is_active", "Active", "boolean"],
    ],
    search: ["name", "provider_code", "email"],
  },
  policies: {
    label: "Policies",
    singular: "Policy",
    fields: [
      ["provider_id", "Insurance provider", "provider"],
      ["patient_id", "Patient ID", "number", true],
      ["policy_number", "Policy number", "text", true],
      ["member_number", "Member number", "text"],
      ["plan_name", "Plan name", "text"],
      ["coverage_percent", "Coverage percent", "number", true],
      ["coverage_limit", "Coverage limit (ETB)", "number"],
      ["start_date", "Start date", "date", true],
      ["end_date", "End date", "date"],
      ["status", "Status", "policyStatus"],
      ["notes", "Notes", "textarea"],
    ],
    search: ["policy_number", "member_number", "plan_name"],
  },
  claims: {
    label: "Claims",
    singular: "Claim",
    fields: [
      ["claim_number", "Claim number", "text", true],
      ["policy_id", "Patient policy", "policy", true],
      ["patient_id", "Patient ID", "number", true],
      ["invoice_reference", "Invoice reference", "text"],
      ["service_date", "Service date", "date", true],
      ["claim_amount", "Claim amount (ETB)", "number", true],
      ["currency", "Currency", "currency"],
      ["diagnosis_summary", "Diagnosis summary", "textarea"],
      ["claim_notes", "Claim notes", "textarea"],
    ],
    search: ["claim_number", "invoice_reference", "status"],
  },
  reimbursements: {
    label: "Reimbursements",
    singular: "Reimbursement",
    fields: [
      ["claim_id", "Insurance claim", "claim", true],
      ["reimbursement_reference", "Reimbursement reference", "text", true],
      ["amount", "Amount (ETB)", "number", true],
      ["payment_date", "Payment date", "date"],
      ["payment_method", "Payment method", "paymentMethod"],
      ["notes", "Notes", "textarea"],
    ],
    search: ["reimbursement_reference", "payment_method"],
  },
};

const EMPTY_SUMMARY = {
  active_providers: 0,
  active_policies: 0,
  pending_claims: 0,
  rejected_claims: 0,
  pending_amount: 0,
  reimbursements_recorded: 0,
};

const emptyForm = (resource) =>
  Object.fromEntries(
    CONFIG[resource].fields.map(([key]) => [
      key,
      key === "is_active" ? true : "",
    ]),
  );

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The request could not be completed."
  );
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function Insurance() {
  const [activeTab, setActiveTab] = useState("providers");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [records, setRecords] = useState([]);
  const [providers, setProviders] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm("providers"));

  const config = CONFIG[activeTab];

  const loadLookups = useCallback(async () => {
    try {
      const [providerResponse, policyResponse, claimResponse] =
        await Promise.all([
          insuranceService.getRecords("providers", { limit: 100 }),
          insuranceService.getRecords("policies", { limit: 100 }),
          insuranceService.getRecords("claims", { limit: 100 }),
        ]);

      setProviders(providerResponse.data.data || []);
      setPolicies(policyResponse.data.data || []);
      setClaims(claimResponse.data.data || []);
    } catch {
      // The primary tab can still be displayed if a lookup fails.
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);

    try {
      const [summaryResponse, recordsResponse] = await Promise.all([
        insuranceService.getSummary(),
        insuranceService.getRecords(activeTab, {
          search,
          page: pagination.page,
          limit: pagination.limit,
        }),
      ]);

      setSummary({
        ...EMPTY_SUMMARY,
        ...(summaryResponse.data.data || {}),
      });

      setRecords(recordsResponse.data.data || []);
      setPagination((previous) => ({
        ...previous,
        ...(recordsResponse.data.pagination || {}),
      }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, pagination.page, pagination.limit]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(activeTab));
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    const next = emptyForm(activeTab);

    config.fields.forEach(([key, , type]) => {
      if (record[key] === undefined || record[key] === null) return;

      let value = record[key];

      if (type === "date" && value) {
        value = String(value).slice(0, 10);
      }

      next[key] = value;
    });

    setForm(next);
    setModalOpen(true);
  };

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {};

      config.fields.forEach(([key, , type]) => {
        const value = form[key];

        if (value === "" || value === undefined) return;

        if (type === "number") {
          payload[key] = Number(value);
        } else if (type === "boolean") {
          payload[key] = value === true || value === "true";
        } else {
          payload[key] = value;
        }
      });

      if (editing) {
        await insuranceService.updateRecord(activeTab, editing.id, payload);
        toast.success(`${config.singular} updated.`);
      } else {
        await insuranceService.createRecord(activeTab, payload);
        toast.success(`${config.singular} created.`);
      }

      setModalOpen(false);
      await loadPage();
      await loadLookups();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record) => {
    if (["claims", "reimbursements"].includes(activeTab)) {
      toast.error("Financial claims and reimbursements are retained.");
      return;
    }

    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) {
      return;
    }

    try {
      await insuranceService.deleteRecord(activeTab, record.id);
      toast.success("Record deleted.");
      await loadPage();
      await loadLookups();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const columns = useMemo(() => {
    const preferred = {
      providers: ["provider_code", "name", "phone", "email", "is_active"],
      policies: [
        "policy_number",
        "member_number",
        "patient_id",
        "coverage_percent",
        "status",
        "start_date",
        "end_date",
      ],
      claims: [
        "claim_number",
        "patient_id",
        "service_date",
        "claim_amount",
        "approved_amount",
        "status",
      ],
      reimbursements: [
        "reimbursement_reference",
        "claim_id",
        "amount",
        "payment_date",
        "payment_method",
      ],
    };

    return preferred[activeTab];
  }, [activeTab]);

  const lookupOptions = (type) => {
    if (type === "provider") {
      return providers.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.provider_code})`,
      }));
    }

    if (type === "policy") {
      return policies.map((item) => ({
        value: item.id,
        label: `${item.policy_number} — ${item.plan_name || "Policy"}`,
      }));
    }

    if (type === "claim") {
      return claims.map((item) => ({
        value: item.id,
        label: `${item.claim_number} — ${item.status}`,
      }));
    }

    return [];
  };

  const renderField = ([key, label, type, required]) => {
    const common = {
      id: key,
      name: key,
      required: Boolean(required),
      value: form[key] ?? "",
      onChange: (event) => updateField(key, event.target.value),
    };

    if (type === "boolean") {
      return (
        <label className="insurance-checkbox" key={key}>
          <input
            type="checkbox"
            checked={Boolean(form[key])}
            onChange={(event) => updateField(key, event.target.checked)}
          />
          {label}
        </label>
      );
    }

    if (["provider", "policy", "claim"].includes(type)) {
      return (
        <label className="insurance-field" key={key}>
          <span>
            {label}
            {required ? " *" : ""}
          </span>
          <select {...common}>
            <option value="">Select {label.toLowerCase()}</option>
            {lookupOptions(type).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (type === "policyStatus") {
      return (
        <label className="insurance-field" key={key}>
          <span>{label}</span>
          <select {...common}>
            {["active", "expired", "suspended", "cancelled"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (type === "paymentMethod") {
      return (
        <label className="insurance-field" key={key}>
          <span>{label}</span>
          <select {...common}>
            <option value="">Select payment method</option>
            {["bank_transfer", "cash", "cheque", "other"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (type === "currency") {
      return (
        <label className="insurance-field" key={key}>
          <span>{label}</span>
          <select {...common}>
            {["ETB", "USD", "EUR"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (type === "textarea") {
      return (
        <label className="insurance-field insurance-field-wide" key={key}>
          <span>{label}</span>
          <textarea {...common} rows={3} />
        </label>
      );
    }

    return (
      <label className="insurance-field" key={key}>
        <span>
          {label}
          {required ? " *" : ""}
        </span>
        <input
          {...common}
          type={type}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.01" : undefined}
        />
      </label>
    );
  };

  return (
    <main className="insurance-page">
      <header className="insurance-header">
        <div>
          <p className="insurance-eyebrow">MEDAXIS / FINANCE</p>
          <h1>Insurance &amp; Claims</h1>
          <p>Manage providers, patient policies, claims, and reimbursements.</p>
        </div>
        <button className="insurance-primary-button" onClick={openCreate}>
          <FiPlus /> Add {config.singular}
        </button>
      </header>

      <section className="insurance-stat-grid">
        <StatCard
          icon={<FiShield />}
          label="Active providers"
          value={summary.active_providers}
        />
        <StatCard
          icon={<FiUsers />}
          label="Active policies"
          value={summary.active_policies}
        />
        <StatCard
          icon={<FiFileText />}
          label="Pending claims"
          value={summary.pending_claims}
        />
        <StatCard
          icon={<FiDollarSign />}
          label="Pending claim amount"
          value={formatMoney(summary.pending_amount)}
        />
      </section>

      <section className="insurance-panel">
        <div className="insurance-tabs" role="tablist">
          {Object.entries(CONFIG).map(([key, item]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              className={activeTab === key ? "active" : ""}
              onClick={() => {
                setActiveTab(key);
                setSearch("");
                setPagination((previous) => ({ ...previous, page: 1 }));
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="insurance-toolbar">
          <label className="insurance-search">
            <FiSearch />
            <input
              value={search}
              placeholder={`Search ${config.label.toLowerCase()}...`}
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((previous) => ({ ...previous, page: 1 }));
              }}
            />
          </label>
          <button
            className="insurance-secondary-button"
            onClick={() => {
              loadPage();
              loadLookups();
            }}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="insurance-table-wrap">
          <table className="insurance-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column.replaceAll("_", " ")}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1}>Loading records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1}>
                    No {config.label.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    {columns.map((column) => (
                      <td key={column}>
                        {column === "claim_amount" ||
                        column === "approved_amount" ||
                        column === "amount"
                          ? formatMoney(record[column])
                          : displayValue(record[column])}
                      </td>
                    ))}
                    <td>
                      <div className="insurance-row-actions">
                        <button
                          title="Edit"
                          aria-label={`Edit ${config.singular}`}
                          onClick={() => openEdit(record)}
                        >
                          <FiEdit2 />
                        </button>
                        {!["claims", "reimbursements"].includes(activeTab) && (
                          <button
                            title="Delete"
                            aria-label={`Delete ${config.singular}`}
                            onClick={() => deleteRecord(record)}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="insurance-pagination">
          <span>{pagination.total} record(s)</span>
          <div>
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              <FiChevronLeft /> Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              disabled={
                loading || pagination.page >= Math.max(1, pagination.totalPages)
              }
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next <FiChevronRight />
            </button>
          </div>
        </footer>
      </section>

      {modalOpen && (
        <div
          className="insurance-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section className="insurance-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <h2>
                  {editing ? "Edit" : "Add"} {config.singular}
                </h2>
                <p>Enter the record details below.</p>
              </div>
              <button
                className="insurance-icon-button"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <FiX />
              </button>
            </header>

            <form onSubmit={saveRecord}>
              <div className="insurance-form-grid">
                {config.fields.map(renderField)}
              </div>
              <div className="insurance-modal-actions">
                <button
                  type="button"
                  className="insurance-secondary-button"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="insurance-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
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

function StatCard({ icon, label, value }) {
  return (
    <article className="insurance-stat-card">
      <span className="insurance-stat-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

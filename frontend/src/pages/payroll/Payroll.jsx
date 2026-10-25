import { useCallback, useEffect, useState } from "react";
import {
  FiCalendar,
  FiDollarSign,
  FiUsers,
  FiCheckCircle,
  FiRefreshCw,
  FiSearch,
  FiPlus,
  FiPlay,
  FiCreditCard,
} from "react-icons/fi";
import toast from "react-hot-toast";
import payrollService from "../../services/payroll.service";
import "./Payroll.css";

const TABS = [
  { id: "periods", label: "Pay Periods" },
  { id: "salaries", label: "Salary Structures" },
  { id: "records", label: "Payroll Records" },
  { id: "payments", label: "Payments" },
];

const emptyPeriod = {
  period_name: "",
  start_date: "",
  end_date: "",
  notes: "",
};

const emptySalary = {
  staff_id: "",
  basic_salary: "0",
  housing_allowance: "0",
  transport_allowance: "0",
  other_allowances: "0",
  bonus: "0",
  tax_deduction: "0",
  pension_deduction: "0",
  other_deductions: "0",
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
  notes: "",
};

const money = (value) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const dateLabel = (value) =>
  value
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString()
    : "—";

function getError(error) {
  return (
    error?.response?.data?.message || error?.message || "Something went wrong."
  );
}

export default function Payroll() {
  const [tab, setTab] = useState("periods");
  const [summary, setSummary] = useState({});
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [periodForm, setPeriodForm] = useState(emptyPeriod);
  const [salaryForm, setSalaryForm] = useState(emptySalary);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_reference: "",
    amount: "",
    payment_method: "bank_transfer",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const loadSummary = useCallback(async () => {
    try {
      const response = await payrollService.getSummary();
      setSummary(response.data?.data || {});
    } catch (error) {
      toast.error(getError(error));
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await payrollService.getRecords(tab, {
        page: pagination.page,
        limit: pagination.limit,
        search,
        ...(status ? { status } : {}),
      });

      setRecords(response.data?.data || []);
      setPagination((current) => ({
        ...current,
        total: response.data?.pagination?.total || 0,
      }));
    } catch (error) {
      setRecords([]);
      toast.error(getError(error));
    } finally {
      setLoading(false);
    }
  }, [tab, pagination.page, pagination.limit, search, status]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const refresh = async () => {
    await Promise.all([loadSummary(), loadRecords()]);
  };

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setSearch("");
    setStatus("");
    setPagination((current) => ({ ...current, page: 1, total: 0 }));
    setShowForm(false);
  };

  const openCreateForm = () => {
    if (tab === "periods") setPeriodForm(emptyPeriod);
    if (tab === "salaries") setSalaryForm(emptySalary);
    setShowForm(true);
  };

  const saveForm = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (tab === "periods") {
        await payrollService.createRecord("periods", periodForm);
        toast.success("Pay period created.");
      } else if (tab === "salaries") {
        const payload = Object.fromEntries(
          Object.entries(salaryForm).map(([key, value]) => [
            key,
            value === "" ? null : value,
          ]),
        );
        await payrollService.createRecord("salaries", payload);
        toast.success("Salary structure created.");
      } else {
        return;
      }

      setShowForm(false);
      await refresh();
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setSaving(false);
    }
  };

  const processPeriod = async (period) => {
    if (!window.confirm(`Process payroll for "${period.period_name}"?`)) return;

    try {
      const response = await payrollService.processPeriod(period.id);
      toast.success(response.data?.message || "Payroll processed.");
      await refresh();
    } catch (error) {
      toast.error(getError(error));
    }
  };

  const approveRecord = async (record) => {
    if (!window.confirm(`Approve net salary of ${money(record.net_salary)}?`))
      return;

    try {
      await payrollService.approveRecord(record.id);
      toast.success("Payroll record approved.");
      await refresh();
    } catch (error) {
      toast.error(getError(error));
    }
  };

  const openPayment = (record) => {
    setPaymentTarget(record);
    setPaymentForm({
      payment_reference: "",
      amount: String(
        Math.max(
          0,
          Number(record.net_salary || 0) - Number(record.total_paid || 0),
        ).toFixed(2),
      ),
      payment_method: "bank_transfer",
      payment_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const savePayment = async (event) => {
    event.preventDefault();
    if (!paymentTarget) return;

    setSaving(true);
    try {
      await payrollService.recordPayment(paymentTarget.id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      toast.success("Payment recorded.");
      setPaymentTarget(null);
      await refresh();
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setSaving(false);
    }
  };

  const formatCell = (key, value) => {
    if (
      [
        "basic_salary",
        "housing_allowance",
        "transport_allowance",
        "other_allowances",
        "bonus",
        "tax_deduction",
        "pension_deduction",
        "other_deductions",
        "gross_salary",
        "total_deductions",
        "net_salary",
        "amount",
      ].includes(key)
    )
      return money(value);

    if (
      [
        "start_date",
        "end_date",
        "effective_from",
        "effective_to",
        "payment_date",
        "created_at",
        "approved_at",
      ].includes(key)
    ) {
      return dateLabel(value);
    }

    if (key === "is_active") return value ? "Active" : "Inactive";
    return value ?? "—";
  };

  const columnsByTab = {
    periods: [
      ["period_name", "Period"],
      ["start_date", "Start"],
      ["end_date", "End"],
      ["status", "Status"],
    ],
    salaries: [
      ["staff_id", "Staff ID"],
      ["basic_salary", "Basic salary"],
      ["housing_allowance", "Housing"],
      ["transport_allowance", "Transport"],
      ["effective_from", "Effective from"],
      ["is_active", "Active"],
    ],
    records: [
      ["staff_id", "Staff ID"],
      ["period_id", "Period ID"],
      ["gross_salary", "Gross"],
      ["total_deductions", "Deductions"],
      ["net_salary", "Net salary"],
      ["status", "Status"],
    ],
    payments: [
      ["payment_reference", "Reference"],
      ["payroll_record_id", "Payroll record"],
      ["amount", "Amount"],
      ["payment_method", "Method"],
      ["payment_date", "Payment date"],
    ],
  };

  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.limit),
  );

  return (
    <main className="payroll-page">
      <header className="payroll-header">
        <div>
          <p className="payroll-eyebrow">HOSPITAL FINANCE</p>
          <h1>Payroll Management</h1>
          <p>
            Manage staff salary structures, pay periods, approvals, and
            payments.
          </p>
        </div>
        <button
          className="payroll-button payroll-button-light"
          onClick={refresh}
        >
          <FiRefreshCw /> Refresh
        </button>
      </header>

      <section className="payroll-stat-grid">
        <article className="payroll-stat">
          <span className="payroll-stat-icon">
            <FiCalendar />
          </span>
          <div>
            <span>Total periods</span>
            <strong>{summary.total_periods ?? 0}</strong>
          </div>
        </article>
        <article className="payroll-stat">
          <span className="payroll-stat-icon">
            <FiUsers />
          </span>
          <div>
            <span>Draft periods</span>
            <strong>{summary.draft_periods ?? 0}</strong>
          </div>
        </article>
        <article className="payroll-stat">
          <span className="payroll-stat-icon">
            <FiCheckCircle />
          </span>
          <div>
            <span>Unpaid payroll records</span>
            <strong>{summary.unpaid_records ?? 0}</strong>
          </div>
        </article>
        <article className="payroll-stat">
          <span className="payroll-stat-icon">
            <FiDollarSign />
          </span>
          <div>
            <span>Total net payroll</span>
            <strong>{money(summary.total_net_payroll)}</strong>
          </div>
        </article>
      </section>

      <section className="payroll-panel">
        <nav className="payroll-tabs" aria-label="Payroll sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => changeTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="payroll-toolbar">
          <div className="payroll-search">
            <FiSearch />
            <input
              value={search}
              placeholder="Search records..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            />
          </div>

          {["periods", "records"].includes(tab) && (
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            >
              <option value="">All statuses</option>
              {(tab === "periods"
                ? ["draft", "processing", "approved", "paid", "closed"]
                : ["draft", "approved", "partially_paid", "paid", "void"]
              ).map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          )}

          {["periods", "salaries"].includes(tab) && (
            <button className="payroll-button" onClick={openCreateForm}>
              <FiPlus /> Add {tab === "periods" ? "period" : "salary"}
            </button>
          )}
        </div>

        {showForm && (
          <form className="payroll-form" onSubmit={saveForm}>
            <div className="payroll-form-heading">
              <h2>
                {tab === "periods"
                  ? "Create pay period"
                  : "Create salary structure"}
              </h2>
              <button
                type="button"
                className="payroll-text-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>

            {tab === "periods" ? (
              <>
                <label>
                  Period name *
                  <input
                    required
                    value={periodForm.period_name}
                    onChange={(e) =>
                      setPeriodForm({
                        ...periodForm,
                        period_name: e.target.value,
                      })
                    }
                    placeholder="For example: October 2026"
                  />
                </label>
                <label>
                  Start date *
                  <input
                    type="date"
                    required
                    value={periodForm.start_date}
                    onChange={(e) =>
                      setPeriodForm({
                        ...periodForm,
                        start_date: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  End date *
                  <input
                    type="date"
                    required
                    min={periodForm.start_date}
                    value={periodForm.end_date}
                    onChange={(e) =>
                      setPeriodForm({ ...periodForm, end_date: e.target.value })
                    }
                  />
                </label>
                <label className="payroll-full-width">
                  Notes
                  <textarea
                    value={periodForm.notes}
                    onChange={(e) =>
                      setPeriodForm({ ...periodForm, notes: e.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Staff profile ID *
                  <input
                    required
                    type="number"
                    min="1"
                    value={salaryForm.staff_id}
                    onChange={(e) =>
                      setSalaryForm({ ...salaryForm, staff_id: e.target.value })
                    }
                    placeholder="Existing staff_profiles ID"
                  />
                </label>
                {[
                  ["basic_salary", "Basic salary", true],
                  ["housing_allowance", "Housing allowance"],
                  ["transport_allowance", "Transport allowance"],
                  ["other_allowances", "Other allowances"],
                  ["bonus", "Bonus"],
                  ["tax_deduction", "Tax deduction"],
                  ["pension_deduction", "Pension deduction"],
                  ["other_deductions", "Other deductions"],
                ].map(([key, label, required]) => (
                  <label key={key}>
                    {label}
                    {required ? " *" : ""}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required={Boolean(required)}
                      value={salaryForm[key]}
                      onChange={(e) =>
                        setSalaryForm({ ...salaryForm, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Effective from *
                  <input
                    type="date"
                    required
                    value={salaryForm.effective_from}
                    onChange={(e) =>
                      setSalaryForm({
                        ...salaryForm,
                        effective_from: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Effective to
                  <input
                    type="date"
                    min={salaryForm.effective_from}
                    value={salaryForm.effective_to}
                    onChange={(e) =>
                      setSalaryForm({
                        ...salaryForm,
                        effective_to: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="payroll-full-width">
                  Notes
                  <textarea
                    value={salaryForm.notes}
                    onChange={(e) =>
                      setSalaryForm({ ...salaryForm, notes: e.target.value })
                    }
                  />
                </label>
              </>
            )}

            <div className="payroll-form-actions">
              <button
                className="payroll-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}

        <div className="payroll-table-wrap">
          {loading ? (
            <div className="payroll-empty">Loading payroll records...</div>
          ) : records.length === 0 ? (
            <div className="payroll-empty">
              No records found. Create a record or change your search.
            </div>
          ) : (
            <table className="payroll-table">
              <thead>
                <tr>
                  {columnsByTab[tab].map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                  {tab !== "payments" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {columnsByTab[tab].map(([key]) => (
                      <td key={key}>
                        {key === "status" ? (
                          <span
                            className={`payroll-status status-${String(record[key]).replaceAll("_", "-")}`}
                          >
                            {String(record[key] || "—").replaceAll("_", " ")}
                          </span>
                        ) : (
                          formatCell(key, record[key])
                        )}
                      </td>
                    ))}
                    {tab !== "payments" && (
                      <td>
                        <div className="payroll-row-actions">
                          {tab === "periods" &&
                            ["draft", "processing"].includes(record.status) && (
                              <button
                                title="Process period"
                                onClick={() => processPeriod(record)}
                              >
                                <FiPlay /> Process
                              </button>
                            )}
                          {tab === "records" && record.status === "draft" && (
                            <button
                              title="Approve payroll"
                              onClick={() => approveRecord(record)}
                            >
                              <FiCheckCircle /> Approve
                            </button>
                          )}
                          {tab === "records" &&
                            ["approved", "partially_paid"].includes(
                              record.status,
                            ) && (
                              <button
                                title="Record payment"
                                onClick={() => openPayment(record)}
                              >
                                <FiCreditCard /> Pay
                              </button>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="payroll-pagination">
          <span>{pagination.total} record(s)</span>
          <div>
            <button
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {totalPages}
            </span>
            <button
              disabled={pagination.page >= totalPages}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {paymentTarget && (
        <div className="payroll-modal-backdrop" role="presentation">
          <form className="payroll-modal" onSubmit={savePayment}>
            <h2>Record payroll payment</h2>
            <p>
              Net salary: <strong>{money(paymentTarget.net_salary)}</strong>
            </p>

            <label>
              Payment reference *
              <input
                required
                value={paymentForm.payment_reference}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    payment_reference: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Payment amount *
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, amount: e.target.value })
                }
              />
            </label>
            <label>
              Payment method *
              <select
                required
                value={paymentForm.payment_method}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    payment_method: e.target.value,
                  })
                }
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile money</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Payment date *
              <input
                type="date"
                required
                value={paymentForm.payment_date}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    payment_date: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Notes
              <textarea
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
              />
            </label>
            <div className="payroll-form-actions">
              <button
                type="button"
                className="payroll-button payroll-button-light"
                onClick={() => setPaymentTarget(null)}
              >
                Cancel
              </button>
              <button className="payroll-button" disabled={saving}>
                {saving ? "Saving..." : "Record payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

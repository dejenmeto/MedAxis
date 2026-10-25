import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FiCreditCard,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiFileText,
} from "react-icons/fi";
import billingService from "../../services/billing.service";
import "./Billing.css";

const emptyForm = {
  patient_id: "",
  currency: "ETB",
  description: "",
  quantity: "1",
  unit_price: "0",
  discount_amount: "0",
  tax_amount: "0",
  due_at: "",
  notes: "",
};

const emptyPayment = {
  amount: "",
  payment_method: "cash",
  payment_reference: "",
  notes: "",
};

function extractRows(response, key) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function money(value, currency = "ETB") {
  return `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);

  const loadInvoices = useCallback(async () => {
    setLoading(true);

    try {
      const response = await billingService.listInvoices({
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      });

      setInvoices(extractRows(response, "invoices"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const subtotal = Math.max(
    0,
    Number(form.quantity || 0) * Number(form.unit_price || 0),
  );
  const discount = Number(form.discount_amount || 0);
  const tax = Number(form.tax_amount || 0);
  const total = Math.max(0, subtotal - discount + tax);

  const collected = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount_paid || 0),
    0,
  );

  const outstanding = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance_amount || 0),
    0,
  );

  async function createInvoice(event) {
    event.preventDefault();

    if (!form.patient_id.trim() || !form.description.trim()) {
      toast.error("Patient ID and description are required.");
      return;
    }

    if (
      !Number.isFinite(Number(form.quantity)) ||
      Number(form.quantity) <= 0 ||
      !Number.isFinite(Number(form.unit_price)) ||
      Number(form.unit_price) < 0 ||
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > subtotal ||
      !Number.isFinite(tax) ||
      tax < 0
    ) {
      toast.error("Please check the quantity, price, discount and tax.");
      return;
    }

    setSaving(true);

    try {
      await billingService.createInvoice({
        patient_id: form.patient_id.trim(),
        currency: form.currency,
        due_at: form.due_at || null,
        notes: form.notes.trim() || null,
        items: [
          {
            description: form.description.trim(),
            quantity: Number(form.quantity),
            unit_price: Number(form.unit_price),
            discount_amount: discount,
            tax_amount: tax,
          },
        ],
      });

      toast.success("Invoice created successfully.");
      setForm(emptyForm);
      setModal("");
      await loadInvoices();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function issueInvoice(invoice) {
    if (!window.confirm(`Issue invoice ${invoice.invoice_number}?`)) return;

    try {
      await billingService.issueInvoice(invoice.id);
      toast.success("Invoice issued successfully.");
      await loadInvoices();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to issue invoice.");
    }
  }

  async function collectPayment(event) {
    event.preventDefault();

    const amount = Number(paymentForm.amount);

    if (!selectedInvoice || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    if (amount > Number(selectedInvoice.balance_amount)) {
      toast.error("Payment cannot exceed the outstanding balance.");
      return;
    }

    setSaving(true);

    try {
      await billingService.recordPayment(selectedInvoice.id, {
        ...paymentForm,
        amount,
      });

      toast.success("Payment recorded successfully.");
      setModal("");
      setSelectedInvoice(null);
      setPaymentForm(emptyPayment);
      await loadInvoices();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  }

  function openPayment(invoice) {
    setSelectedInvoice(invoice);
    setPaymentForm({
      ...emptyPayment,
      amount: String(invoice.balance_amount),
    });
    setModal("payment");
  }

  return (
    <main className="billing-page">
      <header className="billing-heading">
        <div>
          <span className="billing-eyebrow">FINANCE MANAGEMENT</span>
          <h1>Billing & Payments</h1>
          <p>Manage patient invoices, billing balances and payments.</p>
        </div>

        <button className="billing-primary" onClick={() => setModal("invoice")}>
          <FiPlus /> New invoice
        </button>
      </header>

      <section className="billing-stats">
        <article className="billing-stat">
          <span>Invoices displayed</span>
          <strong>{invoices.length}</strong>
        </article>

        <article className="billing-stat">
          <span>Payments collected</span>
          <strong>{money(collected)}</strong>
        </article>

        <article className="billing-stat">
          <span>Outstanding balance</span>
          <strong>{money(outstanding)}</strong>
        </article>
      </section>

      <section className="billing-panel">
        <div className="billing-toolbar">
          <div className="billing-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice, patient ID or status..."
              aria-label="Search invoices"
            />
          </div>

          <button
            className="billing-secondary"
            onClick={loadInvoices}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Patient ID</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Due date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="billing-empty">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="billing-empty">
                    <FiFileText />
                    <span>No invoices found.</span>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoice_number}</strong>
                      <small>
                        {invoice.created_at
                          ? new Date(invoice.created_at).toLocaleDateString()
                          : ""}
                      </small>
                    </td>

                    <td className="billing-patient-id">{invoice.patient_id}</td>

                    <td>{money(invoice.total_amount, invoice.currency)}</td>
                    <td>{money(invoice.amount_paid, invoice.currency)}</td>
                    <td>{money(invoice.balance_amount, invoice.currency)}</td>

                    <td>
                      <span
                        className={`billing-status billing-status-${invoice.invoice_status}`}
                      >
                        {invoice.invoice_status?.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td>
                      {invoice.due_at
                        ? new Date(invoice.due_at).toLocaleDateString()
                        : "—"}
                    </td>

                    <td>
                      <div className="billing-actions">
                        {invoice.invoice_status === "draft" && (
                          <button
                            onClick={() => issueInvoice(invoice)}
                            disabled={saving}
                          >
                            Issue
                          </button>
                        )}

                        {["issued", "partially_paid", "overdue"].includes(
                          invoice.invoice_status,
                        ) &&
                          Number(invoice.balance_amount) > 0 && (
                            <button onClick={() => openPayment(invoice)}>
                              <FiCreditCard /> Pay
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
      </section>

      {modal === "invoice" && (
        <div
          className="billing-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setModal("");
            }
          }}
        >
          <section
            className="billing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-invoice-title"
          >
            <header className="billing-modal-heading">
              <div>
                <span className="billing-eyebrow">NEW BILLING RECORD</span>
                <h2 id="billing-invoice-title">Create invoice</h2>
              </div>
              <button
                type="button"
                onClick={() => setModal("")}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <form className="billing-form" onSubmit={createInvoice}>
              <label>
                Patient ID *
                <input
                  value={form.patient_id}
                  onChange={(event) =>
                    setForm({ ...form, patient_id: event.target.value })
                  }
                  placeholder="Paste the patient's database ID"
                  required
                />
              </label>

              <label>
                Description *
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="e.g. Consultation fee"
                  maxLength={255}
                  required
                />
              </label>

              <div className="billing-form-row">
                <label>
                  Quantity *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm({ ...form, quantity: event.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  Unit price (ETB) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(event) =>
                      setForm({ ...form, unit_price: event.target.value })
                    }
                    required
                  />
                </label>
              </div>

              <div className="billing-form-row">
                <label>
                  Discount (ETB)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_amount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        discount_amount: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Tax (ETB)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tax_amount}
                    onChange={(event) =>
                      setForm({ ...form, tax_amount: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="billing-form-row">
                <label>
                  Currency
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm({ ...form, currency: event.target.value })
                    }
                  >
                    <option value="ETB">ETB — Ethiopian Birr</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </label>

                <label>
                  Due date
                  <input
                    type="date"
                    value={form.due_at}
                    onChange={(event) =>
                      setForm({ ...form, due_at: event.target.value })
                    }
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Optional invoice notes"
                />
              </label>

              <div className="billing-estimate">
                <div>
                  <span>Subtotal</span>
                  <strong>{money(subtotal, form.currency)}</strong>
                </div>
                <div>
                  <span>Discount</span>
                  <strong>− {money(discount, form.currency)}</strong>
                </div>
                <div>
                  <span>Tax</span>
                  <strong>+ {money(tax, form.currency)}</strong>
                </div>
                <div className="billing-estimate-total">
                  <span>Estimated total</span>
                  <strong>{money(total, form.currency)}</strong>
                </div>
              </div>

              <div className="billing-modal-actions">
                <button
                  type="button"
                  className="billing-secondary"
                  onClick={() => setModal("")}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="billing-primary" disabled={saving}>
                  {saving ? "Saving..." : "Create invoice"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modal === "payment" && selectedInvoice && (
        <div className="billing-backdrop">
          <section
            className="billing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-payment-title"
          >
            <header className="billing-modal-heading">
              <div>
                <span className="billing-eyebrow">FINANCE MANAGEMENT</span>
                <h2 id="billing-payment-title">Record payment</h2>
              </div>
              <button
                type="button"
                onClick={() => setModal("")}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="billing-payment-context">
              <span>Invoice</span>
              <strong>{selectedInvoice.invoice_number}</strong>
              <span>Outstanding balance</span>
              <strong>
                {money(
                  selectedInvoice.balance_amount,
                  selectedInvoice.currency,
                )}
              </strong>
            </div>

            <form className="billing-form" onSubmit={collectPayment}>
              <label>
                Payment amount *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedInvoice.balance_amount}
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Payment method *
                <select
                  value={paymentForm.payment_method}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_method: event.target.value,
                    })
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="insurance">Insurance</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Payment reference
                <input
                  value={paymentForm.payment_reference}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_reference: event.target.value,
                    })
                  }
                  maxLength={100}
                />
              </label>

              <label>
                Notes
                <textarea
                  rows="2"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      notes: event.target.value,
                    })
                  }
                />
              </label>

              <div className="billing-modal-actions">
                <button
                  type="button"
                  className="billing-secondary"
                  onClick={() => setModal("")}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="billing-primary" disabled={saving}>
                  {saving ? "Saving..." : "Record payment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import paymentsService from "../../services/payments.service";
import "./Payments.css";

const initialForm = {
  invoiceId: "",
  amount: "",
  currency: "ETB",
  paymentMethod: "telebirr",
  payerName: "",
  payerEmail: "",
  payerPhone: "",
};

function getError(error) {
  return error.response?.data?.message || error.message || "Request failed.";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "ETB",
  }).format(Number(amount || 0));
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);

    try {
      const response = await paymentsService.getAll({
        status: status || undefined,
        search: search.trim() || undefined,
      });

      const data = response.data;
      setPayments(data.payments || []);
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createPayment(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await paymentsService.create({
        ...form,
        amount: Number(form.amount),
        invoiceId: form.invoiceId.trim() || null,
        payerName: form.payerName.trim(),
        payerEmail: form.payerEmail.trim(),
        payerPhone: form.payerPhone.trim(),
      });

      setTestMode(Boolean(response.data.testMode));

      if (response.data.payment?.checkout_url) {
        window.location.assign(response.data.payment.checkout_url);
        return;
      }

      toast.success("Payment request created.");
      setForm(initialForm);
      await loadPayments();
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setSaving(false);
    }
  }

  async function simulate(reference, outcome) {
    if (
      !window.confirm(
        `Simulate a ${outcome} result? This does not move real money.`,
      )
    ) {
      return;
    }

    try {
      await paymentsService.simulateResult(reference, outcome);
      toast.success(`Test result: ${outcome}.`);
      await loadPayments();
    } catch (error) {
      toast.error(getError(error));
    }
  }

  async function verify(reference) {
    try {
      await paymentsService.verify(reference);
      toast.success("Provider verification completed.");
      await loadPayments();
    } catch (error) {
      toast.error(getError(error));
    }
  }

  return (
    <main className="payments-page">
      <header className="payments-header">
        <div>
          <p className="payments-eyebrow">BILLING & FINANCE</p>
          <h1>Payment Integration</h1>
          <p>Create payment requests and monitor transaction statuses.</p>
        </div>

        <span className="payments-mode">
          {testMode ? "Test mode" : "Check server mode"}
        </span>
      </header>

      <section className="payments-panel">
        <h2>Create payment request</h2>
        <p className="payments-help">
          Use an existing invoice reference when available. This form creates a
          payment transaction; it does not create or settle an invoice.
        </p>

        <form className="payments-form" onSubmit={createPayment}>
          <label>
            Invoice reference (optional)
            <input
              name="invoiceId"
              value={form.invoiceId}
              onChange={updateForm}
              maxLength={100}
              placeholder="Existing invoice ID"
            />
          </label>

          <label>
            Amount
            <input
              name="amount"
              type="number"
              min="0.01"
              max="100000000"
              step="0.01"
              required
              value={form.amount}
              onChange={updateForm}
              placeholder="0.00"
            />
          </label>

          <label>
            Currency
            <select name="currency" value={form.currency} onChange={updateForm}>
              <option value="ETB">ETB — Ethiopian birr</option>
              <option value="USD">USD — US dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound sterling</option>
            </select>
          </label>

          <label>
            Payment method
            <select
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={updateForm}
            >
              <option value="telebirr">Telebirr</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Payer name
            <input
              name="payerName"
              value={form.payerName}
              onChange={updateForm}
              maxLength={160}
              placeholder="Payer's name"
            />
          </label>

          <label>
            Payer email
            <input
              name="payerEmail"
              type="email"
              value={form.payerEmail}
              onChange={updateForm}
              placeholder="payer@example.com"
            />
          </label>

          <label>
            Payer phone
            <input
              name="payerPhone"
              type="tel"
              value={form.payerPhone}
              onChange={updateForm}
              maxLength={40}
              placeholder="Phone number"
            />
          </label>

          <div className="payments-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create payment request"}
            </button>
          </div>
        </form>
      </section>

      <section className="payments-panel">
        <div className="payments-list-header">
          <div>
            <h2>Transactions</h2>
            <p>{payments.length} transaction(s) displayed</p>
          </div>

          <button
            type="button"
            className="payments-secondary-button"
            onClick={loadPayments}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div className="payments-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, invoice, or email"
            aria-label="Search transactions"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <p className="payments-empty">Loading transactions...</p>
        ) : payments.length === 0 ? (
          <p className="payments-empty">No transactions found.</p>
        ) : (
          <div className="payments-table-wrap">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Invoice</th>
                  <th>Payer</th>
                  <th>Amount</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.transaction_reference}</td>
                    <td>{payment.invoice_id || "—"}</td>
                    <td>{payment.payer_name || payment.payer_email || "—"}</td>
                    <td>{formatMoney(payment.amount, payment.currency)}</td>
                    <td>{payment.provider}</td>
                    <td>
                      <span
                        className={`payment-status payment-status-${payment.status}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td>{formatDate(payment.created_at)}</td>
                    <td>
                      <div className="payments-row-actions">
                        {payment.status === "pending" &&
                          payment.provider === "test" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  simulate(
                                    payment.transaction_reference,
                                    "success",
                                  )
                                }
                              >
                                Test success
                              </button>
                              <button
                                type="button"
                                className="payments-danger-button"
                                onClick={() =>
                                  simulate(
                                    payment.transaction_reference,
                                    "failed",
                                  )
                                }
                              >
                                Test failure
                              </button>
                            </>
                          )}

                        {payment.status === "pending" &&
                          payment.provider !== "test" && (
                            <button
                              type="button"
                              onClick={() =>
                                verify(payment.transaction_reference)
                              }
                            >
                              Verify
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

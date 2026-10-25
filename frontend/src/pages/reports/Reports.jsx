import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiDollarSign,
  FiDownload,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import reportsService from "../../services/reports.service";

// import { exportCSV, exportExcel, exportPDF } from "../../utils/exportData";

import "./Reports.css";

const numberFormat = new Intl.NumberFormat();
const moneyFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialDates() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 5);
  from.setDate(1);

  return { from: localDate(from), to: localDate(to) };
}

function extractData(response) {
  return response?.data?.data ?? response?.data ?? {};
}

function exportCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    toast.error("There is no report data to export.");
    return;
  }

  try {
    const headers = Object.keys(rows[0]);

    const escapeCell = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      headers.map(escapeCell).join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCell(row[header])).join(","),
      ),
    ].join("\r\n");

    const dataUrl =
      "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvContent);

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    toast.success("CSV export requested. Check your Downloads folder.");
  } catch (error) {
    console.error("CSV export failed:", error);
    toast.error("CSV export failed. Check the browser console.");
  }
}

function MetricCard({ title, value, icon: Icon, note }) {
  return (
    <article className="report-metric-card">
      <div className="report-metric-icon">
        <Icon />
      </div>
      <div className="report-metric-title">{title}</div>
      <div className="report-metric-value">{value}</div>
      <div className="report-metric-note">{note}</div>
    </article>
  );
}

export default function Reports() {
  const [dates, setDates] = useState(initialDates);
  const [data, setData] = useState({
    metrics: {},
    monthly: [],
    financial: [],
    unavailableMetrics: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!dates.from || !dates.to) {
      setError("Select both a start date and an end date.");
      setLoading(false);
      return;
    }

    if (dates.from > dates.to) {
      setError("The start date must not be later than the end date.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = { from: dates.from, to: dates.to };

      const [summaryResponse, monthlyResponse, financialResponse] =
        await Promise.all([
          reportsService.getSummary(params),
          reportsService.getMonthly(params),
          reportsService.getFinancial(params),
        ]);

      const summary = extractData(summaryResponse);
      const monthly = extractData(monthlyResponse);
      const financial = extractData(financialResponse);

      setData({
        metrics: summary.metrics || {},
        monthly: Array.isArray(monthly) ? monthly : [],
        financial: Array.isArray(financial) ? financial : [],
        unavailableMetrics: summary.unavailableMetrics || [],
      });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Unable to load reports. Check your access and connection.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [dates.from, dates.to]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const metrics = data.metrics;

  const summaryCards = [
    {
      title: "Patients",
      value: metrics.patients,
      icon: FiUsers,
      note: "Registered patient records",
    },
    {
      title: "Appointments",
      value: metrics.appointments,
      icon: FiCalendar,
      note: "Appointment records",
    },
    {
      title: "Admissions",
      value: metrics.admissions,
      icon: FiActivity,
      note: "Inpatient admissions",
    },
    {
      title: "Payments",
      value: metrics.payments,
      icon: FiDollarSign,
      note: "Transactions in the selected period",
    },
  ];

  const displayMetric = (value) =>
    value === null || value === undefined ? "N/A" : numberFormat.format(value);

  return (
    <main className="reports-page">
      <header className="reports-header">
        <div>
          <p className="reports-eyebrow">MEDAXIS / ANALYTICS</p>
          <h1>Reports &amp; Analytics</h1>
          <p className="reports-subtitle">
            Review hospital activity and available financial information.
          </p>
        </div>

        <button
          type="button"
          className="reports-secondary-button"
          onClick={loadReports}
          disabled={loading}
        >
          <FiRefreshCw />
          Refresh
        </button>
      </header>

      <section className="reports-filters">
        <label>
          Start date
          <input
            type="date"
            value={dates.from}
            max={dates.to}
            onChange={(event) =>
              setDates((current) => ({
                ...current,
                from: event.target.value,
              }))
            }
          />
        </label>

        <label>
          End date
          <input
            type="date"
            value={dates.to}
            min={dates.from}
            onChange={(event) =>
              setDates((current) => ({
                ...current,
                to: event.target.value,
              }))
            }
          />
        </label>

        <button
          type="button"
          className="reports-primary-button"
          onClick={loadReports}
          disabled={loading}
        >
          Apply filters
        </button>
      </section>

      {error && (
        <div className="reports-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="reports-loading">
          <span className="reports-spinner" />
          Loading reports…
        </div>
      ) : (
        <>
          <section className="reports-metrics-grid">
            {summaryCards.map((card) => (
              <MetricCard
                key={card.title}
                {...card}
                value={displayMetric(card.value)}
              />
            ))}
          </section>

          {data.unavailableMetrics.length > 0 && (
            <p className="reports-info">
              Some metrics are unavailable because the corresponding table or a
              hospital-scoped data column was not found.
            </p>
          )}

          <section className="reports-panel">
            <div className="reports-panel-header">
              <div>
                <h2>Monthly appointment activity</h2>
                <p>Appointments recorded during the selected date range</p>
              </div>

              <button
                type="button"
                className="reports-export-button"
                onClick={() =>
                  exportCsv("medaxis-monthly-appointments.csv", data.monthly)
                }
              >
                <FiDownload /> Export CSV
              </button>
            </div>

            {data.monthly.length === 0 ? (
              <p className="reports-empty">
                No monthly appointment data is available for this period.
              </p>
            ) : (
              <div className="reports-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Appointments"
                      stroke="#287a78"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="reports-panel">
            <div className="reports-panel-header">
              <div>
                <h2>Financial activity</h2>
                <p>Recorded payments grouped by month</p>
              </div>

              <button
                type="button"
                className="reports-export-button"
                onClick={() =>
                  exportCsv("medaxis-financial-report.csv", data.financial)
                }
              >
                <FiDownload /> Export CSV
              </button>
            </div>

            {data.financial.length === 0 ? (
              <p className="reports-empty">
                No compatible payment data is available for this period.
              </p>
            ) : (
              <div className="reports-table-wrapper">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Transactions</th>
                      <th>Recorded revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.financial.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{numberFormat.format(row.transactions)}</td>
                        <td>{moneyFormat.format(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="reports-disclaimer">
              Revenue reflects recorded payments, not necessarily all invoices
              or outstanding balances. Confirm the hospital's currency before
              using figures for financial decisions.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

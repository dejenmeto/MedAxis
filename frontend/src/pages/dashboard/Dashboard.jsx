import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiActivity,
  FiCalendar,
  FiCreditCard,
  FiUsers,
  FiRefreshCw,
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
import api from "../../services/api";
import "./Dashboard.css";

const emptySummary = {
  patients: 0,
  appointments_today: 0,
  pending_lab_orders: 0,
  outstanding_balance: 0,
  recent_appointments: [],
  monthly_visits: [],
};

export default function Dashboard() {
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);

  async function loadSummary() {
    setLoading(true);

    try {
      const response = await api.get("/dashboard/overview");

      const data = response.data?.data ?? response.data;

      setSummary({
        ...emptySummary,
        ...data,
        patients: Number(data.patients?.total ?? 0),
        appointments_today: Number(data.appointments?.today ?? 0),
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load dashboard summary.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  const cards = [
    {
      label: "Registered patients",
      value: summary.patients,
      icon: FiUsers,
      note: "Patient records",
    },
    {
      label: "Appointments today",
      value: summary.appointments_today,
      icon: FiCalendar,
      note: "Scheduled visits",
    },
    {
      label: "Pending lab orders",
      value: summary.pending_lab_orders,
      icon: FiActivity,
      note: "Diagnostic workflow",
    },
    {
      label: "Outstanding balance",
      value: Number(summary.outstanding_balance || 0).toLocaleString(
        undefined,
        { maximumFractionDigits: 2 },
      ),
      icon: FiCreditCard,
      note: "Unpaid invoices",
    },
  ];

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">OVERVIEW</span>
          <h1>Hospital dashboard</h1>
          <p>Monitor daily activity and key operational indicators.</p>
        </div>
        <button
          className="dashboard-refresh"
          onClick={loadSummary}
          disabled={loading}
        >
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="dashboard-stat-grid">
        {cards.map(({ label, value, icon: Icon, note }) => (
          <article className="dashboard-stat-card" key={label}>
            <div className="dashboard-stat-top">
              <span>{label}</span>
              <span className="dashboard-stat-icon">
                <Icon />
              </span>
            </div>
            <strong>{loading ? "—" : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Monthly patient visits</h2>
              <p>Visit counts returned by the dashboard API</p>
            </div>
          </div>

          <div className="dashboard-chart">
            {summary.monthly_visits.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.monthly_visits}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke="#087f72"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="dashboard-chart-empty">
                {loading
                  ? "Loading chart..."
                  : "No monthly visit data is available yet."}
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Open a common workspace</p>
            </div>
          </div>

          <div className="dashboard-quick-actions">
            <Link to="/patients">
              <FiUsers />
              <span>
                <strong>Patients</strong>
                <small>Register and find patients</small>
              </span>
            </Link>
            <Link to="/appointments">
              <FiCalendar />
              <span>
                <strong>Appointments</strong>
                <small>Schedule patient visits</small>
              </span>
            </Link>
            <Link to="/emr">
              <FiActivity />
              <span>
                <strong>Medical records</strong>
                <small>Review clinical encounters</small>
              </span>
            </Link>
            <Link to="/billing">
              <FiCreditCard />
              <span>
                <strong>Billing</strong>
                <small>Invoices and payments</small>
              </span>
            </Link>
          </div>
        </section>
      </div>

      <section className="dashboard-panel dashboard-appointments-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Recent appointments</h2>
            <p>Latest appointment records visible to your account</p>
          </div>
          <Link to="/appointments">View appointments</Link>
        </div>

        <div className="table-responsive">
          <table className="table dashboard-table align-middle">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Appointment time</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent_appointments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="dashboard-table-empty">
                    {loading
                      ? "Loading appointments..."
                      : "No recent appointments."}
                  </td>
                </tr>
              ) : (
                summary.recent_appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      {appointment.first_name} {appointment.last_name}
                    </td>
                    <td>
                      {appointment.appointment_date
                        ? new Date(
                            appointment.appointment_date,
                          ).toLocaleString()
                        : "—"}
                    </td>
                    <td>{appointment.reason || "—"}</td>
                    <td>
                      <span
                        className={`dashboard-status status-${appointment.status}`}
                      >
                        {appointment.status || "scheduled"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

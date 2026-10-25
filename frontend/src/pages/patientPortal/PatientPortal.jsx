import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import patientPortalService from "../../services/patientPortal.service";
import "./PatientPortal.css";

const resourceLabels = {
  appointments: "Appointments",
  documents: "Medical documents",
  reports: "Medical reports",
  invoices: "Invoices",
  payments: "Payment history",
};

const dateFields = [
  "appointment_date",
  "scheduled_at",
  "report_date",
  "invoice_date",
  "payment_date",
  "uploaded_at",
  "created_at",
];

function getError(error) {
  return (
    error.response?.data?.message || error.message || "Unable to load data."
  );
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
}

function displayDate(record) {
  const key = dateFields.find((field) => record[field]);
  if (!key) return "—";

  const date = new Date(record[key]);
  return Number.isNaN(date.getTime())
    ? displayValue(record[key])
    : date.toLocaleString();
}

export default function PatientPortal() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [resource, setResource] = useState("appointments");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);

      try {
        const response = await patientPortalService.getDashboard();
        if (!active) return;

        const linkedPatients = response.data.patients || [];
        setPatients(linkedPatients);

        if (linkedPatients.length) {
          setPatientId(String(linkedPatients[0].patientId));
        }
      } catch (error) {
        if (active) toast.error(getError(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRecords() {
      if (!patientId) {
        setRecords([]);
        return;
      }

      setRecordsLoading(true);

      try {
        const methods = {
          appointments: patientPortalService.getAppointments,
          documents: patientPortalService.getDocuments,
          reports: patientPortalService.getReports,
          invoices: patientPortalService.getInvoices,
          payments: patientPortalService.getPayments,
        };

        const response = await methods[resource](patientId);

        if (active) {
          setRecords(response.data.records || []);
          if (response.data.unavailable) {
            toast(
              response.data.message || "This resource is not available yet.",
            );
          }
        }
      } catch (error) {
        if (active) {
          setRecords([]);
          toast.error(getError(error));
        }
      } finally {
        if (active) setRecordsLoading(false);
      }
    }

    loadRecords();

    return () => {
      active = false;
    };
  }, [patientId, resource]);

  return (
    <main className="patient-portal-page">
      <header className="patient-portal-header">
        <div>
          <span className="patient-portal-eyebrow">MEDAXIS HEALTHCARE</span>
          <h1>Patient & Guardian Portal</h1>
          <p>View authorized appointments, records, and billing information.</p>
        </div>
      </header>

      <section className="patient-portal-panel">
        <h2>Your linked patients</h2>

        {loading ? (
          <p className="patient-portal-message">Loading your portal...</p>
        ) : patients.length === 0 ? (
          <div className="patient-portal-empty">
            <h3>No approved patient links</h3>
            <p>
              Contact your hospital administrator to link your portal account to
              the correct patient record. Access is granted only after approval.
            </p>
          </div>
        ) : (
          <>
            <label className="patient-portal-field">
              Select patient
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
              >
                {patients.map((patient) => (
                  <option
                    key={patient.patientId}
                    value={String(patient.patientId)}
                  >
                    Patient #{patient.patientId} — {patient.relationship}
                  </option>
                ))}
              </select>
            </label>

            <div className="patient-portal-tabs" role="tablist">
              {Object.entries(resourceLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={resource === key}
                  className={resource === key ? "active" : ""}
                  onClick={() => setResource(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="patient-portal-records">
              <div className="patient-portal-records-heading">
                <h2>{resourceLabels[resource]}</h2>
                <span>{records.length} record(s)</span>
              </div>

              {recordsLoading ? (
                <p className="patient-portal-message">Loading records...</p>
              ) : records.length === 0 ? (
                <p className="patient-portal-message">
                  No records are available for this section.
                </p>
              ) : (
                <div className="patient-portal-record-list">
                  {records.map((record, index) => {
                    const excluded = new Set([
                      "password",
                      "password_hash",
                      "token",
                      "secret",
                    ]);

                    const entries = Object.entries(record).filter(
                      ([key]) => !excluded.has(key.toLowerCase()),
                    );

                    return (
                      <article
                        className="patient-portal-record"
                        key={record.id ?? `${patientId}-${resource}-${index}`}
                      >
                        <div className="patient-portal-record-heading">
                          <h3>
                            {record.title ||
                              record.name ||
                              record.invoice_number ||
                              record.transaction_reference ||
                              `${resourceLabels[resource].slice(0, -1)} #${record.id ?? index + 1}`}
                          </h3>
                          <time>{displayDate(record)}</time>
                        </div>

                        <dl>
                          {entries.slice(0, 8).map(([key, value]) => (
                            <div key={key}>
                              <dt>{key.replaceAll("_", " ")}</dt>
                              <dd>{displayValue(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

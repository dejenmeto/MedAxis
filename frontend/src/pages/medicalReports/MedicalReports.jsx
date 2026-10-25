import { useCallback, useEffect, useState } from "react";
import {
  FiFileText,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiCheckCircle,
  FiArchive,
  FiPrinter,
  FiX,
  FiRefreshCw,
} from "react-icons/fi";
import toast from "react-hot-toast";

import medicalReportsService from "../../services/medicalReports.service";
import "./MedicalReports.css";

const initialForm = {
  patient_id: "",
  report_type: "general",
  title: "",
  clinical_history: "",
  findings: "",
  impression: "",
  recommendations: "",
  report_date: new Date().toISOString().slice(0, 10),
};

const reportTypes = [
  "general",
  "laboratory",
  "radiology",
  "discharge",
  "surgical",
  "consultation",
  "referral",
  "other",
];

export default function MedicalReports() {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const response = await medicalReportsService.getReports({
        search,
        type,
        status,
        archived: showArchived,
        page,
        limit: 10,
      });

      const result = response.data;
      setReports(result.data || []);
      setPagination(
        result.pagination || {
          page: 1,
          total: 0,
          totalPages: 1,
        },
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not load medical reports.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, type, status, showArchived, page]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...initialForm,
      report_date: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  }

  function openEdit(report) {
    setEditing(report);
    setForm({
      patient_id: report.patient_id,
      report_type: report.report_type,
      title: report.title,
      clinical_history: report.clinical_history || "",
      findings: report.findings || "",
      impression: report.impression || "",
      recommendations: report.recommendations || "",
      report_date: report.report_date
        ? String(report.report_date).slice(0, 10)
        : "",
    });
    setModalOpen(true);
  }

  function changeField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function saveReport(event) {
    event.preventDefault();

    if (!editing && !String(form.patient_id).trim()) {
      toast.error("Enter the patient's database ID.");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };

      if (editing) {
        delete payload.patient_id;
        await medicalReportsService.updateReport(editing.id, payload);
        toast.success("Draft report updated.");
      } else {
        await medicalReportsService.createReport(payload);
        toast.success("Medical report created.");
      }

      setModalOpen(false);
      setPage(1);

      // Refresh the current list after saving.
      await loadReports();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save the report.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function finalizeReport(report) {
    if (
      !window.confirm(
        "Finalize this report? Finalized reports cannot be edited.",
      )
    )
      return;

    try {
      await medicalReportsService.finalizeReport(report.id);
      toast.success("Report finalized.");
      await loadReports();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not finalize report.",
      );
    }
  }

  async function archiveReport(report) {
    if (!window.confirm("Archive this report?")) return;

    try {
      await medicalReportsService.archiveReport(report.id);
      toast.success("Report archived.");
      await loadReports();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not archive report.");
    }
  }

  function printReport(report) {
    setViewing(report);
    setTimeout(() => window.print(), 100);
  }

  return (
    <main className="medical-reports-page">
      <header className="mr-header">
        <div>
          <span className="mr-eyebrow">CLINICAL RECORDS</span>
          <h1>
            <FiFileText /> Medical Reports
          </h1>
          <p>Create, review, finalize, and print patient reports.</p>
        </div>

        <button className="mr-primary" onClick={openCreate}>
          <FiPlus /> New report
        </button>
      </header>

      <section className="mr-summary">
        <div>
          <span>Total in current view</span>
          <strong>{pagination.total}</strong>
        </div>
        <div>
          <span>Drafts shown</span>
          <strong>
            {reports.filter((report) => report.status === "draft").length}
          </strong>
        </div>
        <div>
          <span>Final reports shown</span>
          <strong>
            {reports.filter((report) => report.status === "final").length}
          </strong>
        </div>
      </section>

      <section className="mr-panel">
        <div className="mr-toolbar">
          <label className="mr-search">
            <FiSearch />
            <input
              value={search}
              placeholder="Search code, title, patient ID..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <select
            value={type}
            aria-label="Filter by report type"
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All report types</option>
            {reportTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={status}
            aria-label="Filter by report status"
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
          </select>

          <label className="mr-archived-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => {
                setShowArchived(event.target.checked);
                setPage(1);
              }}
            />
            Archived
          </label>

          <button
            className="mr-icon-button"
            onClick={loadReports}
            title="Refresh"
          >
            <FiRefreshCw />
          </button>
        </div>

        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Patient ID</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="mr-empty">
                    Loading reports...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="mr-empty">
                    No medical reports found.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <button
                        className="mr-report-link"
                        onClick={() => setViewing(report)}
                      >
                        {report.title}
                      </button>
                      <small>{report.report_code}</small>
                    </td>
                    <td>{report.patient_id}</td>
                    <td>{report.report_type}</td>
                    <td>
                      {report.report_date
                        ? String(report.report_date).slice(0, 10)
                        : "—"}
                    </td>
                    <td>
                      <span className={`mr-status mr-status-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>
                      <div className="mr-actions">
                        <button
                          title="View / print"
                          onClick={() => printReport(report)}
                        >
                          <FiPrinter />
                        </button>

                        {!showArchived && report.status === "draft" && (
                          <>
                            <button
                              title="Edit draft"
                              onClick={() => openEdit(report)}
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              title="Finalize"
                              onClick={() => finalizeReport(report)}
                            >
                              <FiCheckCircle />
                            </button>
                          </>
                        )}

                        {!showArchived && (
                          <button
                            title="Archive"
                            onClick={() => archiveReport(report)}
                          >
                            <FiArchive />
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

        <footer className="mr-pagination">
          <span>
            {pagination.total} report(s) · Page {page} of{" "}
            {Math.max(1, pagination.totalPages)}
          </span>
          <div>
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <button
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {modalOpen && (
        <div className="mr-modal-backdrop">
          <section className="mr-modal" role="dialog" aria-modal="true">
            <header className="mr-modal-header">
              <div>
                <h2>
                  {editing ? "Edit draft report" : "Create medical report"}
                </h2>
                <p>Complete the clinical details before saving.</p>
              </div>
              <button onClick={() => setModalOpen(false)} aria-label="Close">
                <FiX />
              </button>
            </header>

            <form className="mr-form" onSubmit={saveReport}>
              {!editing && (
                <label>
                  Patient database ID *
                  <input
                    name="patient_id"
                    type="number"
                    min="1"
                    required
                    value={form.patient_id}
                    onChange={changeField}
                  />
                </label>
              )}

              <div className="mr-form-grid">
                <label>
                  Report type *
                  <select
                    name="report_type"
                    required
                    value={form.report_type}
                    onChange={changeField}
                  >
                    {reportTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Report date *
                  <input
                    type="date"
                    name="report_date"
                    required
                    value={form.report_date}
                    onChange={changeField}
                  />
                </label>
              </div>

              <label>
                Report title *
                <input
                  name="title"
                  required
                  maxLength="200"
                  value={form.title}
                  onChange={changeField}
                />
              </label>

              <label>
                Clinical history
                <textarea
                  name="clinical_history"
                  rows="3"
                  value={form.clinical_history}
                  onChange={changeField}
                />
              </label>

              <label>
                Findings *
                <textarea
                  name="findings"
                  rows="4"
                  required
                  value={form.findings}
                  onChange={changeField}
                />
              </label>

              <label>
                Impression / conclusion *
                <textarea
                  name="impression"
                  rows="3"
                  required
                  value={form.impression}
                  onChange={changeField}
                />
              </label>

              <label>
                Recommendations
                <textarea
                  name="recommendations"
                  rows="3"
                  value={form.recommendations}
                  onChange={changeField}
                />
              </label>

              <footer className="mr-form-actions">
                <button
                  type="button"
                  className="mr-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="mr-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save draft"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {viewing && (
        <div className="mr-modal-backdrop mr-view-backdrop">
          <article className="mr-modal mr-report-paper" id="mr-print-area">
            <header className="mr-modal-header mr-no-print">
              <h2>Medical report</h2>
              <div className="mr-actions">
                <button onClick={() => window.print()} title="Print">
                  <FiPrinter />
                </button>
                <button onClick={() => setViewing(null)} title="Close">
                  <FiX />
                </button>
              </div>
            </header>

            <div className="mr-paper-content">
              <h1>Medical Report</h1>
              <p>
                <strong>Report code:</strong> {viewing.report_code}
              </p>
              <p>
                <strong>Patient ID:</strong> {viewing.patient_id}
              </p>
              <p>
                <strong>Report type:</strong> {viewing.report_type}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {String(viewing.report_date || "").slice(0, 10)}
              </p>
              <p>
                <strong>Status:</strong> {viewing.status}
              </p>
              <hr />
              <h2>{viewing.title}</h2>
              <h3>Clinical history</h3>
              <p>{viewing.clinical_history || "Not provided."}</p>
              <h3>Findings</h3>
              <p>{viewing.findings}</p>
              <h3>Impression / conclusion</h3>
              <p>{viewing.impression}</p>
              <h3>Recommendations</h3>
              <p>{viewing.recommendations || "Not provided."}</p>
              <p className="mr-signature">
                Prepared by user ID: {viewing.prepared_by || "—"}
              </p>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}

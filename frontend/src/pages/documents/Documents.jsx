import { useCallback, useEffect, useState } from "react";
import {
  FiFileText,
  FiUploadCloud,
  FiSearch,
  FiDownload,
  FiArchive,
  FiEdit2,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import documentsService from "../../services/documents.service";
import "./Documents.css";

const CATEGORIES = [
  ["lab_result", "Laboratory result"],
  ["prescription", "Prescription"],
  ["imaging_report", "Imaging report"],
  ["discharge_summary", "Discharge summary"],
  ["consent_form", "Consent form"],
  ["referral", "Referral letter"],
  ["clinical_note", "Clinical note"],
  ["other", "Other"],
];

const EMPTY_FORM = {
  patient_id: "",
  title: "",
  category: "other",
  description: "",
  document_date: "",
  document: null,
};

const getError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "The request could not be completed.";

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [archivedFilter, setArchivedFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadDocuments = useCallback(async () => {
    setLoading(true);

    try {
      const result = await documentsService.getDocuments({
        search,
        category: categoryFilter,
        archived: String(archivedFilter),
        page: pagination.page,
        limit: 10,
      });

      setDocuments(result.data || []);
      setPagination((current) => ({
        ...current,
        ...(result.pagination || {}),
      }));
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, archivedFilter, pagination.page]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const openUpload = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowUpload(true);
  };

  const openEdit = (document) => {
    setEditing(document);
    setForm({
      title: document.title || "",
      category: document.category || "other",
      description: document.description || "",
      document_date: document.document_date
        ? String(document.document_date).slice(0, 10)
        : "",
    });
    setShowUpload(true);
  };

  const closeForm = () => {
    setShowUpload(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editing) {
        await documentsService.updateDocument(editing.id, {
          title: form.title,
          category: form.category,
          description: form.description,
          document_date: form.document_date,
        });
        toast.success("Document details updated.");
      } else {
        if (!form.document) {
          toast.error("Please select a file.");
          setSaving(false);
          return;
        }

        const payload = new FormData();
        payload.append("patient_id", form.patient_id);
        payload.append("title", form.title);
        payload.append("category", form.category);
        payload.append("description", form.description);
        payload.append("document_date", form.document_date);
        payload.append("document", form.document);

        await documentsService.uploadDocument(payload);
        toast.success("Document uploaded successfully.");
      }

      closeForm();
      setPagination((current) => ({ ...current, page: 1 }));
      if (pagination.page === 1) {
        await loadDocuments();
      }
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (document) => {
    const confirmed = window.confirm(
      `Archive "${document.title}"? It will no longer appear in the active documents list.`,
    );

    if (!confirmed) return;

    try {
      await documentsService.archiveDocument(document.id);
      toast.success("Document archived.");
      await loadDocuments();
    } catch (error) {
      toast.error(getError(error));
    }
  };

  const handleDownload = async (document) => {
    try {
      await documentsService.downloadDocument(
        document.id,
        document.original_filename,
      );
    } catch (error) {
      toast.error(getError(error));
    }
  };

  const updateField = (event) => {
    const { name, value, files } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "document" ? files?.[0] || null : value,
    }));
  };

  const formatBytes = (size) => {
    if (!size) return "—";
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  };

  return (
    <main className="documents-page">
      <header className="documents-header">
        <div>
          <span className="documents-eyebrow">PATIENT RECORDS</span>
          <h1>Medical Documents</h1>
          <p>Securely manage and retrieve patient-related documents.</p>
        </div>

        <div className="documents-header-actions">
          <button
            type="button"
            className="doc-button doc-button-light"
            onClick={loadDocuments}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
          {!archivedFilter && (
            <button
              type="button"
              className="doc-button doc-button-primary"
              onClick={openUpload}
            >
              <FiUploadCloud /> Upload document
            </button>
          )}
        </div>
      </header>

      <section className="documents-summary">
        <div className="documents-summary-icon">
          <FiFileText />
        </div>
        <div>
          <span>
            {archivedFilter ? "Archived documents" : "Documents found"}
          </span>
          <strong>{pagination.total ?? 0}</strong>
          <p>
            {archivedFilter
              ? "Archived records matching your filters"
              : "Active records matching your filters"}
          </p>
        </div>
      </section>

      <section className="documents-panel">
        <div className="documents-panel-heading">
          <div>
            <h2>Document library</h2>
            <p>Search by title, code, filename, or description.</p>
          </div>
        </div>

        <div className="documents-filters">
          <label className="documents-search">
            <FiSearch />
            <input
              type="search"
              placeholder="Search documents..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            />
          </label>

          <select
            aria-label="Filter documents by category"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="documents-archived-toggle">
            <input
              type="checkbox"
              checked={archivedFilter}
              onChange={(event) => {
                setArchivedFilter(event.target.checked);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            />
            Show archived
          </label>
        </div>

        {loading ? (
          <div className="documents-state">Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="documents-state">
            <FiFileText />
            <strong>No documents found</strong>
            <span>Adjust the filters or upload a document.</span>
          </div>
        ) : (
          <div className="documents-table-wrap">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Patient ID</th>
                  <th>Category</th>
                  <th>Document date</th>
                  <th>File size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="documents-file-cell">
                        <span className="documents-file-icon">
                          <FiFileText />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.document_code}</small>
                          <small className="documents-filename">
                            {item.original_filename}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>#{item.patient_id}</td>
                    <td>
                      <span className="documents-category">
                        {CATEGORIES.find(
                          ([value]) => value === item.category,
                        )?.[1] || item.category}
                      </span>
                    </td>
                    <td>{formatDate(item.document_date)}</td>
                    <td>{formatBytes(Number(item.file_size))}</td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <div className="documents-row-actions">
                        {!item.is_archived && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              title="Edit document details"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(item)}
                              title="Archive document"
                            >
                              <FiArchive />
                            </button>
                          </>
                        )}
                        {!item.is_archived && (
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            title="Download document"
                          >
                            <FiDownload />
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

        <footer className="documents-pagination">
          <span>
            Page {pagination.page || 1} of{" "}
            {Math.max(1, pagination.totalPages || 1)}
          </span>
          <div>
            <button
              type="button"
              className="doc-button doc-button-light"
              disabled={loading || (pagination.page || 1) <= 1}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }))
              }
            >
              Previous
            </button>
            <button
              type="button"
              className="doc-button doc-button-light"
              disabled={
                loading ||
                (pagination.page || 1) >= (pagination.totalPages || 1)
              }
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

      {showUpload && (
        <div className="documents-modal-backdrop">
          <section
            className="documents-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="documents-form-title"
          >
            <div className="documents-modal-heading">
              <div>
                <h2 id="documents-form-title">
                  {editing
                    ? "Edit document details"
                    : "Upload medical document"}
                </h2>
                <p>
                  {editing
                    ? editing.document_code
                    : "PDF, images, text, DOC, or DOCX — maximum 10 MB."}
                </p>
              </div>
              <button
                type="button"
                className="documents-close"
                onClick={closeForm}
                aria-label="Close form"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {!editing && (
                <label>
                  Patient record ID *
                  <input
                    name="patient_id"
                    type="number"
                    min="1"
                    required
                    value={form.patient_id}
                    onChange={updateField}
                  />
                </label>
              )}

              <label>
                Document title *
                <input
                  name="title"
                  maxLength={200}
                  required
                  value={form.title}
                  onChange={updateField}
                />
              </label>

              <div className="documents-form-grid">
                <label>
                  Category *
                  <select
                    name="category"
                    required
                    value={form.category}
                    onChange={updateField}
                  >
                    {CATEGORIES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Document date
                  <input
                    name="document_date"
                    type="date"
                    value={form.document_date}
                    onChange={updateField}
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  maxLength={5000}
                  value={form.description}
                  onChange={updateField}
                />
              </label>

              {!editing && (
                <label className="documents-file-input">
                  Select file *
                  <input
                    name="document"
                    type="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx"
                    onChange={updateField}
                  />
                  {form.document && (
                    <small>
                      Selected: {form.document.name} (
                      {formatBytes(form.document.size)})
                    </small>
                  )}
                </label>
              )}

              <div className="documents-modal-actions">
                <button
                  type="button"
                  className="doc-button doc-button-light"
                  onClick={closeForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="doc-button doc-button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Upload document"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Documents;

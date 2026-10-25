import { useCallback, useEffect, useState } from "react";
import {
  FiArchive,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiMail,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

import contactService from "../../services/contact.service";
import "./ContactMessages.css";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ||
    status ||
    "Unknown"
  );
}

function ContactMessages() {
  const [messages, setMessages] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    new: 0,
    read: 0,
    in_progress: 0,
    resolved: 0,
    archived: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [selected, setSelected] = useState(null);
  const [editStatus, setEditStatus] = useState("new");
  const [adminNotes, setAdminNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);

      setError("");

      try {
        const params = {
          page,
          limit: PAGE_SIZE,
          search: search.trim(),
        };

        if (statusFilter !== "all") {
          params.status = statusFilter;
        }

        const [messagesResponse, summaryResponse] = await Promise.all([
          contactService.getMessages(params),
          contactService.getSummary(),
        ]);

        const rows = Array.isArray(messagesResponse?.data)
          ? messagesResponse.data
          : [];

        setMessages(rows);

        const receivedPagination = messagesResponse?.pagination;

        if (receivedPagination) {
          setPagination({
            page: Number(receivedPagination.page) || page,
            limit: Number(receivedPagination.limit) || PAGE_SIZE,
            total: Number(receivedPagination.total) || 0,
            totalPages: Math.max(1, Number(receivedPagination.totalPages) || 1),
          });
        } else {
          setPagination({
            page,
            limit: PAGE_SIZE,
            total: rows.length,
            totalPages: 1,
          });
        }

        const summaryData = summaryResponse?.data;

        if (summaryData) {
          setSummary((previous) => ({
            ...previous,
            ...summaryData,
          }));
        }

        if (selected) {
          const updatedSelected = rows.find(
            (item) => String(item.id) === String(selected.id),
          );

          if (updatedSelected) {
            setSelected(updatedSelected);
          } else if (statusFilter !== "all" || search.trim()) {
            setSelected(null);
          }
        }
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load contact messages. Check your connection and permissions.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, search, statusFilter, selected],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadData]);

  function openMessage(message) {
    setSelected(message);
    setEditStatus(message.status || "new");
    setAdminNotes(message.admin_notes || "");
    setNotice("");
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!selected || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await contactService.updateMessage(selected.id, {
        status: editStatus,
        admin_notes: adminNotes,
      });

      const updatedMessage = response?.data || {
        ...selected,
        status: editStatus,
        admin_notes: adminNotes,
      };

      setSelected(updatedMessage);
      setEditStatus(updatedMessage.status || editStatus);
      setAdminNotes(updatedMessage.admin_notes || adminNotes);
      setNotice("Message updated successfully.");

      await loadData({ silent: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update this message. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!selected || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await contactService.updateMessage(selected.id, {
        status: "archived",
        admin_notes: adminNotes,
      });

      setSelected((previous) =>
        previous
          ? {
              ...previous,
              status: "archived",
              admin_notes: adminNotes,
            }
          : previous,
      );

      setEditStatus("archived");
      setNotice("Message archived successfully.");

      await loadData({ silent: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to archive this message.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  function handleStatusChange(event) {
    setStatusFilter(event.target.value);
    setPage(1);
  }

  function handleCloseDetails() {
    setSelected(null);
    setNotice("");
  }

  const firstItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * PAGE_SIZE + 1;

  const lastItem = Math.min(pagination.page * PAGE_SIZE, pagination.total);

  return (
    <main className="contact-admin-page">
      <header className="contact-admin-header">
        <div>
          <span className="contact-admin-eyebrow">
            <FiMail />
            ADMINISTRATION
          </span>

          <h1>Contact Messages</h1>

          <p>
            Review inquiries submitted through the public MedAxis contact form
            and track their status.
          </p>
        </div>

        <button
          type="button"
          className="contact-admin-refresh"
          onClick={() => loadData()}
          disabled={loading}
        >
          <FiRefreshCw className={loading ? "is-spinning" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="contact-admin-alert is-error" role="alert">
          <FiX />
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <FiX />
          </button>
        </div>
      )}

      {notice && (
        <div className="contact-admin-alert is-success" role="status">
          <FiCheckCircle />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <FiX />
          </button>
        </div>
      )}

      <section
        className="contact-admin-summary"
        aria-label="Contact message summary"
      >
        <article className="contact-admin-summary-card">
          <div className="contact-admin-summary-icon total">
            <FiMessageSquare />
          </div>
          <div>
            <span>Total messages</span>
            <strong>{summary.total ?? 0}</strong>
          </div>
        </article>

        <article className="contact-admin-summary-card">
          <div className="contact-admin-summary-icon new">
            <FiMail />
          </div>
          <div>
            <span>New messages</span>
            <strong>{summary.new ?? 0}</strong>
          </div>
        </article>

        <article className="contact-admin-summary-card">
          <div className="contact-admin-summary-icon progress">
            <FiClock />
          </div>
          <div>
            <span>In progress</span>
            <strong>{summary.in_progress ?? 0}</strong>
          </div>
        </article>

        <article className="contact-admin-summary-card">
          <div className="contact-admin-summary-icon resolved">
            <FiCheckCircle />
          </div>
          <div>
            <span>Resolved</span>
            <strong>{summary.resolved ?? 0}</strong>
          </div>
        </article>
      </section>

      <section className="contact-admin-workspace">
        <div className="contact-admin-inbox">
          <div className="contact-admin-inbox-heading">
            <div>
              <h2>Inbox</h2>
              <p>
                {pagination.total}{" "}
                {pagination.total === 1 ? "message" : "messages"}
              </p>
            </div>
          </div>

          <div className="contact-admin-filters">
            <label className="contact-admin-search">
              <FiSearch />
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search messages..."
                aria-label="Search contact messages"
              />
            </label>

            <select
              value={statusFilter}
              onChange={handleStatusChange}
              aria-label="Filter by message status"
              className="contact-admin-status-filter"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="contact-admin-message-list">
            {loading ? (
              <div className="contact-admin-empty">
                <FiRefreshCw className="is-spinning" />
                <p>Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="contact-admin-empty">
                <FiMail />
                <h3>No messages found</h3>
                <p>New contact form submissions will appear in this inbox.</p>
              </div>
            ) : (
              messages.map((message) => (
                <button
                  type="button"
                  key={message.id}
                  className={`contact-admin-message-row ${
                    selected && String(selected.id) === String(message.id)
                      ? "is-selected"
                      : ""
                  }`}
                  onClick={() => openMessage(message)}
                >
                  <div className="contact-admin-message-row-top">
                    <strong className="contact-admin-sender">
                      {message.name}
                    </strong>

                    <span
                      className={`contact-admin-status status-${message.status}`}
                    >
                      {getStatusLabel(message.status)}
                    </span>
                  </div>

                  <span className="contact-admin-message-subject">
                    {message.subject}
                  </span>

                  <span className="contact-admin-message-preview">
                    {message.message}
                  </span>

                  <span className="contact-admin-message-meta">
                    <span>{message.email}</span>
                    <span>{formatDate(message.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <footer className="contact-admin-pagination">
            <span>
              Showing {firstItem}–{lastItem} of {pagination.total}
            </span>

            <div className="contact-admin-pagination-buttons">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                <FiChevronLeft />
              </button>

              <span>
                {page} / {pagination.totalPages}
              </span>

              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pagination.totalPages || loading}
                onClick={() =>
                  setPage((previous) =>
                    Math.min(pagination.totalPages, previous + 1),
                  )
                }
              >
                <FiChevronRight />
              </button>
            </div>
          </footer>
        </div>

        <aside className="contact-admin-details">
          {!selected ? (
            <div className="contact-admin-details-empty">
              <div className="contact-admin-details-empty-icon">
                <FiMessageSquare />
              </div>
              <h2>Select a message</h2>
              <p>
                Choose a message from the inbox to read its contents, update its
                status, or add internal notes.
              </p>
            </div>
          ) : (
            <>
              <div className="contact-admin-details-header">
                <div>
                  <span className="contact-admin-section-label">
                    MESSAGE DETAILS
                  </span>
                  <h2>{selected.subject}</h2>
                </div>

                <button
                  type="button"
                  className="contact-admin-close-details"
                  aria-label="Close message details"
                  onClick={handleCloseDetails}
                >
                  <FiX />
                </button>
              </div>

              <div className="contact-admin-sender-card">
                <div className="contact-admin-avatar">
                  {(selected.name || "?").trim().charAt(0).toUpperCase()}
                </div>

                <div className="contact-admin-sender-details">
                  <strong>{selected.name}</strong>
                  <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  <span>Received {formatDate(selected.created_at)}</span>
                </div>
              </div>

              <section className="contact-admin-message-content">
                <h3>Message</h3>
                <p>{selected.message}</p>
              </section>

              <form className="contact-admin-edit-form" onSubmit={handleSave}>
                <div className="contact-admin-field">
                  <label htmlFor="contact-admin-status">Status</label>
                  <select
                    id="contact-admin-status"
                    value={editStatus}
                    onChange={(event) => setEditStatus(event.target.value)}
                    disabled={saving}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="contact-admin-field">
                  <label htmlFor="contact-admin-notes">Internal notes</label>
                  <textarea
                    id="contact-admin-notes"
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    placeholder="Add notes for authorized staff..."
                    rows={5}
                    maxLength={5000}
                    disabled={saving}
                  />
                  <span className="contact-admin-note-count">
                    {adminNotes.length}/5000 characters
                  </span>
                </div>

                <div className="contact-admin-detail-actions">
                  <button
                    type="submit"
                    className="contact-admin-save-button"
                    disabled={saving}
                  >
                    <FiCheckCircle />
                    {saving ? "Saving..." : "Save changes"}
                  </button>

                  {selected.status !== "archived" && (
                    <button
                      type="button"
                      className="contact-admin-archive-button"
                      onClick={handleArchive}
                      disabled={saving}
                    >
                      <FiArchive />
                      Archive
                    </button>
                  )}
                </div>
              </form>

              <p className="contact-admin-private-note">
                Internal notes are intended for authorized staff and should not
                contain unnecessary sensitive information.
              </p>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

export default ContactMessages;

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiFilter,
  FiInbox,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiArchive,
  FiX,
} from "react-icons/fi";

import notificationsService from "../../services/notifications.service";
import "./Notifications.css";

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "appointment", label: "Appointment" },
  { value: "queue", label: "Queue" },
  { value: "laboratory", label: "Laboratory" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "billing", label: "Billing" },
  { value: "emergency", label: "Emergency" },
  { value: "system", label: "System" },
];

const EMPTY_FORM = {
  recipientUserId: "",
  title: "",
  message: "",
  category: "general",
  priority: "normal",
  actionUrl: "",
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null") || {};
  } catch {
    return {};
  }
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function humanize(value = "") {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Notifications() {
  const user = useMemo(() => getCurrentUser(), []);
  const isAdmin = ["super_admin", "hospital_admin"].includes(user?.role);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    category: "all",
    priority: "all",
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadNotifications = useCallback(
    async ({ quiet = false } = {}) => {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = {
          page: pagination.page,
          limit: pagination.limit,
        };

        if (filters.search.trim()) params.search = filters.search.trim();
        if (filters.status !== "all") params.status = filters.status;
        if (filters.category !== "all") params.category = filters.category;
        if (filters.priority !== "all") params.priority = filters.priority;

        const [listResponse, countResponse] = await Promise.all([
          notificationsService.getAll(params),
          notificationsService.getUnreadCount(),
        ]);

        const listBody = listResponse.data;
        setNotifications(Array.isArray(listBody?.data) ? listBody.data : []);
        setPagination((current) => ({
          ...current,
          ...(listBody?.pagination || {}),
        }));
        setUnreadCount(Number(countResponse.data?.unreadCount || 0));
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      pagination.page,
      pagination.limit,
      filters.search,
      filters.status,
      filters.category,
      filters.priority,
    ],
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  function changeFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.recipientUserId.trim() ||
      !form.title.trim() ||
      !form.message.trim()
    ) {
      setError("Recipient user ID, title, and message are required.");
      return;
    }

    setSubmitting(true);

    try {
      await notificationsService.create({
        recipientUserId: form.recipientUserId.trim(),
        title: form.title.trim(),
        message: form.message.trim(),
        category: form.category,
        priority: form.priority,
        actionUrl: form.actionUrl.trim() || null,
      });

      setForm(EMPTY_FORM);
      setShowCreateForm(false);
      setSuccess("Notification sent successfully.");
      setPagination((current) => ({ ...current, page: 1 }));
      await loadNotifications();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(id, action, successMessage) {
    setError("");
    setSuccess("");
    setActionId(id);

    try {
      await action();
      setSuccess(successMessage);
      await loadNotifications({ quiet: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId(null);
    }
  }

  async function handleMarkAllRead() {
    setError("");
    setSuccess("");

    try {
      await notificationsService.markAllAsRead();
      setSuccess("All notifications marked as read.");
      await loadNotifications({ quiet: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  function clearFilters() {
    setFilters({
      search: "",
      status: "all",
      category: "all",
      priority: "all",
    });
    setPagination((current) => ({ ...current, page: 1 }));
  }

  const hasFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.priority !== "all";

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div className="notifications-heading">
          <div className="notifications-heading-icon">
            <FiBell />
          </div>

          <div>
            <p className="notifications-eyebrow">COMMUNICATION CENTER</p>
            <h1>Notifications</h1>
            <p className="notifications-subtitle">
              View updates and important messages related to your work.
            </p>
          </div>
        </div>

        <div className="notifications-header-actions">
          <button
            type="button"
            className="notifications-button notifications-button-secondary"
            onClick={() => loadNotifications({ quiet: true })}
            disabled={refreshing || loading}
          >
            {refreshing ? (
              <FiLoader className="notifications-spin" />
            ) : (
              <FiRefreshCw />
            )}
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              className="notifications-button notifications-button-primary"
              onClick={() => {
                setShowCreateForm((current) => !current);
                setError("");
                setSuccess("");
              }}
            >
              {showCreateForm ? <FiX /> : <FiPlus />}
              {showCreateForm ? "Close form" : "New notification"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          className="notifications-alert notifications-alert-error"
          role="alert"
        >
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

      {success && (
        <div
          className="notifications-alert notifications-alert-success"
          role="status"
        >
          <FiCheckCircle />
          <span>{success}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setSuccess("")}
          >
            <FiX />
          </button>
        </div>
      )}

      <section
        className="notifications-stats"
        aria-label="Notification summary"
      >
        <div className="notifications-stat-card">
          <span className="notifications-stat-icon">
            <FiInbox />
          </span>
          <div>
            <p>Total matching notifications</p>
            <strong>{pagination.total}</strong>
          </div>
        </div>

        <div className="notifications-stat-card">
          <span className="notifications-stat-icon notifications-stat-icon-unread">
            <FiBell />
          </span>
          <div>
            <p>Unread notifications</p>
            <strong>{unreadCount}</strong>
          </div>
        </div>

        <div className="notifications-stat-card">
          <span className="notifications-stat-icon notifications-stat-icon-read">
            <FiCheckCircle />
          </span>
          <div>
            <p>Current page</p>
            <strong>
              {pagination.totalPages ? pagination.page : 0}
              <small> / {pagination.totalPages}</small>
            </strong>
          </div>
        </div>
      </section>

      {showCreateForm && isAdmin && (
        <section className="notifications-create-panel">
          <div className="notifications-panel-heading">
            <div>
              <h2>Send a notification</h2>
              <p>Send an in-app message to one user by their user ID.</p>
            </div>
          </div>

          <form className="notifications-create-form" onSubmit={handleCreate}>
            <div className="notifications-form-grid">
              <label>
                Recipient user ID *
                <input
                  name="recipientUserId"
                  inputMode="numeric"
                  pattern="[0-9]+"
                  value={form.recipientUserId}
                  onChange={updateForm}
                  placeholder="For example, 12"
                  required
                />
              </label>

              <label>
                Notification title *
                <input
                  name="title"
                  maxLength={180}
                  value={form.title}
                  onChange={updateForm}
                  placeholder="Enter a short title"
                  required
                />
              </label>

              <label>
                Category
                <select
                  name="category"
                  value={form.category}
                  onChange={updateForm}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Priority
                <select
                  name="priority"
                  value={form.priority}
                  onChange={updateForm}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <label className="notifications-form-full">
                Message *
                <textarea
                  name="message"
                  rows={4}
                  maxLength={10000}
                  value={form.message}
                  onChange={updateForm}
                  placeholder="Write the notification message..."
                  required
                />
              </label>

              <label className="notifications-form-full">
                Optional internal page path
                <input
                  name="actionUrl"
                  value={form.actionUrl}
                  onChange={updateForm}
                  placeholder="/appointments"
                />
              </label>
            </div>

            <div className="notifications-form-actions">
              <button
                type="button"
                className="notifications-button notifications-button-secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="notifications-button notifications-button-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <FiLoader className="notifications-spin" />
                ) : (
                  <FiSend />
                )}
                {submitting ? "Sending..." : "Send notification"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="notifications-list-panel">
        <div className="notifications-panel-heading notifications-list-heading">
          <div>
            <h2>Your notifications</h2>
            <p>Only notifications addressed to your account are displayed.</p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="notifications-text-button"
              onClick={handleMarkAllRead}
              disabled={loading || refreshing}
            >
              <FiCheck />
              Mark all as read
            </button>
          )}
        </div>

        <div className="notifications-filters">
          <label className="notifications-search">
            <FiSearch />
            <input
              value={filters.search}
              onChange={(event) => changeFilter("search", event.target.value)}
              placeholder="Search title or message..."
              aria-label="Search notifications"
            />
          </label>

          <label className="notifications-filter-field">
            <FiFilter />
            <select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="notifications-filter-field">
            <select
              aria-label="Filter by category"
              value={filters.category}
              onChange={(event) => changeFilter("category", event.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="notifications-filter-field">
            <select
              aria-label="Filter by priority"
              value={filters.priority}
              onChange={(event) => changeFilter("priority", event.target.value)}
            >
              <option value="all">All priorities</option>
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent priority</option>
            </select>
          </label>

          {hasFilters && (
            <button
              type="button"
              className="notifications-clear-button"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="notifications-state">
            <FiLoader className="notifications-state-loader notifications-spin" />
            <p>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-state">
            <span className="notifications-empty-icon">
              <FiInbox />
            </span>
            <h3>No notifications found</h3>
            <p>
              {hasFilters
                ? "Try changing your search or filters."
                : "You are all caught up. New notifications will appear here."}
            </p>
            {hasFilters && (
              <button
                type="button"
                className="notifications-button notifications-button-secondary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => {
              const unread = notification.status === "unread";
              const busy = actionId === notification.id;

              return (
                <article
                  className={`notification-item ${unread ? "notification-item-unread" : ""}`}
                  key={notification.id}
                >
                  <div
                    className={`notification-category-icon notification-category-${notification.category}`}
                  >
                    <FiBell />
                  </div>

                  <div className="notification-content">
                    <div className="notification-title-row">
                      <h3>{notification.title}</h3>
                      {unread && (
                        <span
                          className="notification-unread-dot"
                          title="Unread"
                        />
                      )}
                    </div>

                    <p className="notification-message">
                      {notification.message}
                    </p>

                    <div className="notification-meta">
                      <span
                        className={`notification-priority priority-${notification.priority}`}
                      >
                        {humanize(notification.priority)}
                      </span>
                      <span className="notification-category-label">
                        {humanize(notification.category)}
                      </span>
                      <span className="notification-date">
                        {formatDate(notification.created_at)}
                      </span>
                      {notification.status === "archived" && (
                        <span className="notification-archived-label">
                          Archived
                        </span>
                      )}
                    </div>

                    {notification.action_url && (
                      <a
                        className="notification-action-link"
                        href={notification.action_url}
                      >
                        Open related page <FiExternalLink />
                      </a>
                    )}
                  </div>

                  <div className="notification-actions">
                    {unread && (
                      <button
                        type="button"
                        className="notification-action"
                        title="Mark as read"
                        aria-label={`Mark ${notification.title} as read`}
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            notification.id,
                            () =>
                              notificationsService.markAsRead(notification.id),
                            "Notification marked as read.",
                          )
                        }
                      >
                        <FiCheck />
                      </button>
                    )}

                    {notification.status !== "archived" && (
                      <button
                        type="button"
                        className="notification-action"
                        title="Archive"
                        aria-label={`Archive ${notification.title}`}
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            notification.id,
                            () => notificationsService.archive(notification.id),
                            "Notification archived.",
                          )
                        }
                      >
                        <FiArchive />
                      </button>
                    )}

                    <button
                      type="button"
                      className="notification-action notification-action-delete"
                      title="Delete"
                      aria-label={`Delete ${notification.title}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Delete this notification permanently?",
                          )
                        ) {
                          runAction(
                            notification.id,
                            () => notificationsService.remove(notification.id),
                            "Notification deleted.",
                          );
                        }
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && pagination.totalPages > 1 && (
          <footer className="notifications-pagination">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <div className="notifications-pagination-actions">
              <button
                type="button"
                aria-label="Previous page"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                <FiChevronLeft />
                Previous
              </button>

              <button
                type="button"
                aria-label="Next page"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Next
                <FiChevronRight />
              </button>
            </div>
          </footer>
        )}
      </section>
    </main>
  );
}

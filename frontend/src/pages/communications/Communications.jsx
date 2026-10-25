import { useCallback, useEffect, useState } from "react";
import {
  FiMail,
  FiMessageSquare,
  FiRefreshCw,
  FiSend,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiTrash2,
} from "react-icons/fi";

import communicationsService from "../../services/communications.service";
import "./Communications.css";

const emptyTemplate = {
  template_key: "",
  channel: "email",
  subject: "",
  body: "",
  is_active: true,
};

const emptyMessage = {
  channel: "email",
  recipient: "",
  subject: "",
  body: "",
};

function getError(error) {
  return (
    error?.response?.data?.message || "The operation could not be completed."
  );
}

export default function Communications() {
  const [tab, setTab] = useState("send");
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [template, setTemplate] = useState(emptyTemplate);
  const [message, setMessage] = useState(emptyMessage);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [templateData, logData] = await Promise.all([
        communicationsService.getTemplates(),
        communicationsService.getLogs({
          limit: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);

      setTemplates(templateData.templates || []);
      setLogs(logData.logs || []);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeTemplate = (event) => {
    const { name, value } = event.target;
    setTemplate((current) => ({ ...current, [name]: value }));
  };

  const changeMessage = (event) => {
    const { name, value } = event.target;
    setMessage((current) => ({ ...current, [name]: value }));
  };

  async function saveTemplate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await communicationsService.saveTemplate(template);
      setNotice("Template saved.");
      setTemplate(emptyTemplate);
      await loadData();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await communicationsService.sendMessage(message);
      setNotice(result.message || "Message submitted.");
      setMessage(emptyMessage);
      setTab("logs");
      await loadData();
    } catch (err) {
      setError(getError(err));
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id) {
    if (!window.confirm("Delete this communication template?")) return;

    setError("");
    setNotice("");

    try {
      await communicationsService.deleteTemplate(id);
      setNotice("Template deleted.");
      await loadData();
    } catch (err) {
      setError(getError(err));
    }
  }

  async function retryMessage(id) {
    setError("");
    setNotice("");

    try {
      const result = await communicationsService.retryMessage(id);
      setNotice(result.message || "Retry completed.");
    } catch (err) {
      setError(getError(err));
    } finally {
      await loadData();
    }
  }

  function editTemplate(item) {
    setTemplate({
      template_key: item.template_key,
      channel: item.channel,
      subject: item.subject || "",
      body: item.body,
      is_active: item.is_active,
    });
    setTab("templates");
  }

  function useTemplate(id) {
    const selected = templates.find((item) => String(item.id) === id);
    if (!selected) return;

    setMessage((current) => ({
      ...current,
      channel: selected.channel,
      subject: selected.subject || "",
      body: selected.body,
    }));
    setTab("send");
  }

  return (
    <main className="communications-page">
      <header className="communications-header">
        <div>
          <span className="communications-eyebrow">HOSPITAL OPERATIONS</span>
          <h1>Email &amp; SMS Services</h1>
          <p>
            Manage reusable messages, send communications, and monitor delivery.
          </p>
        </div>
        <button
          type="button"
          className="communications-secondary-button"
          onClick={loadData}
          disabled={loading}
        >
          <FiRefreshCw /> Refresh
        </button>
      </header>

      {error && (
        <div className="communications-alert error">
          <FiAlertCircle /> {error}
        </div>
      )}
      {notice && (
        <div className="communications-alert success">
          <FiCheckCircle /> {notice}
        </div>
      )}

      <nav className="communications-tabs">
        <button
          className={tab === "send" ? "active" : ""}
          onClick={() => setTab("send")}
          type="button"
        >
          <FiSend /> Send message
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
          type="button"
        >
          <FiFileText /> Templates
        </button>
        <button
          className={tab === "logs" ? "active" : ""}
          onClick={() => setTab("logs")}
          type="button"
        >
          <FiMessageSquare /> Delivery logs
        </button>
      </nav>

      {tab === "send" && (
        <section className="communications-card">
          <h2>
            <FiSend /> Send email or SMS
          </h2>
          <p className="communications-help">
            Messages are sent through your configured provider. Check the
            recipient carefully before sending.
          </p>

          <form className="communications-form" onSubmit={sendMessage}>
            <label>
              Channel
              <select
                name="channel"
                value={message.channel}
                onChange={changeMessage}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </label>

            <label>
              Recipient{" "}
              {message.channel === "email" ? "email address" : "phone number"}
              <input
                name="recipient"
                type={message.channel === "email" ? "email" : "tel"}
                value={message.recipient}
                onChange={changeMessage}
                required
                placeholder={
                  message.channel === "email"
                    ? "recipient@example.com"
                    : "+251..."
                }
              />
            </label>

            {message.channel === "email" && (
              <label>
                Subject
                <input
                  name="subject"
                  value={message.subject}
                  onChange={changeMessage}
                  required
                  maxLength={250}
                />
              </label>
            )}

            <label>
              Message
              <textarea
                name="body"
                value={message.body}
                onChange={changeMessage}
                required
                rows={6}
                maxLength={10000}
              />
            </label>

            {templates.length > 0 && (
              <label>
                Insert saved template
                <select
                  defaultValue=""
                  onChange={(event) => useTemplate(event.target.value)}
                >
                  <option value="">Choose a template...</option>
                  {templates
                    .filter((item) => item.is_active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.template_key} ({item.channel})
                      </option>
                    ))}
                </select>
              </label>
            )}

            <button className="communications-primary-button" disabled={saving}>
              <FiSend /> {saving ? "Sending..." : "Send message"}
            </button>
          </form>
        </section>
      )}

      {tab === "templates" && (
        <section className="communications-card">
          <h2>
            <FiFileText /> Message templates
          </h2>

          <form className="communications-form" onSubmit={saveTemplate}>
            <label>
              Template key
              <input
                name="template_key"
                value={template.template_key}
                onChange={changeTemplate}
                required
                maxLength={100}
                placeholder="appointment_reminder"
              />
            </label>

            <label>
              Channel
              <select
                name="channel"
                value={template.channel}
                onChange={changeTemplate}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </label>

            {template.channel === "email" && (
              <label>
                Subject
                <input
                  name="subject"
                  value={template.subject}
                  onChange={changeTemplate}
                  required
                  maxLength={250}
                />
              </label>
            )}

            <label>
              Template body
              <textarea
                name="body"
                value={template.body}
                onChange={changeTemplate}
                required
                rows={5}
                maxLength={10000}
                placeholder="Hello {{patient_name}}, your appointment is..."
              />
            </label>

            <label className="communications-checkbox">
              <input
                type="checkbox"
                checked={template.is_active}
                onChange={(event) =>
                  setTemplate((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              Active template
            </label>

            <button className="communications-primary-button" disabled={saving}>
              {saving ? "Saving..." : "Save template"}
            </button>
          </form>

          <div className="communications-template-list">
            {loading ? (
              <p>Loading templates...</p>
            ) : templates.length === 0 ? (
              <p>No templates created yet.</p>
            ) : (
              templates.map((item) => (
                <article className="communications-template" key={item.id}>
                  <div>
                    <strong>{item.template_key}</strong>
                    <p>
                      {item.channel.toUpperCase()} ·{" "}
                      {item.is_active ? "Active" : "Inactive"}
                    </p>
                    <span>{item.subject || item.body.slice(0, 100)}</span>
                  </div>
                  <div className="communications-row-actions">
                    <button type="button" onClick={() => editTemplate(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="communications-delete"
                      onClick={() => deleteTemplate(item.id)}
                      aria-label={`Delete ${item.template_key}`}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "logs" && (
        <section className="communications-card">
          <div className="communications-logs-heading">
            <h2>
              <FiMessageSquare /> Delivery history
            </h2>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter message status"
            >
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {loading ? (
            <p>Loading delivery history...</p>
          ) : logs.length === 0 ? (
            <div className="communications-empty">
              No delivery records found.
            </div>
          ) : (
            <div className="communications-table-wrap">
              <table className="communications-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        {log.channel === "email" ? (
                          <FiMail />
                        ) : (
                          <FiMessageSquare />
                        )}{" "}
                        {log.channel}
                      </td>
                      <td>
                        <strong>{log.recipient}</strong>
                        {log.error_message && (
                          <small>{log.error_message}</small>
                        )}
                      </td>
                      <td>
                        <span className={`communications-status ${log.status}`}>
                          {log.status}
                        </span>
                      </td>
                      <td>{log.attempts}</td>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        {log.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => retryMessage(log.id)}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

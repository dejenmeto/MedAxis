import { useEffect, useState } from "react";
import {
  FiBell,
  FiCheckCircle,
  FiGlobe,
  FiSave,
  FiSettings,
} from "react-icons/fi";
import toast from "react-hot-toast";
import settingsService from "../../services/settings.service";
import "./Settings.css";

const DEFAULT_SETTINGS = {
  hospitalName: "",
  contactEmail: "",
  phone: "",
  address: "",
  currency: "ETB",
  timeZone: "Africa/Addis_Ababa",
  dateFormat: "YYYY-MM-DD",
  language: "en",
  appointmentDuration: 30,
  lowStockThreshold: 10,
  emailNotifications: true,
  smsNotifications: false,
  appointmentReminders: true,
  lowStockAlerts: true,
};

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const response = await settingsService.get();
        const payload = response.data?.data ?? response.data;

        if (!active) return;

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(payload || {}),
        });

        setUpdatedAt(response.data?.updatedAt || null);
      } catch (err) {
        if (!active) return;

        const message =
          err.response?.data?.message ||
          "Unable to load settings. Check your connection and permissions.";

        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  function updateField(field, value) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await settingsService.update(settings);
      const payload = response.data?.data ?? response.data;

      setSettings({
        ...DEFAULT_SETTINGS,
        ...(payload || {}),
      });

      setUpdatedAt(response.data?.updatedAt || new Date().toISOString());
      toast.success(response.data?.message || "Settings saved successfully.");
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Unable to save settings. Please try again.";

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="settings-page">
        <div className="settings-state">Loading settings…</div>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">MEDAXIS / ADMINISTRATION</p>
          <h1>Settings</h1>
          <p className="settings-description">
            Manage hospital information, system preferences, and notifications.
          </p>
        </div>

        <div className="settings-header-icon">
          <FiSettings />
        </div>
      </header>

      {error && (
        <div className="settings-error" role="alert">
          {error}
        </div>
      )}

      <form className="settings-form" onSubmit={handleSubmit}>
        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <FiGlobe />
            </div>
            <div>
              <h2>Hospital information</h2>
              <p>Contact details displayed in your hospital settings.</p>
            </div>
          </div>

          <div className="settings-fields">
            <label className="settings-field">
              <span>Hospital name</span>
              <input
                type="text"
                maxLength={200}
                value={settings.hospitalName}
                onChange={(e) => updateField("hospitalName", e.target.value)}
                placeholder="Enter hospital name"
              />
            </label>

            <label className="settings-field">
              <span>Contact email</span>
              <input
                type="email"
                maxLength={254}
                value={settings.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                placeholder="hospital@example.com"
              />
            </label>

            <label className="settings-field">
              <span>Phone number</span>
              <input
                type="tel"
                maxLength={40}
                value={settings.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="Enter phone number"
              />
            </label>

            <label className="settings-field settings-field-wide">
              <span>Address</span>
              <textarea
                rows={3}
                maxLength={500}
                value={settings.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Hospital address"
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <FiSettings />
            </div>
            <div>
              <h2>System preferences</h2>
              <p>Set default formats and operational thresholds.</p>
            </div>
          </div>

          <div className="settings-fields">
            <label className="settings-field">
              <span>Currency</span>
              <select
                value={settings.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                <option value="ETB">ETB — Ethiopian Birr</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Time zone</span>
              <select
                value={settings.timeZone}
                onChange={(e) => updateField("timeZone", e.target.value)}
              >
                <option value="Africa/Addis_Ababa">Africa/Addis Ababa</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New York</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Date format</span>
              <select
                value={settings.dateFormat}
                onChange={(e) => updateField("dateFormat", e.target.value)}
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Language</span>
              <select
                value={settings.language}
                onChange={(e) => updateField("language", e.target.value)}
              >
                <option value="en">English</option>
                <option value="am">Amharic</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Default appointment duration (minutes)</span>
              <input
                type="number"
                min="1"
                max="1440"
                value={settings.appointmentDuration}
                onChange={(e) =>
                  updateField("appointmentDuration", e.target.value)
                }
                required
              />
            </label>

            <label className="settings-field">
              <span>Low-stock warning threshold</span>
              <input
                type="number"
                min="0"
                max="100000"
                value={settings.lowStockThreshold}
                onChange={(e) =>
                  updateField("lowStockThreshold", e.target.value)
                }
                required
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <FiBell />
            </div>
            <div>
              <h2>Notification preferences</h2>
              <p>
                Save which notification types the hospital prefers to enable.
                These preferences do not send messages by themselves.
              </p>
            </div>
          </div>

          <div className="settings-toggles">
            <label className="settings-toggle-row">
              <span>
                <strong>Email notifications</strong>
                <small>Allow email notifications when integrated.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) =>
                  updateField("emailNotifications", e.target.checked)
                }
              />
            </label>

            <label className="settings-toggle-row">
              <span>
                <strong>SMS notifications</strong>
                <small>
                  Allow SMS notifications when a provider is connected.
                </small>
              </span>
              <input
                type="checkbox"
                checked={settings.smsNotifications}
                onChange={(e) =>
                  updateField("smsNotifications", e.target.checked)
                }
              />
            </label>

            <label className="settings-toggle-row">
              <span>
                <strong>Appointment reminders</strong>
                <small>
                  Preference for future appointment reminder workflows.
                </small>
              </span>
              <input
                type="checkbox"
                checked={settings.appointmentReminders}
                onChange={(e) =>
                  updateField("appointmentReminders", e.target.checked)
                }
              />
            </label>

            <label className="settings-toggle-row">
              <span>
                <strong>Low-stock alerts</strong>
                <small>Preference for future pharmacy inventory alerts.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.lowStockAlerts}
                onChange={(e) =>
                  updateField("lowStockAlerts", e.target.checked)
                }
              />
            </label>
          </div>
        </section>

        <footer className="settings-footer">
          <div className="settings-saved-info">
            <FiCheckCircle />
            {updatedAt
              ? `Last saved: ${new Date(updatedAt).toLocaleString()}`
              : "Settings have not been saved yet"}
          </div>

          <button
            className="settings-save-button"
            type="submit"
            disabled={saving}
          >
            <FiSave />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </footer>
      </form>
    </main>
  );
}

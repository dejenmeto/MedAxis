import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import patientPortalService from "../../services/patientPortal.service";
import "./PatientPortalAccess.css";

export default function PatientPortalAccess() {
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState({
    portalUserId: "",
    patientId: "",
    relationship: "self",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await patientPortalService.getAccessLinks();
      setLinks(response.data.access || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load portal access links.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  async function createLink(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await patientPortalService.createAccessLink({
        portalUserId: Number(form.portalUserId),
        patientId: Number(form.patientId),
        relationship: form.relationship,
      });

      toast.success("Access link submitted for approval.");
      setForm({
        portalUserId: "",
        patientId: "",
        relationship: "self",
      });
      await loadLinks();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create the access link.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    try {
      await patientPortalService.updateAccessStatus(id, status);
      toast.success(`Access link ${status}.`);
      await loadLinks();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update the access link.",
      );
    }
  }

  return (
    <main className="patient-portal-page">
      <header className="patient-portal-header">
        <span className="patient-portal-eyebrow">ACCESS CONTROL</span>
        <h1>Patient Portal Access</h1>
        <p>Create patient account links and review guardian access.</p>
      </header>

      <section className="patient-portal-panel">
        <h2>Create access link</h2>
        <p className="patient-portal-message">
          Enter existing user and patient IDs. A new link remains pending until
          an authorized administrator approves it.
        </p>

        <form className="patient-portal-admin-form" onSubmit={createLink}>
          <label>
            Portal user ID
            <input
              type="number"
              min="1"
              required
              value={form.portalUserId}
              onChange={(event) =>
                setForm({ ...form, portalUserId: event.target.value })
              }
            />
          </label>

          <label>
            Patient ID
            <input
              type="number"
              min="1"
              required
              value={form.patientId}
              onChange={(event) =>
                setForm({ ...form, patientId: event.target.value })
              }
            />
          </label>

          <label>
            Relationship
            <select
              value={form.relationship}
              onChange={(event) =>
                setForm({ ...form, relationship: event.target.value })
              }
            >
              <option value="self">Patient's own account</option>
              <option value="guardian">Guardian</option>
            </select>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create link"}
          </button>
        </form>
      </section>

      <section className="patient-portal-panel">
        <div className="patient-portal-records-heading">
          <h2>Access requests</h2>
          <button
            className="patient-portal-admin-secondary"
            type="button"
            onClick={loadLinks}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="patient-portal-message">Loading access requests...</p>
        ) : links.length === 0 ? (
          <p className="patient-portal-message">No access links found.</p>
        ) : (
          <div className="patient-portal-admin-table-wrap">
            <table className="patient-portal-admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Patient ID</th>
                  <th>Relationship</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>
                      {link.portal_user_email || `User #${link.portal_user_id}`}
                    </td>
                    <td>{link.patient_id}</td>
                    <td>{link.relationship}</td>
                    <td>{link.status}</td>
                    <td>
                      <div className="patient-portal-admin-actions">
                        {link.status !== "approved" && (
                          <button
                            type="button"
                            onClick={() => changeStatus(link.id, "approved")}
                          >
                            Approve
                          </button>
                        )}
                        {link.status !== "revoked" && (
                          <button
                            type="button"
                            className="patient-portal-admin-danger"
                            onClick={() => changeStatus(link.id, "revoked")}
                          >
                            Revoke
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

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import api from "../../services/api";
import "./Departments.css";

function getRows(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.departments)) return data.departments;
  return [];
}

const emptyForm = {
  name: "",
  code: "",
  description: "",
  location: "",
  is_active: true,
};

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/departments", {
        params: { search: search.trim() || undefined, page: 1, limit: 100 },
      });
      setDepartments(getRows(response));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load departments.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(department) {
    setEditing(department);
    setForm({
      name: department.name || "",
      code: department.code || "",
      description: department.description || "",
      location: department.location || "",
      is_active: department.is_active !== false,
    });
    setShowForm(true);
  }

  async function saveDepartment(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Department name and code are required.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}`, form);
        toast.success("Department updated.");
      } else {
        await api.post("/departments", form);
        toast.success("Department created.");
      }
      setShowForm(false);
      await loadDepartments();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to save department.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="departments-page">
      <header className="departments-heading">
        <div>
          <span className="departments-eyebrow">ORGANIZATION</span>
          <h1>Departments</h1>
          <p>Manage hospital departments and service locations.</p>
        </div>
        <button className="departments-primary" onClick={openCreate}>
          <FiPlus /> Add department
        </button>
      </header>

      <section className="departments-panel">
        <div className="departments-toolbar">
          <div className="departments-search">
            <FiSearch />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments..."
            />
          </div>
          <button
            className="departments-refresh"
            onClick={loadDepartments}
            disabled={loading}
            aria-label="Refresh"
          >
            <FiRefreshCw />
          </button>
        </div>

        <div className="table-responsive">
          <table className="table departments-table align-middle">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Location</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="departments-empty">
                    Loading departments...
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="departments-empty">
                    No departments found.
                  </td>
                </tr>
              ) : (
                departments.map((department) => (
                  <tr key={department.id}>
                    <td>
                      <strong>{department.name}</strong>
                    </td>
                    <td>{department.code || "—"}</td>
                    <td>{department.location || "—"}</td>
                    <td>{department.description || "—"}</td>
                    <td>
                      <span
                        className={`department-status ${department.is_active === false ? "department-inactive" : "department-active"}`}
                      >
                        {department.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="department-edit"
                        onClick={() => openEdit(department)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="departments-backdrop">
          <section className="departments-modal">
            <header className="departments-modal-heading">
              <h2>{editing ? "Edit department" : "Create department"}</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form className="departments-form" onSubmit={saveDepartment}>
              <label>
                Department name *
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Department code *
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </label>
              <label>
                Location
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              {editing && (
                <label className="departments-checkbox">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                  />{" "}
                  Active
                </label>
              )}
              <div className="departments-modal-actions">
                <button
                  type="button"
                  className="departments-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="departments-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save department"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

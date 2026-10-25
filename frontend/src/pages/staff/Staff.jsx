import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import api from "../../services/api";
import "./Staff.css";

function getRows(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.staff)) return data.staff;
  return [];
}

const blankForm = {
  user_id: "",
  department_id: "",
  employee_number: "",
  job_title: "",
  employment_type: "full_time",
  phone: "",
};

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffResponse, departmentResponse] = await Promise.all([
        api.get("/staff", {
          params: { search: search.trim() || undefined, page: 1, limit: 100 },
        }),
        api.get("/departments", { params: { limit: 500 } }),
      ]);
      setStaff(getRows(staffResponse));
      setDepartments(getRows(departmentResponse));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load staff records.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function createStaff(event) {
    event.preventDefault();
    if (
      !form.user_id.trim() ||
      !form.employee_number.trim() ||
      !form.job_title.trim()
    ) {
      toast.error("User ID, employee number and job title are required.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/staff", {
        user_id: form.user_id.trim(),
        employee_id: form.employee_number.trim(),
        department_id: form.department_id || null,
        specialization: form.job_title.trim(),
      });

      toast.success("Staff profile created.");
      setForm(blankForm);
      setShowForm(false);
      await loadData();
    } catch (error) {
      console.error("Create staff error:", error.response?.data || error);

      toast.error(
        error.response?.data?.message || "Unable to create staff profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="staff-page">
      <header className="staff-heading">
        <div>
          <span className="staff-eyebrow">HUMAN RESOURCES</span>
          <h1>Staff management</h1>
          <p>Manage employee profiles and department assignments.</p>
        </div>
        <button className="staff-primary" onClick={() => setShowForm(true)}>
          <FiPlus /> Add staff profile
        </button>
      </header>

      <section className="staff-panel">
        <div className="staff-toolbar">
          <div className="staff-search">
            <FiSearch />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
            />
          </div>
          <button
            className="staff-refresh"
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh"
          >
            <FiRefreshCw />
          </button>
        </div>
        <div className="table-responsive">
          <table className="table staff-table align-middle">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee number</th>
                <th>Job title</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="staff-empty">
                    Loading staff...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="staff-empty">
                    No staff profiles found.
                  </td>
                </tr>
              ) : (
                staff.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <strong>
                        {person.first_name || ""} {person.last_name || ""}
                      </strong>
                      <small>{person.email || ""}</small>
                    </td>
                    <td>{person.employee_id || "—"}</td>
                    <td>{person.specialization || "—"}</td>
                    <td>{person.department_name || "—"}</td>
                    <td>{person.phone || "—"}</td>
                    <td>
                      <span
                        className={`staff-status ${person.is_active === false ? "staff-inactive" : "staff-active"}`}
                      >
                        {person.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="staff-backdrop">
          <section className="staff-modal">
            <header className="staff-modal-heading">
              <h2>Create staff profile</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form className="staff-form" onSubmit={createStaff}>
              <label>
                User ID *
                <input
                  value={form.user_id}
                  onChange={(e) =>
                    setForm({ ...form, user_id: e.target.value })
                  }
                  placeholder="ID of an existing staff use"
                  required
                />
              </label>
              <label>
                Employee number *
                <input
                  value={form.employee_number}
                  onChange={(e) =>
                    setForm({ ...form, employee_number: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Job title *
                <input
                  value={form.job_title}
                  onChange={(e) =>
                    setForm({ ...form, job_title: e.target.value })
                  }
                  placeholder="e.g. Registered nurse"
                  required
                />
              </label>
              <label>
                Department
                {/* <select
                  value={form.department_id}
                  onChange={(e) =>
                    setForm({ ...form, department_id: e.target.value })
                  }
                >
                  <option value="">No department selected</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select> */}
                <select
                  name="department_id"
                  value={form.department_id}
                  onChange={(event) =>
                    setForm({ ...form, department_id: event.target.value })
                  }
                >
                  <option value="">Select department</option>

                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Employment type
                <select
                  value={form.employment_type}
                  onChange={(e) =>
                    setForm({ ...form, employment_type: e.target.value })
                  }
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                </select>
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <div className="staff-modal-actions">
                <button
                  type="button"
                  className="staff-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="staff-primary" disabled={saving}>
                  {saving ? "Saving..." : "Create profile"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

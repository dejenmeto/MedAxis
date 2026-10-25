import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiRefreshCw, FiSearch, FiUsers } from "react-icons/fi";
import api from "../../services/api";
import "./UserManagement.css";

const roles = [
  "hospital_admin",
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "radiologist",
  "pharmacist",
  "accountant",
  "patient",
  "guardian",
];

const blankForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  role: "receptionist",
  hospital_id: "",
};

function getRows(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  return [];
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/users", {
        params: {
          search: search.trim() || undefined,
          role: roleFilter || undefined,
          page: 1,
          limit: 100,
        },
      });
      setUsers(getRows(response));
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function createUser(event) {
    event.preventDefault();

    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      toast.error("Complete all required fields.");
      return;
    }

    if (form.password.length < 12) {
      toast.error("Use a password containing at least 12 characters.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
      };

      if (!payload.hospital_id) delete payload.hospital_id;

      await api.post("/users", payload);
      toast.success("User account created.");
      setForm(blankForm);
      setShowForm(false);
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateUser(user) {
    if (
      !window.confirm(
        `Deactivate the account for ${user.first_name} ${user.last_name}?`,
      )
    ) {
      return;
    }

    try {
      await api.patch(`/users/${user.id}/deactivate`);
      toast.success("User deactivated.");
      await loadUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to deactivate user.",
      );
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}`, {
        is_active: !user.is_active,
      });
      toast.success(user.is_active ? "User deactivated." : "User activated.");
      await loadUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update user status.",
      );
    }
  }

  const activeCount = users.filter((user) => user.is_active).length;

  return (
    <main className="users-page">
      <header className="users-heading">
        <div>
          <span className="users-eyebrow">SYSTEM ADMINISTRATION</span>
          <h1>User management</h1>
          <p>Manage user accounts, application roles and account status.</p>
        </div>
        <button className="users-primary" onClick={() => setShowForm(true)}>
          <FiPlus /> Create user
        </button>
      </header>

      <div className="users-stats">
        <article>
          <span className="users-stat-icon">
            <FiUsers />
          </span>
          <div>
            <small>Users displayed</small>
            <strong>{users.length}</strong>
          </div>
        </article>
        <article>
          <span className="users-stat-icon">
            <FiUsers />
          </span>
          <div>
            <small>Active users displayed</small>
            <strong>{activeCount}</strong>
          </div>
        </article>
        <button
          className="users-refresh"
          onClick={loadUsers}
          disabled={loading}
          aria-label="Refresh users"
        >
          <FiRefreshCw />
        </button>
      </div>

      <section className="users-panel">
        <div className="users-toolbar">
          <div className="users-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email..."
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.replaceAll("_", " ")}
              </option>
            ))}
            <option value="super_admin">super admin</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="table users-table align-middle">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="users-empty">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="users-empty">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.first_name} {user.last_name}
                      </strong>
                      <small>{user.id}</small>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className="users-role">
                        {String(user.role || "").replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`users-status ${user.is_active ? "users-active" : "users-inactive"}`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="users-action"
                        onClick={() => toggleActive(user)}
                        disabled={user.role === "super_admin"}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {user.is_active && user.role !== "super_admin" && (
                        <button
                          className="users-action users-danger"
                          onClick={() => deactivateUser(user)}
                        >
                          Disable
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="users-backdrop">
          <section className="users-modal">
            <header className="users-modal-heading">
              <div>
                <span className="users-eyebrow">NEW ACCOUNT</span>
                <h2>Create user</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <form className="users-form" onSubmit={createUser}>
              <div className="users-form-row">
                <label>
                  First name *
                  <input
                    value={form.first_name}
                    onChange={(e) =>
                      setForm({ ...form, first_name: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Last name *
                  <input
                    value={form.last_name}
                    onChange={(e) =>
                      setForm({ ...form, last_name: e.target.value })
                    }
                    required
                  />
                </label>
              </div>

              <label>
                Email address *
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </label>

              <label>
                Temporary password *
                <input
                  type="password"
                  minLength="12"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />
                <small>
                  Use at least 12 characters. Share credentials securely and
                  require a password change where supported.
                </small>
              </label>

              <label>
                Application role *
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  required
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Hospital ID
                <input
                  value={form.hospital_id}
                  onChange={(e) =>
                    setForm({ ...form, hospital_id: e.target.value })
                  }
                  placeholder="Leave blank if your backend selects the hospital"
                />
              </label>

              <p className="users-form-note">
                The server must validate the role and hospital assignment. A
                hospital administrator must not be able to create global
                super-admin accounts.
              </p>

              <div className="users-modal-actions">
                <button
                  type="button"
                  className="users-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="users-primary" disabled={saving}>
                  {saving ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

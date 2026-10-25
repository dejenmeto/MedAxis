import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import patientsService from "../../services/patients.service";
import "./Patients.css";

const emptyForm = {
  mr_number: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  blood_group: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

const PAGE_SIZE = 10;

// Generate a practical medical record number for a new patient.
function generateMrNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MR-${timestamp}-${randomPart}`;
}

function extractRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.patients)) return result.patients;
  if (Array.isArray(result?.data?.patients)) return result.data.patients;
  return [];
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadPatients = useCallback(async () => {
    setLoading(true);

    try {
      const result = await patientsService.list({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
      });

      const rows = extractRows(result);
      setPatients(rows);
      setTotal(
        Number(
          result?.pagination?.total ??
            result?.total ??
            result?.data?.total ??
            rows.length,
        ),
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load patient records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  function openCreateForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      mr_number: generateMrNumber(),
    });
    setShowForm(true);
  }

  function openEditForm(patient) {
    setEditingId(patient.id);
    setForm({
      ...emptyForm,
      ...patient,
      mr_number: patient.mr_number || "",
      gender: patient.gender || "",
      date_of_birth: patient.date_of_birth
        ? String(patient.date_of_birth).slice(0, 10)
        : "",
    });
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.mr_number.trim()) {
      toast.error("Medical record number is required.");
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First name and last name are required.");
      return;
    }

    setSaving(true);

    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() || null : value,
      ]),
    );

    try {
      if (editingId) {
        await patientsService.update(editingId, payload);
        toast.success("Patient record updated.");
      } else {
        await patientsService.create(payload);
        toast.success("Patient registered successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadPatients();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to save patient record.",
      );
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="patients-page">
      <div className="page-heading-row">
        <div>
          <span className="page-eyebrow">PATIENT SERVICES</span>
          <h1>Patients</h1>
          <p>Register patients and manage demographic records.</p>
        </div>

        <button
          type="button"
          className="patients-primary-button"
          onClick={openCreateForm}
        >
          <FiPlus /> Register patient
        </button>
      </div>

      <div className="patients-summary">
        <div className="patients-summary-icon">
          <FiUsers />
        </div>
        <div>
          <span>Records matching your search</span>
          <strong>{total.toLocaleString()}</strong>
        </div>
        <button
          type="button"
          className="patients-icon-button"
          onClick={loadPatients}
          disabled={loading}
          title="Refresh patient list"
          aria-label="Refresh patient list"
        >
          <FiRefreshCw />
        </button>
      </div>

      <div className="patients-table-card">
        <div className="patients-toolbar">
          <div>
            <h2>Patient directory</h2>
            <p>Search by name, patient number, phone or email.</p>
          </div>

          <div className="patients-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search patients..."
              aria-label="Search patients"
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table patients-table align-middle">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Medical record number</th>
                <th>Gender</th>
                <th>Date of birth</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="patients-empty">
                    Loading patient records...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="patients-empty">
                    No patients found. Register a patient or change your search.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="patient-name-cell">
                        <span className="patient-avatar">
                          {patient.first_name?.charAt(0)?.toUpperCase() || "P"}
                        </span>
                        <div>
                          <strong>
                            {patient.first_name} {patient.last_name}
                          </strong>
                          <small>{patient.email || "No email provided"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{patient.mr_number || "—"}</td>
                    <td>{patient.gender || "—"}</td>
                    <td>
                      {patient.date_of_birth
                        ? new Date(patient.date_of_birth).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{patient.phone || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="patients-edit-button"
                        onClick={() => openEditForm(patient)}
                        aria-label={`Edit ${patient.first_name} ${patient.last_name}`}
                      >
                        <FiEdit2 /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="patients-pagination">
          <span>
            Page {page} of {totalPages}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div
          className="patients-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowForm(false);
            }
          }}
        >
          <section
            className="patients-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-form-title"
          >
            <div className="patients-modal-heading">
              <div>
                <span className="page-eyebrow">PATIENT REGISTRATION</span>
                <h2 id="patient-form-title">
                  {editingId ? "Edit patient" : "Register new patient"}
                </h2>
              </div>
              <button
                type="button"
                className="patients-icon-button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="patients-form-grid">
                <FormField
                  label="Medical record number *"
                  name="mr_number"
                  value={form.mr_number}
                  onChange={updateField}
                  required
                />

                <FormField
                  label="First name *"
                  name="first_name"
                  value={form.first_name}
                  onChange={updateField}
                  required
                />

                <FormField
                  label="Last name *"
                  name="last_name"
                  value={form.last_name}
                  onChange={updateField}
                  required
                />

                <label>
                  <span>Date of birth</span>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={form.date_of_birth || ""}
                    onChange={updateField}
                  />
                </label>

                <label>
                  <span>Gender</span>
                  <select
                    name="gender"
                    value={form.gender || ""}
                    onChange={updateField}
                  >
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>

                <FormField
                  label="Phone"
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                />

                <FormField
                  label="Email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  type="email"
                />

                <label>
                  <span>Blood group</span>
                  <select
                    name="blood_group"
                    value={form.blood_group || ""}
                    onChange={updateField}
                  >
                    <option value="">Unknown</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <FormField
                  label="Emergency contact name"
                  name="emergency_contact_name"
                  value={form.emergency_contact_name}
                  onChange={updateField}
                />

                <FormField
                  label="Emergency contact phone"
                  name="emergency_contact_phone"
                  value={form.emergency_contact_phone}
                  onChange={updateField}
                />

                <label className="patients-full-width">
                  <span>Address</span>
                  <textarea
                    name="address"
                    value={form.address || ""}
                    onChange={updateField}
                    rows="3"
                  />
                </label>
              </div>

              <div className="patients-modal-actions">
                <button
                  type="button"
                  className="patients-cancel-button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="patients-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Register patient"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
      />
    </label>
  );
}

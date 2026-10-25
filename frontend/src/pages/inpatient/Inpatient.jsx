import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import "./Inpatient.css";

import {
  listRooms,
  createRoom,
  updateRoom,
  deactivateRoom,
  listBeds,
  createBed,
  updateBed,
  listAdmissions,
  createAdmission,
  updateAdmission,
  dischargeAdmission,
  cancelAdmission,
} from "../../services/inpatient.service";

const EMPTY_ROOM = {
  room_number: "",
  room_type: "general",
  floor_number: "",
  department_id: "",
  daily_rate: "0",
};

const EMPTY_BED = {
  room_id: "",
  bed_number: "",
  bed_status: "available",
  notes: "",
};

const EMPTY_ADMISSION = {
  patient_id: "",
  bed_id: "",
  admission_number: "",
  admission_type: "routine",
  admission_reason: "",
  attending_staff_id: "",
  expected_discharge_at: "",
};

const ROOM_TYPES = [
  "general",
  "private",
  "semi-private",
  "icu",
  "maternity",
  "isolation",
  "pediatric",
  "surgical",
];

const BED_STATUSES = ["available", "occupied", "maintenance", "reserved"];

const ADMISSION_STATUSES = [
  "admitted",
  "discharged",
  "transferred",
  "cancelled",
];

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

/**
 * Supports common API response shapes:
 * { data: [...] }
 * { data: { data: [...] } }
 * [...]
 */
function getRecords(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.data?.data)) return result.data.data;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 16);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ value }) {
  const status = String(value || "unknown").toLowerCase();

  return (
    <span className={`ip-status ip-status-${status}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function FormField({ label, children, wide = false }) {
  return (
    <label className={`ip-field${wide ? " ip-field-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function Inpatient() {
  const [activeTab, setActiveTab] = useState("rooms");

  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [roomForm, setRoomForm] = useState({ ...EMPTY_ROOM });
  const [bedForm, setBedForm] = useState({ ...EMPTY_BED });
  const [admissionForm, setAdmissionForm] = useState({
    ...EMPTY_ADMISSION,
  });

  const [editingRoom, setEditingRoom] = useState(null);
  const [editingBed, setEditingBed] = useState(null);
  const [editingAdmission, setEditingAdmission] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const roomStatus = activeTab === "rooms" ? statusFilter : "all";

      const bedStatus = activeTab === "beds" ? statusFilter : "all";

      const admissionStatus = activeTab === "admissions" ? statusFilter : "all";

      const [roomResult, bedResult, admissionResult] = await Promise.all([
        listRooms({
          page: 1,
          limit: 100,
          search,
          status: roomStatus,
        }),
        listBeds({
          page: 1,
          limit: 100,
          search,
          status: bedStatus,
        }),
        listAdmissions({
          page: 1,
          limit: 100,
          search,
          status: admissionStatus,
        }),
      ]);

      setRooms(getRecords(roomResult));
      setBeds(getRecords(bedResult));
      setAdmissions(getRecords(admissionResult));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadData]);

  const resetForms = () => {
    setRoomForm({ ...EMPTY_ROOM });
    setBedForm({ ...EMPTY_BED });
    setAdmissionForm({ ...EMPTY_ADMISSION });

    setEditingRoom(null);
    setEditingBed(null);
    setEditingAdmission(null);
  };

  const resetCurrentForm = () => {
    if (activeTab === "rooms") {
      setRoomForm({ ...EMPTY_ROOM });
      setEditingRoom(null);
    } else if (activeTab === "beds") {
      setBedForm({ ...EMPTY_BED });
      setEditingBed(null);
    } else {
      setAdmissionForm({ ...EMPTY_ADMISSION });
      setEditingAdmission(null);
    }
  };

  const changeTab = (tab) => {
    resetForms();
    setActiveTab(tab);
    setSearch("");
    setStatusFilter("all");
  };

  // ---------------------------
  // ROOMS
  // ---------------------------

  const submitRoom = async (event) => {
    event.preventDefault();

    if (saving) return;

    const departmentId = String(roomForm.department_id ?? "").trim();

    if (departmentId && !/^[1-9]\d*$/.test(departmentId)) {
      toast.error(
        "Department ID must be a positive integer, or leave it empty.",
      );
      return;
    }

    const dailyRate = Number(roomForm.daily_rate);

    if (!Number.isFinite(dailyRate) || dailyRate < 0) {
      toast.error("Daily rate must be zero or greater.");
      return;
    }

    const payload = {
      room_number: roomForm.room_number.trim(),
      room_type: roomForm.room_type,
      floor_number: roomForm.floor_number.trim() || null,
      department_id: departmentId || null,
      daily_rate: dailyRate,
    };

    setSaving(true);

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, payload);
        toast.success("Room updated successfully.");
      } else {
        await createRoom(payload);
        toast.success("Room created successfully.");
      }

      setRoomForm({ ...EMPTY_ROOM });
      setEditingRoom(null);

      await loadData();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const startEditRoom = (room) => {
    setEditingRoom(room);

    setRoomForm({
      room_number: room.room_number || "",
      room_type: room.room_type || "general",
      floor_number: room.floor_number || "",
      department_id:
        room.department_id == null ? "" : String(room.department_id),
      daily_rate: String(room.daily_rate ?? 0),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeactivateRoom = async (room) => {
    const confirmed = window.confirm(`Deactivate room ${room.room_number}?`);

    if (!confirmed) return;

    try {
      await deactivateRoom(room.id);

      toast.success("Room deactivated successfully.");

      if (editingRoom?.id === room.id) {
        setRoomForm({ ...EMPTY_ROOM });
        setEditingRoom(null);
      }

      await loadData();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  // ---------------------------
  // BEDS
  // ---------------------------

  const submitBed = async (event) => {
    event.preventDefault();

    if (saving) return;

    const payload = {
      room_id: bedForm.room_id,
      bed_number: bedForm.bed_number.trim(),
      notes: bedForm.notes.trim() || null,
    };

    if (editingBed) {
      payload.bed_status = bedForm.bed_status;
    }

    setSaving(true);

    try {
      if (editingBed) {
        await updateBed(editingBed.id, payload);
        toast.success("Bed updated successfully.");
      } else {
        await createBed(payload);
        toast.success("Bed created successfully.");
      }

      setBedForm({ ...EMPTY_BED });
      setEditingBed(null);

      await loadData();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const startEditBed = (bed) => {
    setEditingBed(bed);

    setBedForm({
      room_id: bed.room_id || "",
      bed_number: bed.bed_number || "",
      bed_status: bed.bed_status || "available",
      notes: bed.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------
  // ADMISSIONS
  // ---------------------------

  const submitAdmission = async (event) => {
    event.preventDefault();

    if (saving) return;

    const patientId = String(admissionForm.patient_id ?? "").trim();

    const staffId = String(admissionForm.attending_staff_id ?? "").trim();

    if (!editingAdmission && !/^[1-9]\d*$/.test(patientId)) {
      toast.error("Enter a valid positive Patient ID.");
      return;
    }

    if (staffId && !/^[1-9]\d*$/.test(staffId)) {
      toast.error(
        "Attending Staff ID must be a positive integer, or leave it empty.",
      );
      return;
    }

    let expectedDischargeAt = null;

    if (admissionForm.expected_discharge_at) {
      const expectedDate = new Date(admissionForm.expected_discharge_at);

      if (Number.isNaN(expectedDate.getTime())) {
        toast.error("Enter a valid expected discharge date.");
        return;
      }

      expectedDischargeAt = expectedDate.toISOString();
    }

    const payload = {
      admission_type: admissionForm.admission_type,
      admission_reason: admissionForm.admission_reason.trim(),
      attending_staff_id: staffId || null,
      expected_discharge_at: expectedDischargeAt,
    };

    if (!editingAdmission) {
      payload.patient_id = patientId;
      payload.bed_id = admissionForm.bed_id;
      payload.admission_number = admissionForm.admission_number.trim();
    }

    setSaving(true);

    try {
      if (editingAdmission) {
        await updateAdmission(editingAdmission.id, payload);
        toast.success("Admission updated successfully.");
      } else {
        await createAdmission(payload);
        toast.success("Patient admitted successfully.");
      }

      setAdmissionForm({ ...EMPTY_ADMISSION });
      setEditingAdmission(null);

      await loadData();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const startEditAdmission = (admission) => {
    setEditingAdmission(admission);

    setAdmissionForm({
      patient_id: String(admission.patient_id || ""),
      bed_id: admission.bed_id || "",
      admission_number: admission.admission_number || "",
      admission_type: admission.admission_type || "routine",
      admission_reason: admission.admission_reason || "",
      attending_staff_id:
        admission.attending_staff_id == null
          ? ""
          : String(admission.attending_staff_id),
      expected_discharge_at: toDateTimeLocal(admission.expected_discharge_at),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDischarge = async (admission) => {
    const notes = window.prompt(
      `Discharge notes for ${admission.admission_number}:`,
      "",
    );

    if (notes === null) return;

    try {
      await dischargeAdmission(admission.id, notes.trim());

      toast.success("Patient discharged successfully.");

      await loadData();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleCancelAdmission = async (admission) => {
    const reason = window.prompt(
      `Reason for cancelling ${admission.admission_number}:`,
      "",
    );

    if (reason === null) return;

    try {
      await cancelAdmission(admission.id, reason.trim());

      toast.success("Admission cancelled successfully.");

      await loadData();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  // ---------------------------
  // DERIVED VALUES
  // ---------------------------

  const availableBeds = beds.filter((bed) => bed.bed_status === "available");

  const activeAdmissions = admissions.filter(
    (admission) => admission.admission_status === "admitted",
  );

  const availableBedCount = availableBeds.length;

  const occupiedBedCount = beds.filter(
    (bed) => bed.bed_status === "occupied",
  ).length;

  return (
    <main className="inpatient-page">
      <header className="ip-page-header">
        <div>
          <p className="ip-eyebrow">CLINICAL OPERATIONS</p>
          <h1>Inpatient &amp; Beds</h1>
          <p className="ip-subtitle">
            Manage rooms, bed availability, admissions, and patient discharge.
          </p>
        </div>

        <button
          className="ip-button ip-button-secondary"
          type="button"
          onClick={loadData}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </header>

      <section className="ip-stat-grid">
        <article className="ip-stat-card">
          <span className="ip-stat-icon">▦</span>
          <div>
            <span>Total rooms</span>
            <strong>{rooms.length}</strong>
          </div>
        </article>

        <article className="ip-stat-card">
          <span className="ip-stat-icon ip-green">✓</span>
          <div>
            <span>Available beds</span>
            <strong>{availableBedCount}</strong>
          </div>
        </article>

        <article className="ip-stat-card">
          <span className="ip-stat-icon ip-orange">▣</span>
          <div>
            <span>Occupied beds</span>
            <strong>{occupiedBedCount}</strong>
          </div>
        </article>

        <article className="ip-stat-card">
          <span className="ip-stat-icon ip-blue">♡</span>
          <div>
            <span>Active admissions</span>
            <strong>{activeAdmissions.length}</strong>
          </div>
        </article>
      </section>

      <nav className="ip-tabs" aria-label="Inpatient sections">
        {[
          ["rooms", "Rooms"],
          ["beds", "Beds"],
          ["admissions", "Admissions"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeTab === value ? "ip-tab ip-tab-active" : "ip-tab"}
            onClick={() => changeTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="ip-toolbar">
        <div className="ip-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${activeTab}...`}
            aria-label={`Search ${activeTab}`}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>

          {activeTab === "rooms" && (
            <>
              <option value="active">Active rooms</option>
              <option value="inactive">Inactive rooms</option>
            </>
          )}

          {activeTab === "beds" &&
            BED_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}

          {activeTab === "admissions" &&
            ADMISSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
        </select>
      </section>

      {/* ROOMS TAB */}
      {activeTab === "rooms" && (
        <>
          <section className="ip-panel">
            <div className="ip-panel-heading">
              <div>
                <h2>{editingRoom ? "Edit room" : "Add room"}</h2>
                <p>Register a room and configure its type and daily rate.</p>
              </div>

              {editingRoom && (
                <button
                  className="ip-button ip-button-secondary"
                  type="button"
                  onClick={resetCurrentForm}
                >
                  Cancel editing
                </button>
              )}
            </div>

            <form className="ip-form-grid" onSubmit={submitRoom}>
              <FormField label="Room number">
                <input
                  required
                  maxLength={50}
                  value={roomForm.room_number}
                  onChange={(event) =>
                    setRoomForm((previous) => ({
                      ...previous,
                      room_number: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Room type">
                <select
                  value={roomForm.room_type}
                  onChange={(event) =>
                    setRoomForm((previous) => ({
                      ...previous,
                      room_type: event.target.value,
                    }))
                  }
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Floor">
                <input
                  maxLength={30}
                  value={roomForm.floor_number}
                  onChange={(event) =>
                    setRoomForm((previous) => ({
                      ...previous,
                      floor_number: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Department ID (optional)">
                <input
                  inputMode="numeric"
                  value={roomForm.department_id}
                  onChange={(event) =>
                    setRoomForm((previous) => ({
                      ...previous,
                      department_id: event.target.value,
                    }))
                  }
                  placeholder="Existing department ID"
                />
                <small className="ip-help">
                  Leave empty if the room is not assigned to a department.
                </small>
              </FormField>

              <FormField label="Daily rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={roomForm.daily_rate}
                  onChange={(event) =>
                    setRoomForm((previous) => ({
                      ...previous,
                      daily_rate: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="ip-form-actions">
                <button
                  className="ip-button ip-button-primary"
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? "Saving..."
                    : editingRoom
                      ? "Save changes"
                      : "Create room"}
                </button>
              </div>
            </form>
          </section>

          <section className="ip-panel">
            <div className="ip-panel-heading">
              <div>
                <h2>Rooms</h2>
                <p>{rooms.length} room records returned</p>
              </div>
            </div>

            <div className="ip-table-wrap">
              <table className="ip-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Type</th>
                    <th>Floor</th>
                    <th>Beds</th>
                    <th>Daily rate</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <strong>{room.room_number}</strong>
                        <small>{room.department_name || "No department"}</small>
                      </td>

                      <td>{room.room_type}</td>
                      <td>{room.floor_number || "—"}</td>

                      <td>
                        {room.available_beds ?? 0} available /{" "}
                        {room.total_beds ?? 0} total
                      </td>

                      <td>{formatMoney(room.daily_rate)}</td>

                      <td>
                        <StatusBadge
                          value={room.is_active ? "active" : "inactive"}
                        />
                      </td>

                      <td>
                        <div className="ip-actions">
                          <button
                            className="ip-link-button"
                            type="button"
                            onClick={() => startEditRoom(room)}
                          >
                            Edit
                          </button>

                          {room.is_active && (
                            <button
                              className="ip-link-button ip-danger-text"
                              type="button"
                              onClick={() => handleDeactivateRoom(room)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!loading && rooms.length === 0 && (
                    <tr>
                      <td colSpan={7} className="ip-empty">
                        No rooms found. Create your first room above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* BEDS TAB */}
      {activeTab === "beds" && (
        <>
          <section className="ip-panel">
            <div className="ip-panel-heading">
              <div>
                <h2>{editingBed ? "Edit bed" : "Add bed"}</h2>
                <p>Create a bed in an existing room or update its status.</p>
              </div>

              {editingBed && (
                <button
                  className="ip-button ip-button-secondary"
                  type="button"
                  onClick={resetCurrentForm}
                >
                  Cancel editing
                </button>
              )}
            </div>

            <form className="ip-form-grid" onSubmit={submitBed}>
              <FormField label="Room">
                <select
                  required
                  value={bedForm.room_id}
                  onChange={(event) =>
                    setBedForm((previous) => ({
                      ...previous,
                      room_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Select room</option>

                  {rooms
                    .filter((room) => room.is_active)
                    .map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_number} — {room.room_type}
                      </option>
                    ))}
                </select>
              </FormField>

              <FormField label="Bed number">
                <input
                  required
                  maxLength={50}
                  value={bedForm.bed_number}
                  onChange={(event) =>
                    setBedForm((previous) => ({
                      ...previous,
                      bed_number: event.target.value,
                    }))
                  }
                />
              </FormField>

              {editingBed && (
                <FormField label="Bed status">
                  <select
                    value={bedForm.bed_status}
                    onChange={(event) =>
                      setBedForm((previous) => ({
                        ...previous,
                        bed_status: event.target.value,
                      }))
                    }
                  >
                    {BED_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Notes" wide>
                <textarea
                  rows={2}
                  maxLength={5000}
                  value={bedForm.notes}
                  onChange={(event) =>
                    setBedForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="ip-form-actions">
                <button
                  className="ip-button ip-button-primary"
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? "Saving..."
                    : editingBed
                      ? "Save changes"
                      : "Create bed"}
                </button>
              </div>
            </form>
          </section>

          <section className="ip-panel">
            <div className="ip-panel-heading">
              <div>
                <h2>Beds</h2>
                <p>{beds.length} bed records returned</p>
              </div>
            </div>

            <div className="ip-table-wrap">
              <table className="ip-table">
                <thead>
                  <tr>
                    <th>Bed</th>
                    <th>Room</th>
                    <th>Type</th>
                    <th>Floor</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {beds.map((bed) => (
                    <tr key={bed.id}>
                      <td>
                        <strong>{bed.bed_number}</strong>
                      </td>
                      <td>{bed.room_number}</td>
                      <td>{bed.room_type}</td>
                      <td>{bed.floor_number || "—"}</td>
                      <td>
                        <StatusBadge value={bed.bed_status} />
                      </td>
                      <td className="ip-notes-cell">{bed.notes || "—"}</td>
                      <td>
                        <button
                          className="ip-link-button"
                          type="button"
                          onClick={() => startEditBed(bed)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!loading && beds.length === 0 && (
                    <tr>
                      <td colSpan={7} className="ip-empty">
                        No beds found. Create a bed above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ADMISSIONS TAB */}
      {activeTab === "admissions" && (
        <>
          <section className="ip-panel">
            <div className="ip-panel-heading">
              <div>
                <h2>{editingAdmission ? "Edit admission" : "Admit patient"}</h2>
                <p>Use an existing patient ID and an available bed ID.</p>
              </div>

              {editingAdmission && (
                <button
                  className="ip-button ip-button-secondary"
                  type="button"
                  onClick={resetCurrentForm}
                >
                  Cancel editing
                </button>
              )}
            </div>

            <form className="ip-form-grid" onSubmit={submitAdmission}>
              {!editingAdmission && (
                <>
                  <FormField label="Patient ID">
                    <input
                      required
                      inputMode="numeric"
                      pattern="[1-9][0-9]*"
                      value={admissionForm.patient_id}
                      onChange={(event) =>
                        setAdmissionForm((previous) => ({
                          ...previous,
                          patient_id: event.target.value,
                        }))
                      }
                      placeholder="Existing patient ID"
                    />
                  </FormField>

                  <FormField label="Admission number">
                    <input
                      required
                      maxLength={60}
                      value={admissionForm.admission_number}
                      onChange={(event) =>
                        setAdmissionForm((previous) => ({
                          ...previous,
                          admission_number: event.target.value,
                        }))
                      }
                    />
                  </FormField>

                  <FormField label="Available bed">
                    <select
                      required
                      value={admissionForm.bed_id}
                      onChange={(event) =>
                        setAdmissionForm((previous) => ({
                          ...previous,
                          bed_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select available bed</option>

                      {availableBeds.map((bed) => (
                        <option key={bed.id} value={bed.id}>
                          {bed.room_number} / Bed {bed.bed_number} (
                          {bed.room_type})
                        </option>
                      ))}
                    </select>

                    {availableBeds.length === 0 && (
                      <small className="ip-help">
                        No available beds are currently listed.
                      </small>
                    )}
                  </FormField>
                </>
              )}

              <FormField label="Admission type">
                <select
                  value={admissionForm.admission_type}
                  onChange={(event) =>
                    setAdmissionForm((previous) => ({
                      ...previous,
                      admission_type: event.target.value,
                    }))
                  }
                >
                  <option value="routine">Routine</option>
                  <option value="emergency">Emergency</option>
                  <option value="transfer">Transfer</option>
                </select>
              </FormField>

              <FormField label="Attending staff ID (optional)">
                <input
                  inputMode="numeric"
                  value={admissionForm.attending_staff_id}
                  onChange={(event) =>
                    setAdmissionForm((previous) => ({
                      ...previous,
                      attending_staff_id: event.target.value,
                    }))
                  }
                  placeholder="Existing staff ID"
                />
              </FormField>

              <FormField label="Expected discharge (optional)">
                <input
                  type="datetime-local"
                  value={admissionForm.expected_discharge_at}
                  onChange={(event) =>
                    setAdmissionForm((previous) => ({
                      ...previous,
                      expected_discharge_at: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Admission reason" wide>
                <textarea
                  required
                  rows={3}
                  maxLength={5000}
                  value={admissionForm.admission_reason}
                  onChange={(event) =>
                    setAdmissionForm((previous) => ({
                      ...previous,
                      admission_reason: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="ip-form-actions">
                <button
                  className="ip-button ip-button-primary"
                  disabled={
                    saving || (!editingAdmission && availableBeds.length === 0)
                  }
                  type="submit"
                >
                  {saving
                    ? "Saving..."
                    : editingAdmission
                      ? "Save changes"
                      : "Admit patient"}
                </button>
              </div>
            </form>
          </section>

          <section className="ip-panel">
            <div className="ip-panel-heading">
              <div>
                <h2>Admissions</h2>
                <p>{admissions.length} admission records returned</p>
              </div>
            </div>

            <div className="ip-table-wrap">
              <table className="ip-table">
                <thead>
                  <tr>
                    <th>Admission</th>
                    <th>Patient</th>
                    <th>Room / bed</th>
                    <th>Admitted</th>
                    <th>Expected discharge</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {admissions.map((admission) => (
                    <tr key={admission.id}>
                      <td>
                        <strong>{admission.admission_number}</strong>
                        <small>{admission.admission_type}</small>
                      </td>

                      <td>
                        {[admission.first_name, admission.last_name]
                          .filter(Boolean)
                          .join(" ") || `Patient ID: ${admission.patient_id}`}

                        <small>
                          {admission.mr_number ||
                            `Patient ID: ${admission.patient_id}`}
                        </small>
                      </td>

                      <td>
                        {admission.room_number || "—"} /{" "}
                        {admission.bed_number || "—"}
                      </td>

                      <td>{formatDate(admission.admitted_at)}</td>

                      <td>{formatDate(admission.expected_discharge_at)}</td>

                      <td>
                        <StatusBadge value={admission.admission_status} />
                      </td>

                      <td>
                        {admission.admission_status === "admitted" ? (
                          <div className="ip-actions ip-actions-stacked">
                            <button
                              className="ip-link-button"
                              type="button"
                              onClick={() => startEditAdmission(admission)}
                            >
                              Edit
                            </button>

                            <button
                              className="ip-link-button ip-green-text"
                              type="button"
                              onClick={() => handleDischarge(admission)}
                            >
                              Discharge
                            </button>

                            <button
                              className="ip-link-button ip-danger-text"
                              type="button"
                              onClick={() => handleCancelAdmission(admission)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}

                  {!loading && admissions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="ip-empty">
                        No admissions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {loading && (
        <div className="ip-loading">
          <span className="ip-spinner" />
          Loading inpatient records...
        </div>
      )}
    </main>
  );
}

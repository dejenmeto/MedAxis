import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";

import {
  getTheatreDashboard,
  getTheatreRooms,
  getSurgicalProcedures,
  getSurgeries,
  createTheatreRoom,
  createSurgicalProcedure,
  createSurgery,
  updateSurgeryStatus,
  getTheatreErrorMessage,
} from "../../services/theatre.service";

import "./Theatre.css";

const initialRoomForm = {
  roomNumber: "",
  name: "",
  roomType: "operating_room",
  location: "",
  notes: "",
};

const initialProcedureForm = {
  procedureCode: "",
  name: "",
  specialty: "",
  description: "",
  durationMinutes: 60,
  standardFee: "",
};

const initialSurgeryForm = {
  surgeryNumber: "",
  patientId: "",
  theatreRoomId: "",
  procedureId: "",
  surgeonId: "",
  anaesthetistId: "",
  scheduledStart: "",
  scheduledEnd: "",
  priority: "routine",
  notes: "",
};
const statusOptions = [
  "scheduled",
  "preparation",
  "in_progress",
  "completed",
  "cancelled",
  "postponed",
];

const priorityOptions = ["routine", "urgent", "emergency"];

function unwrapData(response) {
  let value = response?.data ?? response;

  // Support API responses such as { success: true, data: [...] }.
  if (
    value &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    value.data !== undefined
  ) {
    value = value.data;
  }

  return value;
}

function getArray(response, possibleKeys = []) {
  const value = unwrapData(response);

  if (Array.isArray(value)) return value;

  for (const key of possibleKeys) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  return [];
}

function getId(item) {
  return item?.id ?? item?.roomId ?? item?.procedureId ?? "";
}

function formatStatus(status = "unknown") {
  return String(status).replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPatientName(surgery) {
  if (surgery.patientName) return surgery.patientName;

  const firstName = surgery.first_name ?? surgery.firstName ?? "";
  const lastName = surgery.last_name ?? surgery.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || surgery.patient_name || "Patient";
}

function getRoomName(surgery, rooms) {
  const roomName = surgery.room_name ?? surgery.roomName;

  if (roomName) return roomName;

  const roomId = surgery.theatre_room_id ?? surgery.theatreRoomId;

  const room = rooms.find((item) => String(getId(item)) === String(roomId));

  if (!room) return "—";

  return (
    room.room_name ?? room.name ?? room.room_number ?? room.roomNumber ?? "—"
  );
}

function getProcedureName(surgery, procedures) {
  const procedureName = surgery.procedure_name ?? surgery.procedureName;

  if (procedureName) return procedureName;

  const procedureId = surgery.procedure_id ?? surgery.procedureId;

  const procedure = procedures.find(
    (item) => String(getId(item)) === String(procedureId),
  );

  return procedure?.procedure_name ?? procedure?.name ?? "—";
}

function getStatsValue(stats, keys, fallback = 0) {
  for (const key of keys) {
    const value = stats?.[key];

    if (typeof value === "number" || typeof value === "string") {
      const number = Number(value);

      if (Number.isFinite(number)) return number;
    }

    if (value && typeof value === "object" && value.total !== undefined) {
      const number = Number(value.total);

      if (Number.isFinite(number)) return number;
    }
  }

  return fallback;
}

function Theatre() {
  const [dashboard, setDashboard] = useState({});
  const [rooms, setRooms] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [surgeries, setSurgeries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeTab, setActiveTab] = useState("surgeries");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [showSurgeryForm, setShowSurgeryForm] = useState(false);

  const [roomForm, setRoomForm] = useState(initialRoomForm);
  const [procedureForm, setProcedureForm] = useState(initialProcedureForm);
  const [surgeryForm, setSurgeryForm] = useState(initialSurgeryForm);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    setPageError("");

    try {
      const results = await Promise.allSettled([
        getTheatreDashboard(),
        getTheatreRooms(),
        getSurgicalProcedures(),
        getSurgeries(),
      ]);

      const [dashboardResult, roomsResult, proceduresResult, surgeriesResult] =
        results;

      if (dashboardResult.status === "fulfilled") {
        const value = unwrapData(dashboardResult.value);
        setDashboard(value && !Array.isArray(value) ? value : {});
      }

      if (roomsResult.status === "fulfilled") {
        setRooms(getArray(roomsResult.value, ["rooms", "items", "results"]));
      }

      if (proceduresResult.status === "fulfilled") {
        setProcedures(
          getArray(proceduresResult.value, ["procedures", "items", "results"]),
        );
      }

      if (surgeriesResult.status === "fulfilled") {
        setSurgeries(
          getArray(surgeriesResult.value, ["surgeries", "items", "results"]),
        );
      }

      const failedResults = results.filter(
        (result) => result.status === "rejected",
      );

      if (failedResults.length > 0) {
        setPageError(getTheatreErrorMessage(failedResults[0].reason));
      }
    } catch (error) {
      setPageError(getTheatreErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSurgeries = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return surgeries.filter((surgery) => {
      const status = String(
        surgery.surgery_status ?? surgery.status ?? "scheduled",
      ).toLowerCase();

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const searchableText = [
        surgery.surgeryNumber,
        surgery.surgery_number,
        getPatientName(surgery),
        getRoomName(surgery, rooms),
        getProcedureName(surgery, procedures),
        surgery.priority,
        surgery.surgery_status,
        surgery.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus && (!searchText || searchableText.includes(searchText))
      );
    });
  }, [surgeries, rooms, procedures, search, statusFilter]);

  const stats = useMemo(() => {
    const activeRooms = rooms.filter(
      (room) =>
        room.isActive !== false &&
        room.is_active !== false &&
        !["inactive", "maintenance"].includes(
          String(room.status || "").toLowerCase(),
        ),
    ).length;

    const scheduled = surgeries.filter(
      (item) => (item.surgery_status ?? item.status) === "scheduled",
    ).length;

    const inProgress = surgeries.filter(
      (item) => (item.surgery_status ?? item.status) === "in_progress",
    ).length;

    const completed = surgeries.filter(
      (item) => (item.surgery_status ?? item.status) === "completed",
    ).length;

    return {
      rooms: getStatsValue(
        dashboard,
        ["activeRooms", "active_rooms", "totalRooms", "total_rooms"],
        activeRooms,
      ),
      scheduled: getStatsValue(
        dashboard,
        ["scheduledSurgeries", "scheduled_surgeries", "scheduled"],
        scheduled,
      ),
      inProgress: getStatsValue(
        dashboard,
        ["surgeriesInProgress", "surgeries_in_progress", "inProgress"],
        inProgress,
      ),
      completed: getStatsValue(
        dashboard,
        ["completedSurgeries", "completed_surgeries", "completed"],
        completed,
      ),
    };
  }, [dashboard, rooms, surgeries]);

  const handleRoomChange = (event) => {
    const { name, value } = event.target;

    setRoomForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleProcedureChange = (event) => {
    const { name, value } = event.target;

    setProcedureForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSurgeryChange = (event) => {
    const { name, value } = event.target;

    setSurgeryForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setPageError("");

    try {
      await createTheatreRoom({
        room_number: roomForm.roomNumber.trim(),
        room_name: roomForm.name.trim(),
        room_type: roomForm.roomType,
        location: roomForm.location.trim() || null,
        notes: roomForm.notes.trim() || null,
      });

      setRoomForm(initialRoomForm);
      setShowRoomForm(false);
      setNotice("Theatre room created successfully.");
      await loadData(false);
    } catch (error) {
      setPageError(getTheatreErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProcedure = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setPageError("");

    try {
      await createSurgicalProcedure({
        procedure_code: procedureForm.procedureCode.trim(),
        procedure_name: procedureForm.name.trim(),
        specialty: procedureForm.specialty.trim() || null,
        description: procedureForm.description.trim() || null,
        estimated_duration_minutes: Number(procedureForm.durationMinutes),
        standard_fee:
          procedureForm.standardFee === ""
            ? 0
            : Number(procedureForm.standardFee),
      });

      setProcedureForm(initialProcedureForm);
      setShowProcedureForm(false);
      setNotice("Surgical procedure created successfully.");
      await loadData(false);
    } catch (error) {
      setPageError(getTheatreErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  console.log(
    "Priority being submitted:",
    JSON.stringify(surgeryForm.priority),
  );

  const handleCreateSurgery = async (event) => {
    event.preventDefault();

    const start = new Date(surgeryForm.scheduledStart);
    const end = new Date(surgeryForm.scheduledEnd);

    if (
      !surgeryForm.scheduledStart ||
      !surgeryForm.scheduledEnd ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setPageError("Choose a valid surgery start and end time.");
      return;
    }

    setSaving(true);
    setNotice("");
    setPageError("");

    try {
      await createSurgery({
        surgery_number: surgeryForm.surgeryNumber.trim(),
        patient_id: surgeryForm.patientId.trim(),
        theatre_room_id: surgeryForm.theatreRoomId,
        procedure_id: surgeryForm.procedureId,
        surgeon_id: surgeryForm.surgeonId.trim() || null,
        anaesthetist_id: surgeryForm.anaesthetistId.trim() || null,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        priority: surgeryForm.priority,
        notes: surgeryForm.notes.trim() || null,
      });

      setSurgeryForm(initialSurgeryForm);
      setShowSurgeryForm(false);
      setNotice("Surgery scheduled successfully.");
      await loadData(false);
    } catch (error) {
      setPageError(getTheatreErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (surgeryId, status) => {
    if (!surgeryId || !status) return;

    setPageError("");
    setNotice("");

    try {
      await updateSurgeryStatus(surgeryId, status);
      setNotice("Surgery status updated successfully.");
      await loadData(false);
    } catch (error) {
      setPageError(getTheatreErrorMessage(error));
    }
  };

  const closeForms = () => {
    setShowRoomForm(false);
    setShowProcedureForm(false);
    setShowSurgeryForm(false);
  };

  return (
    <main className="theatre-page">
      <header className="theatre-page-header">
        <div className="theatre-heading">
          <div className="theatre-heading-icon">
            <FiActivity />
          </div>

          <div>
            <p className="theatre-eyebrow">CLINICAL OPERATIONS</p>
            <h1>Operating Theatre</h1>
            <p className="theatre-subtitle">
              Manage theatre rooms, surgical procedures, and scheduled
              operations.
            </p>
          </div>
        </div>

        <div className="theatre-header-actions">
          <button
            type="button"
            className="theatre-button theatre-button-secondary"
            onClick={() => loadData()}
            disabled={loading}
          >
            <FiRefreshCw className={loading ? "theatre-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="theatre-button theatre-button-primary"
            onClick={() => {
              closeForms();
              setShowSurgeryForm(true);
              setPageError("");
              setNotice("");
            }}
          >
            <FiPlus />
            Schedule surgery
          </button>
        </div>
      </header>

      {pageError && (
        <div className="theatre-alert theatre-alert-error" role="alert">
          <FiXCircle />
          <span>{pageError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setPageError("")}
          >
            <FiXCircle />
          </button>
        </div>
      )}

      {notice && (
        <div className="theatre-alert theatre-alert-success" role="status">
          <FiCheckCircle />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <FiXCircle />
          </button>
        </div>
      )}

      <section className="theatre-stat-grid" aria-label="Theatre statistics">
        <article className="theatre-stat-card">
          <div className="theatre-stat-icon theatre-stat-blue">
            <FiActivity />
          </div>
          <div>
            <p>Active theatre rooms</p>
            <h2>{loading ? "—" : stats.rooms}</h2>
            <span>Available registered rooms</span>
          </div>
        </article>

        <article className="theatre-stat-card">
          <div className="theatre-stat-icon theatre-stat-amber">
            <FiCalendar />
          </div>
          <div>
            <p>Scheduled surgeries</p>
            <h2>{loading ? "—" : stats.scheduled}</h2>
            <span>Awaiting operation</span>
          </div>
        </article>

        <article className="theatre-stat-card">
          <div className="theatre-stat-icon theatre-stat-purple">
            <FiClock />
          </div>
          <div>
            <p>In progress</p>
            <h2>{loading ? "—" : stats.inProgress}</h2>
            <span>Currently underway</span>
          </div>
        </article>

        <article className="theatre-stat-card">
          <div className="theatre-stat-icon theatre-stat-green">
            <FiCheckCircle />
          </div>
          <div>
            <p>Completed surgeries</p>
            <h2>{loading ? "—" : stats.completed}</h2>
            <span>Marked as completed</span>
          </div>
        </article>
      </section>

      <section className="theatre-workspace">
        <div className="theatre-section-heading">
          <div>
            <h2>Theatre management</h2>
            <p>View and manage operating theatre activities.</p>
          </div>
        </div>

        <div
          className="theatre-tabs"
          role="tablist"
          aria-label="Theatre sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "surgeries"}
            className={activeTab === "surgeries" ? "active" : ""}
            onClick={() => setActiveTab("surgeries")}
          >
            <FiCalendar />
            Surgeries
            <span>{surgeries.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rooms"}
            className={activeTab === "rooms" ? "active" : ""}
            onClick={() => setActiveTab("rooms")}
          >
            <FiActivity />
            Theatre rooms
            <span>{rooms.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "procedures"}
            className={activeTab === "procedures" ? "active" : ""}
            onClick={() => setActiveTab("procedures")}
          >
            <FiUsers />
            Procedures
            <span>{procedures.length}</span>
          </button>
        </div>

        {activeTab === "surgeries" && (
          <div className="theatre-tab-content">
            <div className="theatre-toolbar">
              <div className="theatre-search">
                <FiSearch />
                <input
                  type="search"
                  placeholder="Search patient, procedure, room..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search surgeries"
                />
              </div>

              <div className="theatre-filter">
                <FiFilter />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by surgery status"
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="theatre-button theatre-button-primary"
                onClick={() => {
                  closeForms();
                  setShowSurgeryForm(true);
                  setPageError("");
                }}
              >
                <FiPlus />
                New surgery
              </button>
            </div>

            {showSurgeryForm && (
              <form
                className="theatre-form-card"
                onSubmit={handleCreateSurgery}
              >
                <div className="theatre-form-heading">
                  <div>
                    <h3>Schedule a surgery</h3>
                    <p>Enter the patient, team, procedure, and schedule.</p>
                  </div>
                  <button
                    type="button"
                    className="theatre-icon-button"
                    onClick={() => setShowSurgeryForm(false)}
                    aria-label="Close surgery form"
                  >
                    <FiXCircle />
                  </button>
                </div>

                <div className="theatre-form-grid">
                  <label>
                    Surgery number
                    <input
                      name="surgeryNumber"
                      value={surgeryForm.surgeryNumber}
                      onChange={handleSurgeryChange}
                      placeholder="e.g. SUR-2026-001"
                      required
                    />
                  </label>

                  <label>
                    Patient ID
                    <input
                      name="patientId"
                      value={surgeryForm.patientId}
                      onChange={handleSurgeryChange}
                      placeholder="Existing patient ID"
                      required
                    />
                  </label>

                  <label>
                    Theatre room
                    <select
                      name="theatreRoomId"
                      value={surgeryForm.theatreRoomId}
                      onChange={handleSurgeryChange}
                      required
                      disabled={rooms.length === 0}
                    >
                      <option value="">
                        {rooms.length === 0
                          ? "No rooms available — create a room first"
                          : "Select a room"}
                      </option>

                      {rooms
                        .filter(
                          (room) =>
                            room.is_active !== false &&
                            !["maintenance", "inactive"].includes(
                              String(room.room_status ?? "").toLowerCase(),
                            ),
                        )
                        .map((room) => (
                          <option key={getId(room)} value={getId(room)}>
                            {room.room_number} — {room.room_name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Surgical procedure
                    <select
                      name="procedureId"
                      value={surgeryForm.procedureId}
                      onChange={handleSurgeryChange}
                      required
                      disabled={procedures.length === 0}
                    >
                      <option value="">
                        {procedures.length === 0
                          ? "No procedures available — create a procedure first"
                          : "Select a procedure"}
                      </option>

                      {procedures
                        .filter((procedure) => procedure.is_active !== false)
                        .map((procedure) => (
                          <option
                            key={getId(procedure)}
                            value={getId(procedure)}
                          >
                            {procedure.procedure_code} —{" "}
                            {procedure.procedure_name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Surgeon staff ID
                    <input
                      name="surgeonId"
                      value={surgeryForm.surgeonId}
                      onChange={handleSurgeryChange}
                      placeholder="Existing staff ID"
                    />
                  </label>

                  <label>
                    Anaesthetist staff ID
                    <input
                      name="anaesthetistId"
                      value={surgeryForm.anaesthetistId}
                      onChange={handleSurgeryChange}
                      placeholder="Existing staff ID"
                    />
                  </label>

                  <label>
                    Scheduled start
                    <input
                      type="datetime-local"
                      name="scheduledStart"
                      value={surgeryForm.scheduledStart}
                      onChange={handleSurgeryChange}
                      required
                    />
                  </label>

                  <label>
                    Scheduled end
                    <input
                      type="datetime-local"
                      name="scheduledEnd"
                      value={surgeryForm.scheduledEnd}
                      onChange={handleSurgeryChange}
                      required
                    />
                  </label>

                  <label>
                    Priority
                    <select
                      name="priority"
                      value={surgeryForm.priority}
                      onChange={handleSurgeryChange}
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {formatStatus(priority)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="theatre-field-full">
                    Notes
                    <textarea
                      name="notes"
                      value={surgeryForm.notes}
                      onChange={handleSurgeryChange}
                      rows="3"
                      placeholder="Additional scheduling notes"
                    />
                  </label>
                </div>

                <div className="theatre-form-actions">
                  <button
                    type="button"
                    className="theatre-button theatre-button-secondary"
                    onClick={() => setShowSurgeryForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="theatre-button theatre-button-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Schedule surgery"}
                  </button>
                </div>
              </form>
            )}

            <div className="theatre-table-wrap">
              <table className="theatre-table">
                <thead>
                  <tr>
                    <th>Surgery</th>
                    <th>Patient</th>
                    <th>Procedure</th>
                    <th>Room</th>
                    <th>Scheduled start</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="theatre-table-message">
                        Loading surgery records...
                      </td>
                    </tr>
                  ) : filteredSurgeries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="theatre-table-message">
                        <div className="theatre-empty-state">
                          <FiCalendar />
                          <strong>No surgeries found</strong>
                          <span>
                            Try another search or schedule a new surgery.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSurgeries.map((surgery) => {
                      const surgeryId = surgery.id;
                      const surgeryNumber =
                        surgery.surgery_number || surgery.surgeryNumber || "—";

                      return (
                        <tr key={surgeryId || surgeryNumber}>
                          <td>
                            <strong>{surgeryNumber}</strong>
                          </td>
                          <td>{getPatientName(surgery)}</td>
                          <td>{getProcedureName(surgery, procedures)}</td>
                          <td>{getRoomName(surgery, rooms)}</td>
                          <td>
                            {formatDate(
                              surgery.scheduled_start || surgery.scheduledStart,
                            )}
                          </td>
                          <td>
                            <span
                              className={`theatre-priority theatre-priority-${String(
                                surgery.priority || "normal",
                              ).toLowerCase()}`}
                            >
                              {formatStatus(surgery.priority || "normal")}
                            </span>
                          </td>
                          <td>
                            <select
                              className={`theatre-status-select theatre-status-${String(
                                surgery.surgery_status ??
                                  surgery.status ??
                                  "scheduled",
                              ).toLowerCase()}`}
                              value={
                                surgery.surgery_status ??
                                surgery.status ??
                                "scheduled"
                              }
                              onChange={(event) =>
                                handleStatusChange(
                                  surgeryId,
                                  event.target.value,
                                )
                              }
                              aria-label={`Update status for ${surgeryNumber}`}
                              disabled={!surgeryId}
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {formatStatus(status)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="theatre-table-footer">
              Showing {loading ? 0 : filteredSurgeries.length} of{" "}
              {surgeries.length} surgery records
            </div>
          </div>
        )}

        {activeTab === "rooms" && (
          <div className="theatre-tab-content">
            <div className="theatre-toolbar">
              <p className="theatre-result-description">
                Manage the rooms used for surgical operations.
              </p>
              <button
                type="button"
                className="theatre-button theatre-button-primary"
                onClick={() => {
                  closeForms();
                  setShowRoomForm(true);
                  setPageError("");
                }}
              >
                <FiPlus />
                Add room
              </button>
            </div>

            {showRoomForm && (
              <form className="theatre-form-card" onSubmit={handleCreateRoom}>
                <div className="theatre-form-heading">
                  <div>
                    <h3>Add theatre room</h3>
                    <p>Register a room in your hospital.</p>
                  </div>
                  <button
                    type="button"
                    className="theatre-icon-button"
                    onClick={() => setShowRoomForm(false)}
                    aria-label="Close room form"
                  >
                    <FiXCircle />
                  </button>
                </div>

                <div className="theatre-form-grid">
                  <label>
                    Room number
                    <input
                      name="roomNumber"
                      value={roomForm.roomNumber}
                      onChange={handleRoomChange}
                      required
                    />
                  </label>

                  <label>
                    Room name
                    <input
                      name="name"
                      value={roomForm.name}
                      onChange={handleRoomChange}
                      required
                    />
                  </label>

                  <label>
                    Room type
                    <select
                      name="roomType"
                      value={roomForm.roomType}
                      onChange={handleRoomChange}
                    >
                      <option value="operating_room">Operating room</option>
                      <option value="minor_procedure">
                        Minor procedure room
                      </option>
                      <option value="emergency">Emergency theatre</option>
                    </select>
                  </label>

                  <label>
                    Location
                    <input
                      name="location"
                      value={roomForm.location}
                      onChange={handleRoomChange}
                      placeholder="e.g. Block A, Floor 2"
                    />
                  </label>

                  <label className="theatre-field-full">
                    Notes
                    <textarea
                      name="notes"
                      value={roomForm.notes}
                      onChange={handleRoomChange}
                      rows="3"
                    />
                  </label>
                </div>

                <div className="theatre-form-actions">
                  <button
                    type="button"
                    className="theatre-button theatre-button-secondary"
                    onClick={() => setShowRoomForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="theatre-button theatre-button-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save room"}
                  </button>
                </div>
              </form>
            )}

            <div className="theatre-room-grid">
              {loading ? (
                <p className="theatre-inline-message">Loading rooms...</p>
              ) : rooms.length === 0 ? (
                <div className="theatre-empty-state theatre-empty-card">
                  <FiActivity />
                  <strong>No theatre rooms registered</strong>
                  <span>Add a room to start managing theatre capacity.</span>
                </div>
              ) : (
                rooms.map((room) => (
                  <article className="theatre-room-card" key={getId(room)}>
                    <div className="theatre-room-card-top">
                      <div className="theatre-room-icon">
                        <FiActivity />
                      </div>
                      <span
                        className={`theatre-room-status theatre-room-status-${String(
                          room.status || "available",
                        ).toLowerCase()}`}
                      >
                        {formatStatus(room.status || "available")}
                      </span>
                    </div>

                    <h3>{room.name || room.room_number || room.roomNumber}</h3>
                    <p className="theatre-room-number">
                      Room {room.room_number || room.roomNumber || "—"}
                    </p>

                    <div className="theatre-room-details">
                      <span>Type</span>
                      <strong>
                        {formatStatus(
                          room.room_type || room.roomType || "operating_room",
                        )}
                      </strong>
                      <span>Location</span>
                      <strong>{room.location || "Not specified"}</strong>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "procedures" && (
          <div className="theatre-tab-content">
            <div className="theatre-toolbar">
              <p className="theatre-result-description">
                Maintain the catalogue of surgical procedures.
              </p>
              <button
                type="button"
                className="theatre-button theatre-button-primary"
                onClick={() => {
                  closeForms();
                  setShowProcedureForm(true);
                  setPageError("");
                }}
              >
                <FiPlus />
                Add procedure
              </button>
            </div>

            {showProcedureForm && (
              <form
                className="theatre-form-card"
                onSubmit={handleCreateProcedure}
              >
                <div className="theatre-form-heading">
                  <div>
                    <h3>Add surgical procedure</h3>
                    <p>Define the procedure and its standard duration.</p>
                  </div>
                  <button
                    type="button"
                    className="theatre-icon-button"
                    onClick={() => setShowProcedureForm(false)}
                    aria-label="Close procedure form"
                  >
                    <FiXCircle />
                  </button>
                </div>

                <div className="theatre-form-grid">
                  <label>
                    Procedure code
                    <input
                      name="procedureCode"
                      value={procedureForm.procedureCode}
                      onChange={handleProcedureChange}
                      required
                    />
                  </label>

                  <label>
                    Procedure name
                    <input
                      name="name"
                      value={procedureForm.name}
                      onChange={handleProcedureChange}
                      required
                    />
                  </label>

                  <label>
                    Specialty
                    <input
                      name="specialty"
                      value={procedureForm.specialty}
                      onChange={handleProcedureChange}
                      placeholder="e.g. General surgery"
                    />
                  </label>

                  <label>
                    Duration (minutes)
                    <input
                      type="number"
                      name="durationMinutes"
                      min="1"
                      value={procedureForm.durationMinutes}
                      onChange={handleProcedureChange}
                      required
                    />
                  </label>

                  <label>
                    Standard fee
                    <input
                      type="number"
                      name="standardFee"
                      min="0"
                      step="0.01"
                      value={procedureForm.standardFee}
                      onChange={handleProcedureChange}
                    />
                  </label>

                  <label className="theatre-field-full">
                    Description
                    <textarea
                      name="description"
                      value={procedureForm.description}
                      onChange={handleProcedureChange}
                      rows="3"
                    />
                  </label>
                </div>

                <div className="theatre-form-actions">
                  <button
                    type="button"
                    className="theatre-button theatre-button-secondary"
                    onClick={() => setShowProcedureForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="theatre-button theatre-button-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save procedure"}
                  </button>
                </div>
              </form>
            )}

            <div className="theatre-table-wrap">
              <table className="theatre-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Procedure</th>
                    <th>Specialty</th>
                    <th>Duration</th>
                    <th>Standard fee</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="theatre-table-message">
                        Loading procedures...
                      </td>
                    </tr>
                  ) : procedures.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="theatre-table-message">
                        No surgical procedures registered.
                      </td>
                    </tr>
                  ) : (
                    procedures.map((procedure) => (
                      <tr key={getId(procedure)}>
                        <td>
                          <strong>
                            {procedure.procedure_code ||
                              procedure.procedureCode ||
                              "—"}
                          </strong>
                        </td>
                        <td>
                          <strong>{procedure.name}</strong>
                          {procedure.description && (
                            <p className="theatre-cell-description">
                              {procedure.description}
                            </p>
                          )}
                        </td>
                        <td>{procedure.specialty || "—"}</td>
                        <td>
                          {procedure.duration_minutes ??
                            procedure.durationMinutes ??
                            "—"}{" "}
                          min
                        </td>
                        <td>
                          {procedure.standard_fee ??
                            procedure.standardFee ??
                            "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default Theatre;

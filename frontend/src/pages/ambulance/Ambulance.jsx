import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTruck,
  FiX,
} from "react-icons/fi";
import ambulanceService from "../../services/ambulance.service";
import "./Ambulance.css";

const emptyVehicle = {
  vehicle_number: "",
  vehicle_type: "ambulance",
  capacity: 1,
  status: "available",
  current_location: "",
  notes: "",
};

const emptyDispatch = {
  patient_id: "",
  patient_name: "",
  patient_phone: "",
  emergency_type: "",
  priority: "normal",
  pickup_location: "",
  destination: "",
  vehicle_id: "",
  driver_name: "",
  assigned_team: "",
  notes: "",
};

const statusLabels = {
  pending: "Pending",
  dispatched: "Dispatched",
  arrived: "Arrived",
  transporting: "Transporting",
  completed: "Completed",
  cancelled: "Cancelled",
};

const priorityLabels = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

function readResponse(response) {
  return response?.data?.data ?? response?.data ?? {};
}

export default function Ambulance() {
  const [dashboard, setDashboard] = useState({
    vehicles: {},
    dispatches: {},
  });
  const [vehicles, setVehicles] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle);
  const [dispatchForm, setDispatchForm] = useState(emptyDispatch);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [activeTab, setActiveTab] = useState("dispatches");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardResponse, vehicleResponse, dispatchResponse] =
        await Promise.all([
          ambulanceService.getDashboard(),
          ambulanceService.getVehicles(),
          ambulanceService.getDispatches({
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
          }),
        ]);

      setDashboard(readResponse(dashboardResponse));
      setVehicles(
        readResponse(vehicleResponse).data ?? readResponse(vehicleResponse),
      );
      setDispatches(
        readResponse(dispatchResponse).data ?? readResponse(dispatchResponse),
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load ambulance information. Check the API connection and your permissions.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitVehicle(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...vehicleForm,
        capacity: Number(vehicleForm.capacity),
      };

      if (editingVehicleId) {
        await ambulanceService.updateVehicle(editingVehicleId, payload);
        setNotice("Ambulance vehicle updated.");
      } else {
        await ambulanceService.createVehicle(payload);
        setNotice("Ambulance vehicle registered.");
      }

      setVehicleForm(emptyVehicle);
      setEditingVehicleId(null);
      setShowVehicleForm(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function submitDispatch(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...dispatchForm,
        patient_id: dispatchForm.patient_id || null,
        vehicle_id: dispatchForm.vehicle_id || null,
      };

      await ambulanceService.createDispatch(payload);
      setDispatchForm(emptyDispatch);
      setShowDispatchForm(false);
      setActiveTab("dispatches");
      setNotice("Emergency dispatch recorded.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create the dispatch.");
    } finally {
      setSaving(false);
    }
  }

  function editVehicle(vehicle) {
    setVehicleForm({
      vehicle_number: vehicle.vehicle_number || "",
      vehicle_type: vehicle.vehicle_type || "ambulance",
      capacity: vehicle.capacity ?? 1,
      status: vehicle.status || "available",
      current_location: vehicle.current_location || "",
      notes: vehicle.notes || "",
    });
    setEditingVehicleId(vehicle.id);
    setShowVehicleForm(true);
    setActiveTab("vehicles");
  }

  async function changeStatus(dispatch, status) {
    if (
      !window.confirm(
        `Change dispatch ${dispatch.dispatch_code} to "${statusLabels[status]}"?`,
      )
    )
      return;

    setError("");
    setNotice("");

    try {
      await ambulanceService.updateDispatchStatus(dispatch.id, status);
      setNotice(`Dispatch ${dispatch.dispatch_code} updated.`);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to update dispatch status.",
      );
    }
  }

  const vehicleStats = dashboard.vehicles || {};
  const dispatchStats = dashboard.dispatches || {};

  return (
    <div className="ambulance-page">
      <header className="ambulance-header">
        <div>
          <span className="ambulance-eyebrow">EMERGENCY SERVICES</span>
          <h1>Ambulance & Emergency Dispatch</h1>
          <p>
            Manage ambulance availability and coordinate emergency responses.
          </p>
        </div>

        <button
          className="amb-button amb-button-primary"
          onClick={() => {
            setDispatchForm(emptyDispatch);
            setShowDispatchForm(true);
            setError("");
            setNotice("");
          }}
        >
          <FiPlus /> New emergency
        </button>
      </header>

      {error && (
        <div className="amb-alert amb-alert-error" role="alert">
          <FiAlertTriangle /> <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <FiX />
          </button>
        </div>
      )}

      {notice && (
        <div className="amb-alert amb-alert-success" role="status">
          <FiCheckCircle /> <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <FiX />
          </button>
        </div>
      )}

      <section className="amb-stat-grid">
        <StatCard
          icon={<FiTruck />}
          label="Total vehicles"
          value={vehicleStats.total}
        />
        <StatCard
          icon={<FiCheckCircle />}
          label="Available"
          value={vehicleStats.available}
        />
        <StatCard
          icon={<FiActivity />}
          label="Active dispatches"
          value={dispatchStats.active}
        />
        <StatCard
          icon={<FiAlertTriangle />}
          label="Critical today"
          value={dispatchStats.critical}
        />
      </section>

      <div className="amb-toolbar">
        <div className="amb-tabs">
          <button
            className={activeTab === "dispatches" ? "active" : ""}
            onClick={() => setActiveTab("dispatches")}
          >
            Emergency dispatches
          </button>
          <button
            className={activeTab === "vehicles" ? "active" : ""}
            onClick={() => setActiveTab("vehicles")}
          >
            Ambulance fleet
          </button>
        </div>

        <button
          className="amb-button amb-button-light"
          onClick={loadData}
          disabled={loading}
        >
          <FiRefreshCw className={loading ? "amb-spinning" : ""} /> Refresh
        </button>
      </div>

      {activeTab === "dispatches" && (
        <section className="amb-panel">
          <div className="amb-panel-heading">
            <div>
              <h2>Emergency requests</h2>
              <p>Search and update dispatch progress.</p>
            </div>
            <span className="amb-count">{dispatches.length} records</span>
          </div>

          <div className="amb-filters">
            <label className="amb-search">
              <FiSearch />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patient, dispatch code or location"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="">All priorities</option>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="amb-empty">
              <FiRefreshCw className="amb-spinning" /> Loading dispatches…
            </div>
          ) : dispatches.length === 0 ? (
            <div className="amb-empty">
              <FiTruck size={30} />
              <strong>No emergency dispatches found</strong>
              <span>Create an emergency request or adjust your filters.</span>
            </div>
          ) : (
            <div className="amb-table-wrap">
              <table className="amb-table">
                <thead>
                  <tr>
                    <th>Dispatch</th>
                    <th>Patient / emergency</th>
                    <th>Pickup location</th>
                    <th>Ambulance</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Update status</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((dispatch) => (
                    <tr key={dispatch.id}>
                      <td>
                        <strong>{dispatch.dispatch_code}</strong>
                        <small>
                          {dispatch.call_received_at
                            ? new Date(
                                dispatch.call_received_at,
                              ).toLocaleString()
                            : "—"}
                        </small>
                      </td>
                      <td>
                        <strong>{dispatch.patient_name}</strong>
                        <small>{dispatch.emergency_type}</small>
                      </td>
                      <td>
                        <FiMapPin className="amb-inline-icon" />{" "}
                        {dispatch.pickup_location}
                      </td>
                      <td>{dispatch.vehicle_number || "Not assigned"}</td>
                      <td>
                        <span
                          className={`amb-priority priority-${dispatch.priority}`}
                        >
                          {priorityLabels[dispatch.priority] ||
                            dispatch.priority}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`amb-status status-${dispatch.status}`}
                        >
                          {statusLabels[dispatch.status] || dispatch.status}
                        </span>
                      </td>
                      <td>
                        <select
                          value={dispatch.status}
                          aria-label={`Status for ${dispatch.dispatch_code}`}
                          disabled={["completed", "cancelled"].includes(
                            dispatch.status,
                          )}
                          onChange={(event) =>
                            changeStatus(dispatch, event.target.value)
                          }
                        >
                          {Object.entries(statusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "vehicles" && (
        <section className="amb-panel">
          <div className="amb-panel-heading">
            <div>
              <h2>Ambulance fleet</h2>
              <p>Review vehicles and their current availability.</p>
            </div>
            <button
              className="amb-button amb-button-primary"
              onClick={() => {
                setVehicleForm(emptyVehicle);
                setEditingVehicleId(null);
                setShowVehicleForm(true);
                setError("");
                setNotice("");
              }}
            >
              <FiPlus /> Register vehicle
            </button>
          </div>

          {loading ? (
            <div className="amb-empty">Loading vehicles…</div>
          ) : vehicles.length === 0 ? (
            <div className="amb-empty">
              <FiTruck size={30} />
              <strong>No vehicles registered</strong>
              <span>Register an ambulance to start managing the fleet.</span>
            </div>
          ) : (
            <div className="amb-vehicle-grid">
              {vehicles.map((vehicle) => (
                <article className="amb-vehicle-card" key={vehicle.id}>
                  <div className="amb-vehicle-icon">
                    <FiTruck size={25} />
                  </div>
                  <span className={`amb-status status-${vehicle.status}`}>
                    {vehicle.status}
                  </span>
                  <h3>{vehicle.vehicle_number}</h3>
                  <p>
                    {vehicle.vehicle_type} · Capacity {vehicle.capacity}
                  </p>
                  <p>
                    <FiMapPin className="amb-inline-icon" />{" "}
                    {vehicle.current_location || "Location not recorded"}
                  </p>
                  <button
                    className="amb-button amb-button-light"
                    onClick={() => editVehicle(vehicle)}
                  >
                    Edit vehicle
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {showVehicleForm && (
        <Modal
          title={
            editingVehicleId
              ? "Edit ambulance vehicle"
              : "Register ambulance vehicle"
          }
          onClose={() => setShowVehicleForm(false)}
        >
          <form className="amb-form" onSubmit={submitVehicle}>
            <Field label="Registration number *">
              <input
                required
                maxLength={40}
                value={vehicleForm.vehicle_number}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    vehicle_number: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Vehicle type *">
              <select
                value={vehicleForm.vehicle_type}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    vehicle_type: e.target.value,
                  })
                }
              >
                <option value="ambulance">Ambulance</option>
                <option value="advanced_life_support">
                  Advanced life support
                </option>
                <option value="basic_life_support">Basic life support</option>
                <option value="patient_transport">Patient transport</option>
              </select>
            </Field>
            <Field label="Capacity *">
              <input
                type="number"
                min="1"
                required
                value={vehicleForm.capacity}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, capacity: e.target.value })
                }
              />
            </Field>
            <Field label="Status">
              <select
                value={vehicleForm.status}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, status: e.target.value })
                }
              >
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Current location">
              <input
                value={vehicleForm.current_location}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    current_location: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows="3"
                value={vehicleForm.notes}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, notes: e.target.value })
                }
              />
            </Field>
            <div className="amb-form-actions">
              <button
                type="button"
                className="amb-button amb-button-light"
                onClick={() => setShowVehicleForm(false)}
              >
                Cancel
              </button>
              <button
                className="amb-button amb-button-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save vehicle"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDispatchForm && (
        <Modal
          title="Create emergency dispatch"
          onClose={() => setShowDispatchForm(false)}
        >
          <form className="amb-form" onSubmit={submitDispatch}>
            <Field label="Patient name *">
              <input
                required
                maxLength={160}
                value={dispatchForm.patient_name}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    patient_name: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Patient ID (optional)">
              <input
                inputMode="numeric"
                value={dispatchForm.patient_id}
                placeholder="Existing patient database ID"
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    patient_id: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Phone number">
              <input
                value={dispatchForm.patient_phone}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    patient_phone: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Emergency type *">
              <input
                required
                maxLength={100}
                placeholder="e.g. Accident, breathing difficulty"
                value={dispatchForm.emergency_type}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    emergency_type: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Priority">
              <select
                value={dispatchForm.priority}
                onChange={(e) =>
                  setDispatchForm({ ...dispatchForm, priority: e.target.value })
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Pickup location *">
              <input
                required
                value={dispatchForm.pickup_location}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    pickup_location: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Destination">
              <input
                value={dispatchForm.destination}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    destination: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Available ambulance">
              <select
                value={dispatchForm.vehicle_id}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    vehicle_id: e.target.value,
                  })
                }
              >
                <option value="">Leave unassigned</option>
                {vehicles
                  .filter((vehicle) => vehicle.status === "available")
                  .map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_number} — {vehicle.vehicle_type}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Driver name">
              <input
                value={dispatchForm.driver_name}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    driver_name: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Assigned team">
              <input
                value={dispatchForm.assigned_team}
                onChange={(e) =>
                  setDispatchForm({
                    ...dispatchForm,
                    assigned_team: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows="3"
                value={dispatchForm.notes}
                onChange={(e) =>
                  setDispatchForm({ ...dispatchForm, notes: e.target.value })
                }
              />
            </Field>
            <div className="amb-form-actions">
              <button
                type="button"
                className="amb-button amb-button-light"
                onClick={() => setShowDispatchForm(false)}
              >
                Cancel
              </button>
              <button
                className="amb-button amb-button-primary"
                disabled={saving}
              >
                {saving ? "Creating…" : "Create dispatch"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <article className="amb-stat-card">
      <div className="amb-stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value ?? 0}</strong>
      </div>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="amb-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="amb-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="amb-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="amb-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

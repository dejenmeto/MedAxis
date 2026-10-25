import { useCallback, useEffect, useState } from "react";
import {
  FiTool,
  FiPlus,
  FiSearch,
  FiRefreshCw,
  FiEdit2,
  FiArchive,
  FiClipboard,
  FiX,
} from "react-icons/fi";

import service from "../../services/equipmentMaintenance.service";
import "./EquipmentMaintenance.css";

const emptyEquipment = {
  equipment_code: "",
  name: "",
  category: "",
  manufacturer: "",
  model_number: "",
  serial_number: "",
  location: "",
  condition_status: "good",
  purchase_date: "",
  warranty_expiry: "",
  notes: "",
};

const emptyOrder = {
  equipment_id: "",
  title: "",
  description: "",
  priority: "medium",
  scheduled_date: "",
  cost: "0",
};

const conditions = [
  "new",
  "good",
  "needs_repair",
  "under_maintenance",
  "retired",
];

const priorities = ["low", "medium", "high", "urgent"];

const statuses = ["open", "assigned", "in_progress", "completed", "cancelled"];

const readable = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const dateValue = (value) => (value ? String(value).slice(0, 10) : "");

export default function EquipmentMaintenance() {
  const [equipment, setEquipment] = useState([]);
  const [orders, setOrders] = useState([]);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [equipmentResult, orderResult] = await Promise.all([
        service.getEquipment({
          page,
          limit: 10,
          search: search.trim(),
          condition,
          active: "true",
        }),
        service.getOrders({ page: 1, limit: 100, status: orderStatus }),
      ]);

      setEquipment(equipmentResult.data || []);
      setPagination(
        equipmentResult.pagination || {
          page: 1,
          total: 0,
          totalPages: 1,
        },
      );
      setOrders(orderResult.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load equipment and maintenance records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, condition, orderStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateEquipmentField = (event) => {
    const { name, value } = event.target;
    setEquipmentForm((current) => ({ ...current, [name]: value }));
  };

  const updateOrderField = (event) => {
    const { name, value } = event.target;
    setOrderForm((current) => ({ ...current, [name]: value }));
  };

  const resetEquipmentForm = () => {
    setEquipmentForm(emptyEquipment);
    setEditingId(null);
    setShowEquipmentForm(false);
  };

  const editEquipment = (item) => {
    setEquipmentForm({
      ...emptyEquipment,
      ...item,
      purchase_date: dateValue(item.purchase_date),
      warranty_expiry: dateValue(item.warranty_expiry),
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setShowEquipmentForm(true);
    setNotice("");
    setError("");
  };

  const saveEquipment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingId) {
        await service.updateEquipment(editingId, equipmentForm);
        setNotice("Equipment updated successfully.");
      } else {
        await service.createEquipment(equipmentForm);
        setNotice("Equipment registered successfully.");
      }

      resetEquipmentForm();
      setPage(1);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save equipment.");
    } finally {
      setSaving(false);
    }
  };

  const deactivateEquipment = async (item) => {
    const confirmed = window.confirm(
      `Deactivate "${item.name}"? Its maintenance history will be preserved.`,
    );
    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await service.deactivateEquipment(item.id);
      setNotice("Equipment deactivated.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to deactivate equipment.",
      );
    }
  };

  const saveOrder = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await service.createOrder({
        ...orderForm,
        equipment_id: Number(orderForm.equipment_id),
        cost: Number(orderForm.cost || 0),
      });

      setOrderForm(emptyOrder);
      setShowOrderForm(false);
      setNotice("Maintenance work order created.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create the maintenance work order.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeOrderStatus = async (order, status) => {
    setError("");
    setNotice("");

    try {
      await service.updateOrder(order.id, { status });
      setNotice("Maintenance status updated.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to update maintenance status.",
      );
    }
  };

  return (
    <main className="equipment-page">
      <header className="equipment-header">
        <div>
          <p className="equipment-eyebrow">FACILITIES MANAGEMENT</p>
          <h1>
            <FiTool /> Equipment & Maintenance
          </h1>
          <p className="equipment-subtitle">
            Register hospital equipment and track repair work.
          </p>
        </div>

        <button
          className="equipment-button equipment-button-primary"
          onClick={() => {
            resetEquipmentForm();
            setShowEquipmentForm(true);
          }}
        >
          <FiPlus /> Register Equipment
        </button>
      </header>

      {error && (
        <div className="equipment-alert equipment-alert-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="equipment-alert equipment-alert-success" role="status">
          {notice}
        </div>
      )}

      <section className="equipment-stats">
        <article>
          <span>Active equipment on this page</span>
          <strong>{equipment.length}</strong>
        </article>
        <article>
          <span>Open work orders loaded</span>
          <strong>
            {
              orders.filter((item) =>
                ["open", "assigned", "in_progress"].includes(item.status),
              ).length
            }
          </strong>
        </article>
        <article>
          <span>Equipment needing repair</span>
          <strong>
            {
              equipment.filter((item) =>
                ["needs_repair", "under_maintenance"].includes(
                  item.condition_status,
                ),
              ).length
            }
          </strong>
        </article>
      </section>

      {showEquipmentForm && (
        <section className="equipment-panel">
          <div className="equipment-panel-heading">
            <h2>{editingId ? "Edit Equipment" : "Register Equipment"}</h2>
            <button
              className="equipment-icon-button"
              type="button"
              onClick={resetEquipmentForm}
              aria-label="Close equipment form"
            >
              <FiX />
            </button>
          </div>

          <form onSubmit={saveEquipment} className="equipment-form">
            <label>
              Equipment code *
              <input
                name="equipment_code"
                value={equipmentForm.equipment_code}
                onChange={updateEquipmentField}
                required
                maxLength={60}
              />
            </label>

            <label>
              Equipment name *
              <input
                name="name"
                value={equipmentForm.name}
                onChange={updateEquipmentField}
                required
              />
            </label>

            <label>
              Category *
              <input
                name="category"
                value={equipmentForm.category}
                onChange={updateEquipmentField}
                placeholder="e.g. Laboratory, Imaging"
                required
              />
            </label>

            <label>
              Manufacturer
              <input
                name="manufacturer"
                value={equipmentForm.manufacturer}
                onChange={updateEquipmentField}
              />
            </label>

            <label>
              Model number
              <input
                name="model_number"
                value={equipmentForm.model_number}
                onChange={updateEquipmentField}
              />
            </label>

            <label>
              Serial number
              <input
                name="serial_number"
                value={equipmentForm.serial_number}
                onChange={updateEquipmentField}
              />
            </label>

            <label>
              Location
              <input
                name="location"
                value={equipmentForm.location}
                onChange={updateEquipmentField}
                placeholder="e.g. Laboratory Room 2"
              />
            </label>

            <label>
              Condition
              <select
                name="condition_status"
                value={equipmentForm.condition_status}
                onChange={updateEquipmentField}
              >
                {conditions.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Purchase date
              <input
                type="date"
                name="purchase_date"
                value={equipmentForm.purchase_date || ""}
                onChange={updateEquipmentField}
              />
            </label>

            <label>
              Warranty expiry
              <input
                type="date"
                name="warranty_expiry"
                value={equipmentForm.warranty_expiry || ""}
                onChange={updateEquipmentField}
              />
            </label>

            <label className="equipment-form-wide">
              Notes
              <textarea
                name="notes"
                value={equipmentForm.notes}
                onChange={updateEquipmentField}
                rows={3}
              />
            </label>

            <div className="equipment-form-actions equipment-form-wide">
              <button
                type="button"
                className="equipment-button"
                onClick={resetEquipmentForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="equipment-button equipment-button-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Register Equipment"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="equipment-panel">
        <div className="equipment-panel-heading">
          <div>
            <h2>Equipment Register</h2>
            <p>Search, inspect, edit, or deactivate equipment.</p>
          </div>
          <button
            className="equipment-button"
            onClick={loadData}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="equipment-filters">
          <label className="equipment-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search code, name, category, serial, location..."
            />
          </label>

          <select
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by equipment condition"
          >
            <option value="">All conditions</option>
            {conditions.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="equipment-empty">Loading equipment records...</p>
        ) : equipment.length === 0 ? (
          <p className="equipment-empty">No equipment records found.</p>
        ) : (
          <div className="equipment-table-wrap">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th>Code / Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Condition</th>
                  <th>Warranty expiry</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.equipment_code}</small>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.location || "—"}</td>
                    <td>
                      <span
                        className={`equipment-condition condition-${item.condition_status}`}
                      >
                        {readable(item.condition_status)}
                      </span>
                    </td>
                    <td>{dateValue(item.warranty_expiry) || "—"}</td>
                    <td>
                      <div className="equipment-row-actions">
                        <button
                          className="equipment-icon-button"
                          onClick={() => editEquipment(item)}
                          aria-label={`Edit ${item.name}`}
                          title="Edit"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          className="equipment-icon-button equipment-danger"
                          onClick={() => deactivateEquipment(item)}
                          aria-label={`Deactivate ${item.name}`}
                          title="Deactivate"
                        >
                          <FiArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="equipment-pagination">
          <span>
            {pagination.total} equipment record(s) · Page{" "}
            {pagination.page || page} of{" "}
            {Math.max(1, pagination.totalPages || 1)}
          </span>
          <div>
            <button
              className="equipment-button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              className="equipment-button"
              disabled={loading || page >= (pagination.totalPages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="equipment-panel">
        <div className="equipment-panel-heading">
          <div>
            <h2>
              <FiClipboard /> Maintenance Work Orders
            </h2>
            <p>Create repair requests and update their progress.</p>
          </div>
          <button
            className="equipment-button equipment-button-primary"
            onClick={() => {
              setOrderForm(emptyOrder);
              setShowOrderForm((current) => !current);
            }}
          >
            <FiPlus /> New Work Order
          </button>
        </div>

        {showOrderForm && (
          <form className="equipment-form" onSubmit={saveOrder}>
            <label>
              Equipment *
              <select
                name="equipment_id"
                value={orderForm.equipment_id}
                onChange={updateOrderField}
                required
              >
                <option value="">Select equipment</option>
                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.equipment_code} — {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Work-order title *
              <input
                name="title"
                value={orderForm.title}
                onChange={updateOrderField}
                required
              />
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={orderForm.priority}
                onChange={updateOrderField}
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {readable(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scheduled date
              <input
                type="date"
                name="scheduled_date"
                value={orderForm.scheduled_date}
                onChange={updateOrderField}
              />
            </label>

            <label>
              Estimated cost
              <input
                type="number"
                min="0"
                step="0.01"
                name="cost"
                value={orderForm.cost}
                onChange={updateOrderField}
              />
            </label>

            <label className="equipment-form-wide">
              Description
              <textarea
                name="description"
                value={orderForm.description}
                onChange={updateOrderField}
                rows={3}
              />
            </label>

            <div className="equipment-form-actions equipment-form-wide">
              <button
                type="button"
                className="equipment-button"
                onClick={() => setShowOrderForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="equipment-button equipment-button-primary"
                disabled={saving || equipment.length === 0}
              >
                {saving ? "Saving..." : "Create Work Order"}
              </button>
            </div>
          </form>
        )}

        <div className="equipment-filters">
          <label>
            Filter work orders
            <select
              value={orderStatus}
              onChange={(event) => setOrderStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {orders.length === 0 ? (
          <p className="equipment-empty">No maintenance work orders found.</p>
        ) : (
          <div className="equipment-table-wrap">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Work order</th>
                  <th>Priority</th>
                  <th>Scheduled</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.equipment_name}</strong>
                      <small>{order.equipment_code}</small>
                    </td>
                    <td>
                      {order.title}
                      {order.description && <small>{order.description}</small>}
                    </td>
                    <td>{readable(order.priority)}</td>
                    <td>{dateValue(order.scheduled_date) || "—"}</td>
                    <td>{Number(order.cost || 0).toFixed(2)}</td>
                    <td>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          changeOrderStatus(order, event.target.value)
                        }
                        aria-label={`Status for ${order.title}`}
                      >
                        {statuses.map((item) => (
                          <option key={item} value={item}>
                            {readable(item)}
                          </option>
                        ))}
                      </select>
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

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFileText,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";

import api from "../../services/api";
import radiologyService from "../../services/radiology.service";
import "./Radiology.css";

const MODALITIES = [
  "xray",
  "ultrasound",
  "ct",
  "mri",
  "mammography",
  "fluoroscopy",
  "other",
];

const PRIORITIES = ["routine", "urgent", "stat"];

const ORDER_STATUSES = [
  "requested",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

const REPORT_STATUSES = ["draft", "final", "amended"];

const EMPTY_SERVICE = {
  service_code: "",
  service_name: "",
  modality: "xray",
  description: "",
  price: "0",
  is_active: true,
};

const EMPTY_ORDER = {
  patient_id: "",
  service_id: "",
  order_number: "",
  clinical_indication: "",
  priority: "routine",
  scheduled_at: "",
  assigned_radiologist_id: "",
};

const EMPTY_REPORT = {
  radiologist_id: "",
  findings: "",
  impression: "",
  recommendations: "",
  report_status: "draft",
};

function extractRows(response) {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.patients)) return body.patients;
  if (Array.isArray(body?.orders)) return body.orders;
  if (Array.isArray(body?.services)) return body.services;

  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatStatus(value) {
  if (!value) return "Unknown";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function patientName(patient) {
  return [patient.first_name, patient.last_name].filter(Boolean).join(" ");
}

function Radiology() {
  const [activeTab, setActiveTab] = useState("orders");
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [staff, setStaff] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");

  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const [orderForm, setOrderForm] = useState(EMPTY_ORDER);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reportForm, setReportForm] = useState(EMPTY_REPORT);
  const [showReportForm, setShowReportForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [serviceResponse, orderResponse, patientResponse, staffResponse] =
        await Promise.all([
          radiologyService.getServices({ limit: 100 }),
          radiologyService.getOrders({ limit: 100 }),
          api.get("/patients", { params: { limit: 100 } }),
          api.get("/staff", { params: { limit: 100 } }),
        ]);

      setServices(extractRows(serviceResponse));
      setOrders(extractRows(orderResponse));
      setPatients(extractRows(patientResponse));

      setStaff(
        extractRows(staffResponse).filter(
          (person) => person.is_active === true,
        ),
      );
    } catch (error) {
      console.error("Failed to load Radiology data:", error);

      toast.error(
        error.response?.data?.message ||
          "Could not load Radiology data. Check the API and your login.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeServices = useMemo(
    () =>
      services.filter((service) => {
        const active = service.is_active;

        return (
          active === true ||
          active === 1 ||
          active === "true" ||
          active === "t" ||
          active === "1"
        );
      }),
    [services],
  );

  const visibleServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !query ||
        service.service_name?.toLowerCase().includes(query) ||
        service.service_code?.toLowerCase().includes(query);

      const matchesModality =
        !modalityFilter || service.modality === modalityFilter;

      return matchesSearch && matchesModality;
    });
  }, [services, search, modalityFilter]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const name = [order.patient_first_name, order.patient_last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        order.order_number?.toLowerCase().includes(query) ||
        name.includes(query) ||
        order.service_name?.toLowerCase().includes(query);

      const matchesStatus =
        !statusFilter || order.order_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const statistics = useMemo(
    () => ({
      services: activeServices.length,
      orders: orders.length,
      pending: orders.filter((order) =>
        ["requested", "scheduled"].includes(order.order_status),
      ).length,
      completed: orders.filter((order) => order.order_status === "completed")
        .length,
    }),
    [activeServices, orders],
  );

  function resetServiceForm() {
    setServiceForm(EMPTY_SERVICE);
    setEditingServiceId(null);
    setShowServiceForm(false);
  }

  function openCreateService() {
    setServiceForm(EMPTY_SERVICE);
    setEditingServiceId(null);
    setShowServiceForm(true);
  }

  function openEditService(service) {
    setServiceForm({
      service_code: service.service_code || "",
      service_name: service.service_name || "",
      modality: service.modality || "other",
      description: service.description || "",
      price: String(service.price ?? 0),
      is_active: Boolean(service.is_active),
    });

    setEditingServiceId(service.id);
    setShowServiceForm(true);
  }

  async function handleSaveService(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...serviceForm,
        service_code: serviceForm.service_code.trim(),
        service_name: serviceForm.service_name.trim(),
        description: serviceForm.description.trim(),
        price: Number(serviceForm.price),
      };

      if (editingServiceId) {
        await radiologyService.updateService(editingServiceId, payload);
        toast.success("Imaging service updated.");
      } else {
        await radiologyService.createService(payload);
        toast.success("Imaging service created.");
      }

      resetServiceForm();
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save the service.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleService(service) {
    const nextActive = !service.is_active;

    try {
      await radiologyService.setServiceActive(service.id, nextActive);
      toast.success(nextActive ? "Service activated." : "Service deactivated.");
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not update the service status.",
      );
    }
  }

  function openCreateOrder() {
    setOrderForm({
      ...EMPTY_ORDER,
      service_id: activeServices[0]?.id || "",
    });
    setShowOrderForm(true);
  }

  async function handleCreateOrder(event) {
    event.preventDefault();

    if (!orderForm.patient_id || !orderForm.service_id) {
      toast.error("Select a patient and imaging service.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        patient_id: orderForm.patient_id,
        service_id: orderForm.service_id,
        order_number: orderForm.order_number.trim() || undefined,
        clinical_indication: orderForm.clinical_indication.trim(),
        priority: orderForm.priority,
        scheduled_at: orderForm.scheduled_at
          ? new Date(orderForm.scheduled_at).toISOString()
          : null,
        assigned_radiologist_id: orderForm.assigned_radiologist_id || null,
      };

      await radiologyService.createOrder(payload);

      toast.success("Imaging order created.");
      setShowOrderForm(false);
      setOrderForm(EMPTY_ORDER);
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not create imaging order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(order, nextStatus) {
    const payload = { order_status: nextStatus };

    if (nextStatus === "scheduled") {
      const date = window.prompt(
        "Enter the scheduled date and time (for example, 2026-10-20T09:30):",
        order.scheduled_at ? order.scheduled_at.slice(0, 16) : "",
      );

      if (!date) return;

      if (Number.isNaN(new Date(date).getTime())) {
        toast.error("Enter a valid scheduled date and time.");
        return;
      }

      payload.scheduled_at = new Date(date).toISOString();
    }

    if (nextStatus === "cancelled") {
      const reason = window.prompt("Why is this order being cancelled?");

      if (!reason?.trim()) {
        toast.error("A cancellation reason is required.");
        return;
      }

      payload.cancellation_reason = reason.trim();
    }

    if (nextStatus === "in_progress" && !order.assigned_radiologist_id) {
      const staffId = window.prompt(
        "Enter the active radiologist's staff profile ID:",
      );

      if (!staffId?.trim()) {
        toast.error("Assign a radiologist before starting this order.");
        return;
      }

      payload.assigned_radiologist_id = staffId.trim();
    }

    try {
      await radiologyService.updateOrderStatus(order.id, payload);
      toast.success("Imaging order status updated.");
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Could not update imaging order status.",
      );
    }
  }

  async function openReport(order) {
    try {
      const response = await radiologyService.getOrder(order.id);
      const detail = response.data?.data;

      if (!detail) {
        toast.error("Could not load the imaging order.");
        return;
      }

      setSelectedOrder(detail);

      const report = detail.report;

      setReportForm({
        radiologist_id: report?.radiologist_id
          ? String(report.radiologist_id)
          : detail.assigned_radiologist_id
            ? String(detail.assigned_radiologist_id)
            : "",
        findings: report?.findings || "",
        impression: report?.impression || "",
        recommendations: report?.recommendations || "",
        report_status:
          report?.report_status === "final"
            ? "amended"
            : report?.report_status || "draft",
      });

      setShowReportForm(true);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not open the imaging report.",
      );
    }
  }

  async function handleSaveReport(event) {
    event.preventDefault();

    if (!selectedOrder) return;

    setSaving(true);

    try {
      const payload = {
        radiologist_id: reportForm.radiologist_id || null,
        findings: reportForm.findings.trim(),
        impression: reportForm.impression.trim(),
        recommendations: reportForm.recommendations.trim(),
        report_status: reportForm.report_status,
      };

      await radiologyService.saveReport(selectedOrder.id, payload);

      toast.success("Imaging report saved.");
      setShowReportForm(false);
      setSelectedOrder(null);
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save the imaging report.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="radiology-page">
      <header className="radiology-header">
        <div>
          <div className="radiology-eyebrow">
            <FiImage />
            DIAGNOSTIC IMAGING
          </div>

          <h1>Radiology Management</h1>

          <p>
            Manage imaging services, patient orders, examination progress, and
            radiology reports.
          </p>
        </div>

        <button
          type="button"
          className="rad-button rad-button-secondary"
          onClick={loadData}
          disabled={loading}
        >
          <FiRefreshCw />
          Refresh
        </button>
      </header>

      <section className="radiology-stats">
        <article className="rad-stat-card">
          <span className="rad-stat-icon blue">
            <FiImage />
          </span>
          <div>
            <p>Active services</p>
            <h2>{statistics.services}</h2>
          </div>
        </article>

        <article className="rad-stat-card">
          <span className="rad-stat-icon purple">
            <FiActivity />
          </span>
          <div>
            <p>Total orders</p>
            <h2>{statistics.orders}</h2>
          </div>
        </article>

        <article className="rad-stat-card">
          <span className="rad-stat-icon amber">
            <FiClock />
          </span>
          <div>
            <p>Pending orders</p>
            <h2>{statistics.pending}</h2>
          </div>
        </article>

        <article className="rad-stat-card">
          <span className="rad-stat-icon green">
            <FiCheckCircle />
          </span>
          <div>
            <p>Completed orders</p>
            <h2>{statistics.completed}</h2>
          </div>
        </article>
      </section>

      <section className="radiology-workspace">
        <div className="rad-tabs">
          <button
            type="button"
            className={activeTab === "orders" ? "active" : ""}
            onClick={() => {
              setActiveTab("orders");
              setSearch("");
            }}
          >
            Imaging orders
          </button>

          <button
            type="button"
            className={activeTab === "services" ? "active" : ""}
            onClick={() => {
              setActiveTab("services");
              setSearch("");
            }}
          >
            Imaging services
          </button>
        </div>

        <div className="rad-toolbar">
          <label className="rad-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeTab === "orders"
                  ? "Search order, patient, or service..."
                  : "Search service name or code..."
              }
            />
          </label>

          {activeTab === "orders" ? (
            <>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter orders by status"
              >
                <option value="">All statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="rad-button rad-button-primary"
                onClick={openCreateOrder}
              >
                <FiPlus />
                New order
              </button>
            </>
          ) : (
            <>
              <select
                value={modalityFilter}
                onChange={(event) => setModalityFilter(event.target.value)}
                aria-label="Filter services by modality"
              >
                <option value="">All modalities</option>
                {MODALITIES.map((modality) => (
                  <option key={modality} value={modality}>
                    {formatStatus(modality)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="rad-button rad-button-primary"
                onClick={openCreateService}
              >
                <FiPlus />
                Add service
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="rad-state">
            <span className="rad-spinner" />
            <p>Loading Radiology data...</p>
          </div>
        ) : activeTab === "orders" ? (
          <div className="rad-table-wrap">
            <table className="rad-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Patient</th>
                  <th>Imaging service</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.order_number}</strong>
                      <small>{order.modality?.toUpperCase()}</small>
                    </td>

                    <td>
                      <strong>
                        {patientName({
                          first_name: order.patient_first_name,
                          last_name: order.patient_last_name,
                        }) || "Unknown patient"}
                      </strong>
                      <small>Patient ID: {order.patient_id}</small>
                    </td>

                    <td>{order.service_name || "—"}</td>

                    <td>
                      <span
                        className={`rad-priority ${order.priority || "routine"}`}
                      >
                        {formatStatus(order.priority)}
                      </span>
                    </td>

                    <td>
                      <span className={`rad-status ${order.order_status}`}>
                        {formatStatus(order.order_status)}
                      </span>
                    </td>

                    <td>{formatDate(order.requested_at)}</td>

                    <td>
                      <div className="rad-row-actions">
                        <button
                          type="button"
                          className="rad-icon-button"
                          title="Open imaging report"
                          onClick={() => openReport(order)}
                        >
                          <FiFileText />
                        </button>

                        {order.order_status !== "completed" &&
                          order.order_status !== "cancelled" && (
                            <select
                              className="rad-action-select"
                              aria-label={`Update status for ${order.order_number}`}
                              value=""
                              onChange={(event) => {
                                const nextStatus = event.target.value;
                                if (nextStatus) {
                                  handleStatusChange(order, nextStatus);
                                }
                              }}
                            >
                              <option value="">Update status</option>

                              {ORDER_STATUSES.filter(
                                (status) => status !== order.order_status,
                              ).map((status) => (
                                <option key={status} value={status}>
                                  {formatStatus(status)}
                                </option>
                              ))}
                            </select>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleOrders.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      <div className="rad-empty">
                        <FiAlertCircle />
                        <p>No imaging orders match your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rad-table-wrap">
            <table className="rad-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Service</th>
                  <th>Modality</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleServices.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.service_code}</strong>
                    </td>

                    <td>
                      <strong>{service.service_name}</strong>
                      <small>{service.description || "No description"}</small>
                    </td>

                    <td>{formatStatus(service.modality)}</td>

                    <td>
                      {Number(service.price || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td>
                      <span
                        className={`rad-status ${
                          service.is_active ? "active" : "inactive"
                        }`}
                      >
                        {service.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="rad-row-actions">
                        <button
                          type="button"
                          className="rad-icon-button"
                          title="Edit service"
                          onClick={() => openEditService(service)}
                        >
                          <FiEdit2 />
                        </button>

                        <button
                          type="button"
                          className="rad-button rad-button-small rad-button-secondary"
                          onClick={() => handleToggleService(service)}
                        >
                          {service.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleServices.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="rad-empty">
                        <FiAlertCircle />
                        <p>No imaging services match your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showServiceForm && (
        <div className="rad-modal-backdrop">
          <section
            className="rad-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rad-service-title"
          >
            <header className="rad-modal-header">
              <div>
                <h2 id="rad-service-title">
                  {editingServiceId
                    ? "Edit imaging service"
                    : "Add imaging service"}
                </h2>
                <p>Configure the imaging service catalogue.</p>
              </div>

              <button
                type="button"
                className="rad-icon-button"
                onClick={resetServiceForm}
                aria-label="Close service form"
              >
                <FiXCircle />
              </button>
            </header>

            <form onSubmit={handleSaveService}>
              <div className="rad-form-grid">
                <label>
                  Service code *
                  <input
                    required
                    maxLength={50}
                    value={serviceForm.service_code}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        service_code: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Service name *
                  <input
                    required
                    maxLength={180}
                    value={serviceForm.service_name}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        service_name: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Modality *
                  <select
                    value={serviceForm.modality}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        modality: event.target.value,
                      })
                    }
                  >
                    {MODALITIES.map((modality) => (
                      <option key={modality} value={modality}>
                        {formatStatus(modality)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Price
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceForm.price}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        price: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="rad-full-width">
                  Description
                  <textarea
                    rows="3"
                    value={serviceForm.description}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        description: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="rad-checkbox-label">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_active}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Service is active
                </label>
              </div>

              <footer className="rad-modal-actions">
                <button
                  type="button"
                  className="rad-button rad-button-secondary"
                  onClick={resetServiceForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rad-button rad-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save service"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {showOrderForm && (
        <div className="rad-modal-backdrop">
          <section
            className="rad-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rad-order-title"
          >
            <header className="rad-modal-header">
              <div>
                <h2 id="rad-order-title">Create imaging order</h2>
                <p>Choose the patient and examination details.</p>
              </div>

              <button
                type="button"
                className="rad-icon-button"
                onClick={() => setShowOrderForm(false)}
                aria-label="Close order form"
              >
                <FiXCircle />
              </button>
            </header>

            <form onSubmit={handleCreateOrder}>
              <div className="rad-form-grid">
                <label className="rad-full-width">
                  Patient *
                  <select
                    required
                    value={orderForm.patient_id}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        patient_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select a patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.mr_number ? `${patient.mr_number} — ` : ""}
                        {patientName(patient)}
                      </option>
                    ))}
                  </select>
                  {patients.length === 0 && (
                    <small className="rad-field-note">
                      No patients were returned by the patients API.
                    </small>
                  )}
                </label>

                <label className="rad-full-width">
                  Imaging service *
                  <select
                    required
                    value={orderForm.service_id}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        service_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select an active service</option>
                    {activeServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.service_code} — {service.service_name}
                      </option>
                    ))}
                  </select>
                  {activeServices.length === 0 && (
                    <small className="rad-field-note">
                      Create and activate an imaging service first.
                    </small>
                  )}
                </label>

                <label>
                  Order number
                  <input
                    maxLength={60}
                    placeholder="Generated automatically if empty"
                    value={orderForm.order_number}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        order_number: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Priority
                  <select
                    value={orderForm.priority}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        priority: event.target.value,
                      })
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatStatus(priority)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rad-full-width">
                  Clinical indication *
                  <textarea
                    required
                    rows="3"
                    value={orderForm.clinical_indication}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        clinical_indication: event.target.value,
                      })
                    }
                    placeholder="Reason for the imaging examination"
                  />
                </label>

                <label>
                  Schedule date and time
                  <input
                    type="datetime-local"
                    value={orderForm.scheduled_at}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        scheduled_at: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Radiologist staff ID
                  <input
                    type="number"
                    min="1"
                    placeholder="Optional staff profile ID"
                    value={orderForm.assigned_radiologist_id}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        assigned_radiologist_id: event.target.value,
                      })
                    }
                  />
                  <small className="rad-field-note">
                    Enter an active staff profile ID from this hospital.
                  </small>
                </label>
              </div>

              <footer className="rad-modal-actions">
                <button
                  type="button"
                  className="rad-button rad-button-secondary"
                  onClick={() => setShowOrderForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rad-button rad-button-primary"
                  disabled={
                    saving ||
                    patients.length === 0 ||
                    activeServices.length === 0
                  }
                >
                  {saving ? "Creating..." : "Create order"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {showReportForm && selectedOrder && (
        <div className="rad-modal-backdrop">
          <section
            className="rad-modal rad-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rad-report-title"
          >
            <header className="rad-modal-header">
              <div>
                <h2 id="rad-report-title">Imaging report</h2>
                <p>
                  {selectedOrder.order_number} · {selectedOrder.service_name}
                </p>
              </div>

              <button
                type="button"
                className="rad-icon-button"
                onClick={() => setShowReportForm(false)}
                aria-label="Close report form"
              >
                <FiXCircle />
              </button>
            </header>

            <div className="rad-order-summary">
              <span>
                Patient:{" "}
                <strong>
                  {patientName({
                    first_name: selectedOrder.patient_first_name,
                    last_name: selectedOrder.patient_last_name,
                  }) || selectedOrder.patient_id}
                </strong>
              </span>

              <span>
                Order status:{" "}
                <strong>{formatStatus(selectedOrder.order_status)}</strong>
              </span>
            </div>

            <form onSubmit={handleSaveReport}>
              <div className="rad-form-grid">
                <label>
                  Radiologist staff ID
                  <input
                    type="number"
                    min="1"
                    value={reportForm.radiologist_id}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        radiologist_id: event.target.value,
                      })
                    }
                    placeholder="Optional staff profile ID"
                  />
                </label>

                <label>
                  Report status *
                  <select
                    value={reportForm.report_status}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        report_status: event.target.value,
                      })
                    }
                  >
                    {REPORT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rad-full-width">
                  Findings
                  <textarea
                    rows="4"
                    value={reportForm.findings}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        findings: event.target.value,
                      })
                    }
                    placeholder="Describe the imaging findings"
                  />
                </label>

                <label className="rad-full-width">
                  Impression *
                  <textarea
                    required
                    rows="3"
                    value={reportForm.impression}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        impression: event.target.value,
                      })
                    }
                    placeholder="Enter the radiologist's impression"
                  />
                </label>

                <label className="rad-full-width">
                  Recommendations
                  <textarea
                    rows="3"
                    value={reportForm.recommendations}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        recommendations: event.target.value,
                      })
                    }
                    placeholder="Suggested follow-up or additional imaging"
                  />
                </label>
              </div>

              <footer className="rad-modal-actions">
                <button
                  type="button"
                  className="rad-button rad-button-secondary"
                  onClick={() => setShowReportForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rad-button rad-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save report"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Radiology;

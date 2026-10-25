import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchMedications,
  createMedication,
  updateMedication,
  setMedicationActive,
  fetchMedicationBatches,
  receiveStock,
  dispenseStock,
  fetchInventoryMovements,
} from "../../services/pharmacy.service";
import "./Pharmacy.css";

const EMPTY_MEDICATION = {
  code: "",
  name: "",
  generic_name: "",
  category: "",
  dosage_form: "",
  strength: "",
  manufacturer: "",
  unit_of_measure: "unit",
  reorder_level: "0",
  prescription_required: true,
};

const EMPTY_STOCK = {
  medication_id: "",
  batch_number: "",
  quantity: "",
  unit_cost: "0",
  selling_price: "0",
  manufactured_on: "",
  expires_on: "",
  supplier_name: "",
};

const NAV_ITEMS = [
  { id: "overview", icon: "▦", label: "Overview" },
  { id: "medications", icon: "✚", label: "Medications" },
  { id: "receive", icon: "↓", label: "Receive stock" },
  { id: "dispense", icon: "↗", label: "Dispense" },
  { id: "batches", icon: "▤", label: "Batches" },
  { id: "movements", icon: "↔", label: "Movement history" },
];

const money = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateLabel = (value) => {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString();
};

export default function Pharmacy() {
  const [activeTab, setActiveTab] = useState("overview");
  const [medications, setMedications] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [selectedMedication, setSelectedMedication] = useState(null);

  const [medicationForm, setMedicationForm] = useState(EMPTY_MEDICATION);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK);
  const [dispenseForm, setDispenseForm] = useState({
    medication_id: "",
    quantity: "",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [medicationRows, movementRows] = await Promise.all([
        fetchMedications(search),
        fetchInventoryMovements(),
      ]);

      setMedications(medicationRows);
      setMovements(movementRows);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load pharmacy data.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeMedications = medications.filter((item) => item.is_active);

  const lowStockItems = medications.filter(
    (item) =>
      Number(item.total_stock) <= Number(item.reorder_level) && item.is_active,
  );

  const expiringBatchCount = medications.reduce(
    (total, item) => total + Number(item.expiring_batches || 0),
    0,
  );

  const totalUnits = medications.reduce(
    (total, item) => total + Number(item.total_stock || 0),
    0,
  );

  function changeTab(tab) {
    setActiveTab(tab);
  }

  function resetMedicationForm() {
    setEditingId(null);
    setMedicationForm(EMPTY_MEDICATION);
  }

  async function handleMedicationSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...medicationForm,
        reorder_level: Number(medicationForm.reorder_level),
      };

      if (editingId) {
        await updateMedication(editingId, payload);
        toast.success("Medication updated successfully.");
      } else {
        await createMedication(payload);
        toast.success("Medication added successfully.");
      }

      resetMedicationForm();
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to save medication.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(medication) {
    setEditingId(medication.id);

    setMedicationForm({
      code: medication.code || "",
      name: medication.name || "",
      generic_name: medication.generic_name || "",
      category: medication.category || "",
      dosage_form: medication.dosage_form || "",
      strength: medication.strength || "",
      manufacturer: medication.manufacturer || "",
      unit_of_measure: medication.unit_of_measure || "unit",
      reorder_level: String(medication.reorder_level ?? 0),
      prescription_required: medication.prescription_required,
    });

    setActiveTab("medications");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleActiveToggle(medication) {
    try {
      await setMedicationActive(medication.id, !medication.is_active);
      toast.success(
        medication.is_active
          ? "Medication deactivated."
          : "Medication activated.",
      );
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update medication.",
      );
    }
  }

  async function handleReceiveStock(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await receiveStock({
        ...stockForm,
        quantity: Number(stockForm.quantity),
        unit_cost: Number(stockForm.unit_cost),
        selling_price: Number(stockForm.selling_price),
        manufactured_on: stockForm.manufactured_on || null,
        expires_on: stockForm.expires_on || null,
      });

      toast.success("Stock received and recorded.");
      setStockForm(EMPTY_STOCK);
      await loadData();
      setActiveTab("batches");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to receive stock.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDispense(event) {
    event.preventDefault();
    setSaving(true);

    try {
      console.log("Dispense form data:", dispenseForm);

      console.log("Dispense request payload:", {
        ...dispenseForm,
        quantity: Number(dispenseForm.quantity),
      });
      await dispenseStock({
        ...dispenseForm,
        quantity: Number(dispenseForm.quantity),
      });

      toast.success("Stock dispensed successfully.");
      setDispenseForm({
        medication_id: "",
        quantity: "",
        notes: "",
      });
      await loadData();
      setActiveTab("movements");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to dispense stock.");
    } finally {
      setSaving(false);
    }
  }

  async function handleViewBatches(medication) {
    try {
      const rows = await fetchMedicationBatches(medication.id);
      setBatches(rows);
      setSelectedMedication(medication);
      setActiveTab("batches");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load medication batches.",
      );
    }
  }

  async function handleRefresh() {
    await loadData();

    if (activeTab === "batches" && selectedMedication) {
      try {
        const rows = await fetchMedicationBatches(selectedMedication.id);
        setBatches(rows);
      } catch {
        // The main refresh has already displayed its own error if needed.
      }
    }
  }

  function renderMedicationForm() {
    return (
      <form className="pharmacy-form" onSubmit={handleMedicationSubmit}>
        <div className="pharmacy-form-grid">
          {[
            ["code", "Medication code", true],
            ["name", "Medicine name", true],
            ["generic_name", "Generic name"],
            ["category", "Category"],
            ["dosage_form", "Dosage form"],
            ["strength", "Strength"],
            ["manufacturer", "Manufacturer"],
            ["unit_of_measure", "Unit of measure", true],
            ["reorder_level", "Reorder level", true],
          ].map(([key, label, required]) => (
            <label className="pharmacy-field" key={key}>
              <span>
                {label}
                {required && <b className="required-mark"> *</b>}
              </span>
              <input
                type={key === "reorder_level" ? "number" : "text"}
                min={key === "reorder_level" ? "0" : undefined}
                step={key === "reorder_level" ? "0.01" : undefined}
                required={Boolean(required)}
                value={medicationForm[key]}
                onChange={(event) =>
                  setMedicationForm((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>

        <label className="pharmacy-checkbox">
          <input
            type="checkbox"
            checked={medicationForm.prescription_required}
            onChange={(event) =>
              setMedicationForm((current) => ({
                ...current,
                prescription_required: event.target.checked,
              }))
            }
          />
          Prescription required
        </label>

        <div className="pharmacy-form-footer">
          <button className="pharmacy-button" type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
                ? "Save changes"
                : "Add medication"}
          </button>

          {editingId && (
            <button
              className="pharmacy-button pharmacy-button-light"
              type="button"
              onClick={resetMedicationForm}
            >
              Cancel editing
            </button>
          )}
        </div>
      </form>
    );
  }

  function renderOverview() {
    return (
      <>
        <section className="pharmacy-welcome">
          <div>
            <span className="pharmacy-eyebrow">PHARMACY MANAGEMENT</span>
            <h2>Good work starts with a clear overview.</h2>
            <p>
              Monitor medicine availability, track stock, and manage your
              pharmacy operations in one place.
            </p>
          </div>
          <div className="pharmacy-welcome-icon" aria-hidden="true">
            ✚
          </div>
        </section>

        <section className="pharmacy-stat-grid">
          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-top">
              <span className="pharmacy-stat-icon teal">✚</span>
              <span className="pharmacy-stat-caption">Catalogue</span>
            </div>
            <strong>{medications.length}</strong>
            <span className="pharmacy-stat-label">Total medications</span>
            <small>{activeMedications.length} currently active</small>
          </article>

          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-top">
              <span className="pharmacy-stat-icon amber">!</span>
              <span className="pharmacy-stat-caption">Needs attention</span>
            </div>
            <strong>{lowStockItems.length}</strong>
            <span className="pharmacy-stat-label">Low-stock medicines</span>
            <small>At or below reorder level</small>
          </article>

          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-top">
              <span className="pharmacy-stat-icon blue">▤</span>
              <span className="pharmacy-stat-caption">Inventory</span>
            </div>
            <strong>{totalUnits.toLocaleString()}</strong>
            <span className="pharmacy-stat-label">Units in recorded stock</span>
            <small>Across the listed catalogue</small>
          </article>

          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-top">
              <span className="pharmacy-stat-icon rose">◷</span>
              <span className="pharmacy-stat-caption">Expiry watch</span>
            </div>
            <strong>{expiringBatchCount}</strong>
            <span className="pharmacy-stat-label">Batches expiring soon</span>
            <small>Within the next 90 days, including today</small>
          </article>
        </section>

        <section className="pharmacy-overview-grid">
          <div className="pharmacy-card">
            <div className="pharmacy-card-heading">
              <div>
                <h3>Quick actions</h3>
                <p>Go directly to a common task.</p>
              </div>
            </div>

            <div className="pharmacy-quick-actions">
              <button
                className="pharmacy-quick-action"
                onClick={() => {
                  resetMedicationForm();
                  setActiveTab("medications");
                }}
              >
                <span className="quick-action-icon teal">＋</span>
                <span>
                  <strong>Add medication</strong>
                  <small>Create a catalogue record</small>
                </span>
                <span className="quick-action-arrow">›</span>
              </button>

              <button
                className="pharmacy-quick-action"
                onClick={() => setActiveTab("receive")}
              >
                <span className="quick-action-icon blue">↓</span>
                <span>
                  <strong>Receive stock</strong>
                  <small>Record a new medicine batch</small>
                </span>
                <span className="quick-action-arrow">›</span>
              </button>

              <button
                className="pharmacy-quick-action"
                onClick={() => setActiveTab("dispense")}
              >
                <span className="quick-action-icon violet">↗</span>
                <span>
                  <strong>Dispense stock</strong>
                  <small>Record stock issued</small>
                </span>
                <span className="quick-action-arrow">›</span>
              </button>

              <button
                className="pharmacy-quick-action"
                onClick={() => setActiveTab("movements")}
              >
                <span className="quick-action-icon amber">↔</span>
                <span>
                  <strong>View stock history</strong>
                  <small>Review recent movements</small>
                </span>
                <span className="quick-action-arrow">›</span>
              </button>
            </div>
          </div>

          <div className="pharmacy-card">
            <div className="pharmacy-card-heading">
              <div>
                <h3>Stock alerts</h3>
                <p>Items that may need attention.</p>
              </div>
              <button
                className="pharmacy-text-button"
                onClick={() => setActiveTab("medications")}
              >
                View all
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="pharmacy-empty-state">
                <span className="pharmacy-empty-icon">✓</span>
                <strong>No low-stock medicines</strong>
                <p>
                  No active medicines are currently at or below their reorder
                  level.
                </p>
              </div>
            ) : (
              <div className="pharmacy-alert-list">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div className="pharmacy-alert-item" key={item.id}>
                    <span className="pharmacy-alert-icon">!</span>
                    <span className="pharmacy-alert-details">
                      <strong>{item.name}</strong>
                      <small>{item.code}</small>
                    </span>
                    <span className="pharmacy-alert-stock">
                      {Number(item.total_stock) <= 0
                        ? "Out of stock"
                        : `${Number(item.total_stock).toLocaleString()} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="pharmacy-card">
          <div className="pharmacy-card-heading">
            <div>
              <h3>Recent inventory activity</h3>
              <p>The latest recorded stock movements.</p>
            </div>
            <button
              className="pharmacy-text-button"
              onClick={() => setActiveTab("movements")}
            >
              Full history →
            </button>
          </div>

          {renderMovementTable(movements.slice(0, 5))}
        </section>
      </>
    );
  }

  function renderMedicationTable(rows) {
    return (
      <div className="pharmacy-table-wrap">
        <table className="pharmacy-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Code</th>
              <th>Available stock</th>
              <th>Reorder level</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const low =
                Number(item.total_stock) <= Number(item.reorder_level);

              return (
                <tr key={item.id}>
                  <td>
                    <div className="pharmacy-medicine-cell">
                      <span className="pharmacy-medicine-avatar">
                        {String(item.name || "M")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {[item.strength, item.dosage_form]
                            .filter(Boolean)
                            .join(" · ") ||
                            item.generic_name ||
                            "Medicine"}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>{item.code}</td>
                  <td>
                    <strong>{Number(item.total_stock).toLocaleString()}</strong>
                    <small>{item.unit_of_measure || "units"}</small>
                  </td>
                  <td>{Number(item.reorder_level).toLocaleString()}</td>
                  <td>
                    {!item.is_active ? (
                      <span className="pharmacy-badge neutral">Inactive</span>
                    ) : low ? (
                      <span className="pharmacy-badge warning">Low stock</span>
                    ) : (
                      <span className="pharmacy-badge success">In stock</span>
                    )}
                  </td>
                  <td>
                    <div className="pharmacy-row-actions">
                      <button
                        className="pharmacy-icon-button"
                        title="Edit medication"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => startEditing(item)}
                      >
                        ✎
                      </button>
                      <button
                        className="pharmacy-icon-button"
                        title="View batches"
                        aria-label={`View batches for ${item.name}`}
                        onClick={() => handleViewBatches(item)}
                      >
                        ▤
                      </button>
                      <button
                        className="pharmacy-icon-button"
                        title={item.is_active ? "Deactivate" : "Activate"}
                        aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}
                        onClick={() => handleActiveToggle(item)}
                      >
                        {item.is_active ? "−" : "+"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan="6">
                  <div className="pharmacy-table-empty">
                    {loading
                      ? "Loading medications..."
                      : "No medications found."}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderMovementTable(rows) {
    return (
      <div className="pharmacy-table-wrap">
        <table className="pharmacy-table">
          <thead>
            <tr>
              <th>Date & time</th>
              <th>Medication</th>
              <th>Batch</th>
              <th>Movement</th>
              <th>Quantity</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((movement) => (
              <tr key={movement.id}>
                <td>{new Date(movement.movement_at).toLocaleString()}</td>
                <td>
                  <strong>{movement.medication_name}</strong>
                  <small>{movement.medication_code}</small>
                </td>
                <td>{movement.batch_number || "—"}</td>
                <td>
                  <span
                    className={`pharmacy-badge ${
                      movement.movement_type === "receipt" ||
                      movement.movement_type === "return" ||
                      movement.movement_type === "adjustment_in"
                        ? "success"
                        : "neutral"
                    }`}
                  >
                    {movement.movement_type.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{Number(movement.quantity).toLocaleString()}</td>
                <td>{movement.notes || "—"}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan="6">
                  <div className="pharmacy-table-empty">
                    No inventory movements recorded yet.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderReceiveForm() {
    return (
      <form className="pharmacy-form" onSubmit={handleReceiveStock}>
        <div className="pharmacy-form-grid">
          <label className="pharmacy-field">
            <span>
              Medication <b className="required-mark">*</b>
            </span>
            <select
              required
              value={stockForm.medication_id}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  medication_id: event.target.value,
                }))
              }
            >
              <option value="">Select medication</option>
              {activeMedications.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </label>

          <label className="pharmacy-field">
            <span>
              Batch number <b className="required-mark">*</b>
            </span>
            <input
              required
              value={stockForm.batch_number}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  batch_number: event.target.value,
                }))
              }
            />
          </label>

          <label className="pharmacy-field">
            <span>
              Quantity received <b className="required-mark">*</b>
            </span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={stockForm.quantity}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
            />
          </label>

          <label className="pharmacy-field">
            <span>Unit cost (ETB)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockForm.unit_cost}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  unit_cost: event.target.value,
                }))
              }
            />
          </label>

          <label className="pharmacy-field">
            <span>Selling price (ETB)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockForm.selling_price}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  selling_price: event.target.value,
                }))
              }
            />
          </label>

          <label className="pharmacy-field">
            <span>Supplier</span>
            <input
              value={stockForm.supplier_name}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  supplier_name: event.target.value,
                }))
              }
            />
          </label>

          <label className="pharmacy-field">
            <span>Manufacturing date</span>
            <input
              type="date"
              value={stockForm.manufactured_on}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  manufactured_on: event.target.value,
                }))
              }
            />
          </label>

          <label className="pharmacy-field">
            <span>Expiry date</span>
            <input
              type="date"
              min={stockForm.manufactured_on || undefined}
              value={stockForm.expires_on}
              onChange={(event) =>
                setStockForm((current) => ({
                  ...current,
                  expires_on: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="pharmacy-form-footer">
          <button className="pharmacy-button" type="submit" disabled={saving}>
            {saving ? "Recording stock..." : "Confirm stock receipt"}
          </button>
        </div>
      </form>
    );
  }

  function renderDispenseForm() {
    return (
      <>
        <div className="pharmacy-notice">
          <span>ⓘ</span>
          <p>
            Dispensing reduces available stock and records the movement.
            Eligible batches are used in earliest-expiry-first order.
          </p>
        </div>

        <form className="pharmacy-form" onSubmit={handleDispense}>
          <div className="pharmacy-form-grid">
            <label className="pharmacy-field">
              <span>
                Medication <b className="required-mark">*</b>
              </span>
              <select
                required
                value={dispenseForm.medication_id}
                onChange={(event) =>
                  setDispenseForm((current) => ({
                    ...current,
                    medication_id: event.target.value,
                  }))
                }
              >
                <option value="">Select medication</option>
                {activeMedications.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {Number(item.total_stock).toLocaleString()}{" "}
                    available
                  </option>
                ))}
              </select>
            </label>

            <label className="pharmacy-field">
              <span>
                Quantity <b className="required-mark">*</b>
              </span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={dispenseForm.quantity}
                onChange={(event) =>
                  setDispenseForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
              />
            </label>

            <label className="pharmacy-field pharmacy-field-wide">
              <span>Notes</span>
              <textarea
                rows="3"
                value={dispenseForm.notes}
                onChange={(event) =>
                  setDispenseForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Optional dispensing notes"
              />
            </label>
          </div>

          <div className="pharmacy-form-footer">
            <button className="pharmacy-button" type="submit" disabled={saving}>
              {saving ? "Processing..." : "Confirm dispensing"}
            </button>
          </div>
        </form>
      </>
    );
  }

  function renderBatches() {
    return (
      <>
        <div className="pharmacy-card-heading">
          <div>
            <h3>
              {selectedMedication
                ? `Batches: ${selectedMedication.name}`
                : "Medication batches"}
            </h3>
            <p>Batch quantities, suppliers, and expiry dates.</p>
          </div>
          {selectedMedication && (
            <button
              className="pharmacy-button pharmacy-button-light"
              onClick={() => {
                setSelectedMedication(null);
                setBatches([]);
              }}
            >
              Clear selection
            </button>
          )}
        </div>

        {!selectedMedication && (
          <label className="pharmacy-field pharmacy-batch-selector">
            <span>Choose a medication to view its batches</span>
            <select
              value=""
              onChange={async (event) => {
                const item = medications.find(
                  (medication) => medication.id === event.target.value,
                );
                if (item) await handleViewBatches(item);
              }}
            >
              <option value="">Select medication</option>
              {medications.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="pharmacy-table-wrap">
          <table className="pharmacy-table">
            <thead>
              <tr>
                <th>Batch number</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Unit cost</th>
                <th>Selling price</th>
                <th>Expiry date</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const expired =
                  batch.expires_on &&
                  new Date(`${batch.expires_on}T00:00:00`) <
                    new Date(new Date().toDateString());

                return (
                  <tr key={batch.id}>
                    <td>
                      <strong>{batch.batch_number}</strong>
                    </td>
                    <td>{Number(batch.quantity_received).toLocaleString()}</td>
                    <td>{Number(batch.quantity_remaining).toLocaleString()}</td>
                    <td>{money(batch.unit_cost)} ETB</td>
                    <td>{money(batch.selling_price)} ETB</td>
                    <td>
                      {batch.expires_on ? (
                        <span
                          className={`pharmacy-badge ${
                            expired ? "danger" : "neutral"
                          }`}
                        >
                          {dateLabel(batch.expires_on)}
                          {expired ? " · Expired" : ""}
                        </span>
                      ) : (
                        "Not recorded"
                      )}
                    </td>
                    <td>{batch.supplier_name || "—"}</td>
                  </tr>
                );
              })}

              {batches.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="pharmacy-table-empty">
                      {selectedMedication
                        ? "No batches recorded for this medication."
                        : "Choose a medication above to view batches."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <main className="pharmacy-page">
      <header className="pharmacy-topbar">
        <div className="pharmacy-brand">
          <span className="pharmacy-brand-mark">M+</span>
          <div>
            <strong>MedAxis</strong>
            <small>Hospital Management System</small>
          </div>
        </div>

        <div className="pharmacy-topbar-right">
          <span className="pharmacy-module-label">Pharmacy & Inventory</span>
          <button
            className="pharmacy-button pharmacy-button-light"
            type="button"
            onClick={handleRefresh}
            disabled={loading}
          >
            <span aria-hidden="true">↻</span>{" "}
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <div className="pharmacy-layout">
        <aside className="pharmacy-sidebar">
          <span className="pharmacy-sidebar-heading">WORKSPACE</span>
          <nav className="pharmacy-nav" aria-label="Pharmacy navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`pharmacy-nav-item ${
                  activeTab === item.id ? "active" : ""
                }`}
                onClick={() => changeTab(item.id)}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                <span className="pharmacy-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.id === "medications" && lowStockItems.length > 0 && (
                  <span className="pharmacy-nav-count">
                    {lowStockItems.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="pharmacy-sidebar-note">
            <span>ⓘ</span>
            <strong>Stock management</strong>
            <p>
              Record every stock receipt and dispensing action to keep the
              inventory history up to date.
            </p>
          </div>
        </aside>

        <div className="pharmacy-main">
          <div className="pharmacy-page-heading">
            <div>
              <span className="pharmacy-breadcrumb">
                MedAxis <span>/</span> Pharmacy
              </span>
              <h1>
                {NAV_ITEMS.find((item) => item.id === activeTab)?.label ||
                  "Pharmacy"}
              </h1>
              <p>
                {activeTab === "overview" &&
                  "Your pharmacy operations at a glance."}
                {activeTab === "medications" &&
                  "Maintain and search your medication catalogue."}
                {activeTab === "receive" &&
                  "Add a new batch and record incoming stock."}
                {activeTab === "dispense" &&
                  "Record stock leaving the pharmacy."}
                {activeTab === "batches" &&
                  "Review batch quantities, costs, and expiry dates."}
                {activeTab === "movements" &&
                  "Review the recorded inventory movement history."}
              </p>
            </div>
            {activeTab === "medications" && (
              <button
                className="pharmacy-button"
                onClick={() => {
                  resetMedicationForm();
                  document
                    .querySelector(".pharmacy-editor-card")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                ＋ Add medication
              </button>
            )}
          </div>

          {activeTab === "overview" && renderOverview()}

          {activeTab === "medications" && (
            <>
              <section className="pharmacy-card pharmacy-editor-card">
                <div className="pharmacy-card-heading">
                  <div>
                    <h3>{editingId ? "Edit medication" : "Add medication"}</h3>
                    <p>
                      {editingId
                        ? "Update the selected catalogue record."
                        : "Enter the basic information for a medicine."}
                    </p>
                  </div>
                  {editingId && (
                    <span className="pharmacy-badge info">Editing record</span>
                  )}
                </div>
                {renderMedicationForm()}
              </section>

              <section className="pharmacy-card">
                <div className="pharmacy-card-heading pharmacy-list-heading">
                  <div>
                    <h3>Medication catalogue</h3>
                    <p>{medications.length} records in the current result</p>
                  </div>
                  <label className="pharmacy-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      aria-label="Search medications"
                      placeholder="Search medicine or code..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                {renderMedicationTable(medications)}
              </section>
            </>
          )}

          {activeTab === "receive" && (
            <section className="pharmacy-card pharmacy-workflow-card">
              <div className="pharmacy-workflow-heading">
                <span className="pharmacy-large-icon teal">↓</span>
                <div>
                  <h3>Receive new stock</h3>
                  <p>
                    Create a batch and record its starting quantity, cost,
                    selling price, and expiry information.
                  </p>
                </div>
              </div>
              {renderReceiveForm()}
            </section>
          )}

          {activeTab === "dispense" && (
            <section className="pharmacy-card pharmacy-workflow-card">
              <div className="pharmacy-workflow-heading">
                <span className="pharmacy-large-icon blue">↗</span>
                <div>
                  <h3>Dispense medication stock</h3>
                  <p>
                    Select an active medication and enter the quantity to record
                    a stock movement.
                  </p>
                </div>
              </div>
              {renderDispenseForm()}
            </section>
          )}

          {activeTab === "batches" && (
            <section className="pharmacy-card">{renderBatches()}</section>
          )}

          {activeTab === "movements" && (
            <section className="pharmacy-card">
              <div className="pharmacy-card-heading pharmacy-list-heading">
                <div>
                  <h3>Inventory movement history</h3>
                  <p>Latest recorded stock activity.</p>
                </div>
                <span className="pharmacy-badge neutral">
                  {movements.length} records loaded
                </span>
              </div>
              {renderMovementTable(movements)}
            </section>
          )}

          <footer className="pharmacy-footer">
            <span>MedAxis Pharmacy & Inventory</span>
            <span>Stock information depends on recorded transactions.</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import inventoryService from "../../services/inventoryProcurement.service";
import "./InventoryProcurement.css";

const emptyItem = {
  item_code: "",
  name: "",
  category_id: "",
  unit: "piece",
  opening_quantity: "0",
  reorder_level: "0",
  unit_cost: "0",
  storage_location: "",
  expiry_date: "",
  description: "",
};

const emptySupplier = {
  supplier_code: "",
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
};

const emptyStock = {
  item_id: "",
  transaction_type: "receipt",
  quantity: "",
  unit_cost: "0",
  notes: "",
};

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The request could not be completed."
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function formatCurrency(value) {
  return `ETB ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getRows(response) {
  return response?.data?.data ?? [];
}

export default function InventoryProcurement() {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [itemForm, setItemForm] = useState(emptyItem);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [stockForm, setStockForm] = useState(emptyStock);

  const [showItemForm, setShowItemForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [summaryRes, lowRes, expiringRes] = await Promise.all([
      inventoryService.getSummary(),
      inventoryService.getLowStock(),
      inventoryService.getExpiringItems(),
    ]);

    setSummary(summaryRes.data.data || {});
    setLowStock(getRows(lowRes));
    setExpiring(getRows(expiringRes));
  }, []);

  const loadItems = useCallback(async () => {
    const response = await inventoryService.getItems({
      page,
      limit: 10,
      search,
      stock: stockFilter,
    });

    setItems(getRows(response));
    setPagination(
      response.data.pagination || {
        page: 1,
        pages: 1,
        total: 0,
      },
    );
  }, [page, search, stockFilter]);

  const loadSupportingData = useCallback(async () => {
    const [categoryRes, supplierRes, orderRes, transactionRes] =
      await Promise.all([
        inventoryService.getCategories(),
        inventoryService.getSuppliers(),
        inventoryService.getPurchaseOrders(),
        inventoryService.getTransactions(),
      ]);

    setCategories(getRows(categoryRes));
    setSuppliers(getRows(supplierRes));
    setOrders(getRows(orderRes));
    setTransactions(getRows(transactionRes));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      await Promise.all([loadDashboard(), loadItems(), loadSupportingData()]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadItems, loadSupportingData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitItem(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...itemForm,
        category_id: itemForm.category_id || null,
        opening_quantity: Number(itemForm.opening_quantity),
        reorder_level: Number(itemForm.reorder_level),
        unit_cost: Number(itemForm.unit_cost),
        expiry_date: itemForm.expiry_date || null,
      };

      await inventoryService.createItem(payload);
      toast.success("Inventory item created.");
      setItemForm(emptyItem);
      setShowItemForm(false);
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitSupplier(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await inventoryService.createSupplier(supplierForm);
      toast.success("Supplier created.");
      setSupplierForm(emptySupplier);
      setShowSupplierForm(false);
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitStock(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await inventoryService.createTransaction({
        ...stockForm,
        quantity: Number(stockForm.quantity),
        unit_cost: Number(stockForm.unit_cost),
      });

      toast.success("Stock transaction recorded.");
      setStockForm(emptyStock);
      setShowStockForm(false);
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateItem(item) {
    if (!window.confirm(`Deactivate "${item.name}"?`)) return;

    try {
      await inventoryService.deactivateItem(item.id);
      toast.success("Item deactivated.");
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  const tabs = [
    ["overview", "Overview"],
    ["items", "Inventory items"],
    ["suppliers", "Suppliers"],
    ["transactions", "Stock movements"],
    ["orders", "Purchase orders"],
    ["reports", "Stock reports"],
  ];

  return (
    <main className="ip-page">
      <header className="ip-header">
        <div>
          <p className="ip-eyebrow">HOSPITAL OPERATIONS</p>
          <h1>Inventory & Procurement</h1>
          <p className="ip-subtitle">
            Manage hospital supplies, suppliers, purchasing, and stock.
          </p>
        </div>

        <button
          className="ip-button ip-button-secondary"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh data"}
        </button>
      </header>

      <nav className="ip-tabs" aria-label="Inventory sections">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "ip-tab active" : "ip-tab"}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section>
          <div className="ip-stat-grid">
            <StatCard label="Active items" value={summary.total_items} />
            <StatCard label="Low-stock items" value={summary.low_stock_items} />
            <StatCard
              label="Expiring within 30 days"
              value={summary.expiring_items}
            />
            <StatCard
              label="Active suppliers"
              value={summary.active_suppliers}
            />
            <StatCard label="Pending orders" value={summary.pending_orders} />
            <StatCard
              label="Estimated stock value"
              value={formatCurrency(summary.stock_value)}
            />
          </div>

          <div className="ip-two-column">
            <section className="ip-panel">
              <PanelHeading title="Low-stock alerts" count={lowStock.length} />
              <StockTable items={lowStock.slice(0, 5)} />
            </section>

            <section className="ip-panel">
              <PanelHeading title="Upcoming expiry" count={expiring.length} />
              <ExpiryTable items={expiring.slice(0, 5)} />
            </section>
          </div>
        </section>
      )}

      {tab === "items" && (
        <section className="ip-panel">
          <PanelHeading title="Inventory items" count={pagination.total}>
            <button
              className="ip-button"
              onClick={() => setShowItemForm((value) => !value)}
            >
              {showItemForm ? "Close form" : "Add inventory item"}
            </button>
          </PanelHeading>

          {showItemForm && (
            <form className="ip-form" onSubmit={submitItem}>
              <Field label="Item code" required>
                <input
                  required
                  maxLength={80}
                  value={itemForm.item_code}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, item_code: e.target.value })
                  }
                />
              </Field>

              <Field label="Item name" required>
                <input
                  required
                  maxLength={180}
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, name: e.target.value })
                  }
                />
              </Field>

              <Field label="Category">
                <select
                  name="category_id"
                  value={itemForm.category_id}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      category_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Select a category</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Unit" required>
                <input
                  required
                  value={itemForm.unit}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, unit: e.target.value })
                  }
                />
              </Field>

              <Field label="Opening quantity" required>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  value={itemForm.opening_quantity}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      opening_quantity: e.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Reorder level" required>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  value={itemForm.reorder_level}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, reorder_level: e.target.value })
                  }
                />
              </Field>

              <Field label="Unit cost (ETB)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={itemForm.unit_cost}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, unit_cost: e.target.value })
                  }
                />
              </Field>

              <Field label="Storage location">
                <input
                  value={itemForm.storage_location}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      storage_location: e.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Expiry date">
                <input
                  type="date"
                  value={itemForm.expiry_date}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, expiry_date: e.target.value })
                  }
                />
              </Field>

              <Field label="Description">
                <input
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, description: e.target.value })
                  }
                />
              </Field>

              <div className="ip-form-actions">
                <button className="ip-button" disabled={saving}>
                  {saving ? "Saving..." : "Save inventory item"}
                </button>
              </div>
            </form>
          )}

          <div className="ip-toolbar">
            <input
              aria-label="Search inventory"
              placeholder="Search by name or item code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <select
              aria-label="Filter stock"
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="expiring">Expiring soon</option>
            </select>
          </div>

          <InventoryTable items={items} onDeactivate={deactivateItem} />

          <div className="ip-pagination">
            <span>
              Page {pagination.page || page} of{" "}
              {Math.max(1, pagination.pages || 1)}
            </span>
            <div>
              <button
                className="ip-button ip-button-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                className="ip-button ip-button-secondary"
                disabled={page >= (pagination.pages || 1) || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === "suppliers" && (
        <section className="ip-panel">
          <PanelHeading title="Suppliers" count={suppliers.length}>
            <button
              className="ip-button"
              onClick={() => setShowSupplierForm((value) => !value)}
            >
              {showSupplierForm ? "Close form" : "Add supplier"}
            </button>
          </PanelHeading>

          {showSupplierForm && (
            <form className="ip-form" onSubmit={submitSupplier}>
              {[
                ["supplier_code", "Supplier code", true],
                ["name", "Supplier name", true],
                ["contact_person", "Contact person", false],
                ["email", "Email", false],
                ["phone", "Phone", false],
                ["address", "Address", false],
              ].map(([key, label, required]) => (
                <Field key={key} label={label} required={required}>
                  <input
                    required={required}
                    type={key === "email" ? "email" : "text"}
                    value={supplierForm[key]}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        [key]: e.target.value,
                      })
                    }
                  />
                </Field>
              ))}

              <div className="ip-form-actions">
                <button className="ip-button" disabled={saving}>
                  {saving ? "Saving..." : "Save supplier"}
                </button>
              </div>
            </form>
          )}

          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Supplier</th>
                  <th>Contact person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.supplier_code}</td>
                    <td>{supplier.name}</td>
                    <td>{supplier.contact_person || "—"}</td>
                    <td>{supplier.email || "—"}</td>
                    <td>{supplier.phone || "—"}</td>
                    <td>
                      <StatusBadge
                        value={supplier.is_active ? "active" : "inactive"}
                      />
                    </td>
                  </tr>
                ))}
                {!suppliers.length && (
                  <EmptyRow
                    columns={6}
                    message="No suppliers registered yet."
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "transactions" && (
        <section className="ip-panel">
          <PanelHeading title="Stock movements" count={transactions.length}>
            <button
              className="ip-button"
              onClick={() => setShowStockForm((value) => !value)}
            >
              {showStockForm ? "Close form" : "Record stock movement"}
            </button>
          </PanelHeading>

          {showStockForm && (
            <form className="ip-form" onSubmit={submitStock}>
              <Field label="Inventory item" required>
                <select
                  required
                  value={stockForm.item_id}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, item_id: e.target.value })
                  }
                >
                  <option value="">Select item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_code} — {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Transaction type" required>
                <select
                  value={stockForm.transaction_type}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      transaction_type: e.target.value,
                    })
                  }
                >
                  <option value="receipt">Receipt</option>
                  <option value="issue">Issue</option>
                  <option value="return">Return</option>
                  <option value="adjustment_in">Adjustment in</option>
                  <option value="adjustment_out">Adjustment out</option>
                </select>
              </Field>

              <Field label="Quantity" required>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={stockForm.quantity}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, quantity: e.target.value })
                  }
                />
              </Field>

              <Field label="Unit cost (ETB)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockForm.unit_cost}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, unit_cost: e.target.value })
                  }
                />
              </Field>

              <Field label="Notes">
                <input
                  value={stockForm.notes}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, notes: e.target.value })
                  }
                />
              </Field>

              <div className="ip-form-actions">
                <button className="ip-button" disabled={saving}>
                  {saving ? "Saving..." : "Record movement"}
                </button>
              </div>
            </form>
          )}

          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Unit cost</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.created_at).toLocaleString()}</td>
                    <td>{transaction.item_name}</td>
                    <td>
                      <StatusBadge value={transaction.transaction_type} />
                    </td>
                    <td>{formatNumber(transaction.quantity)}</td>
                    <td>{formatCurrency(transaction.unit_cost)}</td>
                    <td>{transaction.notes || "—"}</td>
                  </tr>
                ))}
                {!transactions.length && (
                  <EmptyRow
                    columns={6}
                    message="No stock movements recorded."
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "orders" && (
        <section className="ip-panel">
          <PanelHeading title="Purchase orders" count={orders.length} />
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Order number</th>
                  <th>Supplier</th>
                  <th>Order date</th>
                  <th>Expected delivery</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>{order.supplier_name}</td>
                    <td>{order.order_date}</td>
                    <td>{order.expected_delivery_date || "—"}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>
                      <StatusBadge value={order.status} />
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <EmptyRow columns={6} message="No purchase orders found." />
                )}
              </tbody>
            </table>
          </div>
          <p className="ip-help">
            Purchase order creation, approval, and receiving APIs are available.
            The dedicated purchase-order form and receipt-entry screen are the
            next frontend pieces to add.
          </p>
        </section>
      )}

      {tab === "reports" && (
        <div className="ip-two-column">
          <section className="ip-panel">
            <PanelHeading title="Low-stock report" count={lowStock.length} />
            <StockTable items={lowStock} />
          </section>
          <section className="ip-panel">
            <PanelHeading title="Expiry report" count={expiring.length} />
            <ExpiryTable items={expiring} />
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="ip-stat-card">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </article>
  );
}

function PanelHeading({ title, count, children }) {
  return (
    <div className="ip-panel-heading">
      <div>
        <h2>{title}</h2>
        {count !== undefined && <span>{count} records</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="ip-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || "unknown").toLowerCase();
  return (
    <span className={`ip-status status-${normalized}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyRow({ columns, message }) {
  return (
    <tr>
      <td colSpan={columns} className="ip-empty">
        {message}
      </td>
    </tr>
  );
}

function InventoryTable({ items, onDeactivate }) {
  return (
    <div className="ip-table-wrap">
      <table className="ip-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Item</th>
            <th>Category</th>
            <th>Quantity</th>
            <th>Reorder level</th>
            <th>Unit cost</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.item_code}</td>
              <td>
                <strong>{item.name}</strong>
                <small>{item.storage_location || "No location"}</small>
              </td>
              <td>{item.category_name || "—"}</td>
              <td>
                {formatNumber(item.quantity_on_hand)} {item.unit}
              </td>
              <td>{formatNumber(item.reorder_level)}</td>
              <td>{formatCurrency(item.unit_cost)}</td>
              <td>{item.expiry_date || "—"}</td>
              <td>
                <StatusBadge value={item.stock_status} />
              </td>
              <td>
                <button
                  className="ip-text-button"
                  onClick={() => onDeactivate(item)}
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
          {!items.length && (
            <EmptyRow columns={9} message="No matching inventory items." />
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockTable({ items }) {
  return (
    <div className="ip-table-wrap">
      <table className="ip-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Available</th>
            <th>Reorder level</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                {formatNumber(item.quantity_on_hand)} {item.unit}
              </td>
              <td>{formatNumber(item.reorder_level)}</td>
            </tr>
          ))}
          {!items.length && (
            <EmptyRow columns={3} message="No low-stock items." />
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExpiryTable({ items }) {
  return (
    <div className="ip-table-wrap">
      <table className="ip-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Expiry date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                {formatNumber(item.quantity_on_hand)} {item.unit}
              </td>
              <td>{item.expiry_date}</td>
            </tr>
          ))}
          {!items.length && (
            <EmptyRow columns={3} message="No items expiring within 90 days." />
          )}
        </tbody>
      </table>
    </div>
  );
}

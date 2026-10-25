import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import "./Laboratory.css";

export default function Laboratory() {
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [testIds, setTestIds] = useState([]);
  const [priority, setPriority] = useState("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResponse, ordersResponse] = await Promise.all([
        api.get("/laboratory/catalog", {
          params: { active: true, limit: 100 },
        }),
        api.get("/laboratory/orders", {
          params: { page: 1, limit: 20 },
        }),
      ]);

      setCatalog(catalogResponse.data.catalog || []);
      setOrders(ordersResponse.data.orders || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load laboratory data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleTest(id) {
    setTestIds((current) =>
      current.includes(id)
        ? current.filter((testId) => testId !== id)
        : [...current, id],
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!patientId.trim() || testIds.length === 0) {
      toast.error("Enter a patient ID and select at least one test.");
      return;
    }

    try {
      await api.post("/laboratory/orders", {
        patient_id: patientId.trim(),
        test_ids: testIds,
        priority,
        clinical_notes: clinicalNotes.trim() || null,
      });

      toast.success("Laboratory order created.");
      setPatientId("");
      setTestIds([]);
      setPriority("routine");
      setClinicalNotes("");
      await loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create laboratory order.",
      );
    }
  }
  const handleDispenseStock = async (event) => {
    event.preventDefault();

    try {
      if (!dispenseForm.medication_id || !dispenseForm.quantity) {
        toast.error("Select a medication and enter a quantity.");
        return;
      }

      const result = await dispenseStock({
        medication_id: dispenseForm.medication_id,
        quantity: Number(dispenseForm.quantity),
        reference_id: null,
        notes: dispenseForm.notes || null,
      });

      toast.success(result.message || "Stock dispensed successfully.");

      // Refresh inventory data after dispensing.
      await loadDashboardData();

      setDispenseForm({
        medication_id: "",
        quantity: "",
        notes: "",
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to dispense stock.");
    }
  };
  return (
    <main className="laboratory-page">
      <header className="laboratory-header">
        <div>
          <h1>Laboratory</h1>
          <p>Manage test catalogues, orders, and results.</p>
        </div>
        <button type="button" onClick={loadData} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <section className="laboratory-panel">
        <h2>Create laboratory order</h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="patient-id">Patient ID</label>
          <input
            id="patient-id"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            placeholder="Enter an existing patient ID"
            required
          />

          <label htmlFor="lab-priority">Priority</label>
          <select
            id="lab-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>

          <label htmlFor="lab-notes">Clinical notes</label>
          <textarea
            id="lab-notes"
            value={clinicalNotes}
            onChange={(event) => setClinicalNotes(event.target.value)}
            rows={3}
          />

          {/* <fieldset className="laboratory-tests">
            <legend>Select tests</legend>

            {catalog.length === 0 ? (
              <p>No active tests are available.</p>
            ) : (
              catalog.map((test) => (
                <label className="laboratory-test" key={test.id}>
                  <input
                    type="checkbox"
                    checked={testIds.includes(test.id)}
                    onChange={() => toggleTest(test.id)}
                  />
                  <span>
                    <strong>{test.test_name}</strong>
                    <small>
                      {test.test_code} ·{" "}
                      {test.specimen_type || "Specimen not specified"}
                    </small>
                  </span>
                  <span>{Number(test.price).toFixed(2)} ETB</span>
                </label>
              ))
            )}
          </fieldset> */}

          <div className="laboratory-tests">
            <label htmlFor="lab-test-select">Select tests</label>

            <select
              id="lab-test-select"
              value=""
              onChange={(event) => {
                const testId = event.target.value;

                if (testId && !testIds.includes(testId)) {
                  setTestIds((current) => [...current, testId]);
                }
              }}
            >
              <option value="">Choose a laboratory test</option>

              {catalog
                .filter((test) => !testIds.includes(test.id))
                .map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.test_name} ({test.test_code}) —{" "}
                    {Number(test.price).toFixed(2)} ETB
                  </option>
                ))}
            </select>

            <div className="selected-lab-tests">
              {testIds.length === 0 ? (
                <p>No tests selected yet.</p>
              ) : (
                testIds.map((testId) => {
                  const test = catalog.find((item) => item.id === testId);

                  if (!test) return null;

                  return (
                    <div className="selected-lab-test" key={testId}>
                      <span>
                        <strong>{test.test_name}</strong>
                        <small>
                          {test.test_code} · {Number(test.price).toFixed(2)} ETB
                        </small>
                      </span>

                      <button
                        type="button"
                        className="remove-lab-test"
                        onClick={() =>
                          setTestIds((current) =>
                            current.filter((id) => id !== testId),
                          )
                        }
                        aria-label={`Remove ${test.test_name}`}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button type="submit" disabled={loading || catalog.length === 0}>
            Create order
          </button>
        </form>
      </section>

      <section className="laboratory-panel">
        <h2>Recent laboratory orders</h2>

        {loading && <p>Loading orders...</p>}

        {!loading && orders.length === 0 && <p>No laboratory orders found.</p>}

        <div className="laboratory-table-wrap">
          <table className="laboratory-table">
            <thead>
              <tr>
                <th>Order number</th>
                <th>Patient</th>
                <th>Tests</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Ordered</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>
                    {[order.patient_first_name, order.patient_last_name]
                      .filter(Boolean)
                      .join(" ") || order.patient_id}
                  </td>
                  <td>
                    {(order.items || [])
                      .map((item) => item.test_name)
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td>{order.priority}</td>
                  <td>{order.order_status.replaceAll("_", " ")}</td>
                  <td>
                    {order.ordered_at
                      ? new Date(order.ordered_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

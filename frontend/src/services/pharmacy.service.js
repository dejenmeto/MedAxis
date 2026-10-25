import api from "./api";

export async function fetchMedications(search = "") {
  const response = await api.get("/pharmacy/medications", {
    params: { search, active: true, page: 1, limit: 100 },
  });
  return response.data.medications;
}

export async function createMedication(medication) {
  const response = await api.post("/pharmacy/medications", medication);
  return response.data.medication;
}

export async function updateMedication(id, medication) {
  const response = await api.put(`/pharmacy/medications/${id}`, medication);
  return response.data.medication;
}

export async function setMedicationActive(id, is_active) {
  const response = await api.patch(`/pharmacy/medications/${id}/active`, {
    is_active,
  });
  return response.data.medication;
}

export async function fetchMedicationBatches(medication_id) {
  const response = await api.get("/pharmacy/batches", {
    params: { medication_id },
  });
  return response.data.batches;
}

export async function receiveStock(stock) {
  const response = await api.post("/pharmacy/batches/receive", stock);
  return response.data;
}

export async function dispenseStock(stock) {
  const response = await api.post("/pharmacy/dispense", stock);
  return response.data;
}

export async function fetchInventoryMovements(filters = {}) {
  const response = await api.get("/pharmacy/movements", {
    params: filters,
  });
  return response.data.movements;
}

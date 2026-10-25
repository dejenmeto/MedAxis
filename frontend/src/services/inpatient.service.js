import api from "./api";

const BASE_URL = "/inpatient";

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    "The inpatient request failed."
  );
}

async function request(promise) {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const listRooms = (params = {}) =>
  request(api.get(`${BASE_URL}/rooms`, { params }));

export const createRoom = (data) =>
  request(api.post(`${BASE_URL}/rooms`, data));

export const updateRoom = (id, data) =>
  request(api.put(`${BASE_URL}/rooms/${encodeURIComponent(id)}`, data));

export const deactivateRoom = (id) =>
  request(api.patch(`${BASE_URL}/rooms/${encodeURIComponent(id)}/deactivate`));

export const listBeds = (params = {}) =>
  request(api.get(`${BASE_URL}/beds`, { params }));

export const createBed = (data) => request(api.post(`${BASE_URL}/beds`, data));

export const updateBed = (id, data) =>
  request(api.put(`${BASE_URL}/beds/${encodeURIComponent(id)}`, data));

export const listAdmissions = (params = {}) =>
  request(api.get(`${BASE_URL}/admissions`, { params }));

export const createAdmission = (data) =>
  request(api.post(`${BASE_URL}/admissions`, data));

export const updateAdmission = (id, data) =>
  request(api.put(`${BASE_URL}/admissions/${encodeURIComponent(id)}`, data));

export const dischargeAdmission = (id, discharge_notes = "") =>
  request(
    api.patch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/discharge`, {
      discharge_notes,
    }),
  );

export const cancelAdmission = (id, reason = "") =>
  request(
    api.patch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/cancel`, {
      reason,
    }),
  );

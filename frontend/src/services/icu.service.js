import api from "./api";

const ROOT = "/icu";

const icuService = {
  getSummary: () => api.get(`${ROOT}/summary`),

  getUnits: () => api.get(`${ROOT}/units`),
  createUnit: (data) => api.post(`${ROOT}/units`, data),
  updateUnit: (id, data) => api.put(`${ROOT}/units/${id}`, data),

  getBeds: (params = {}) => api.get(`${ROOT}/beds`, { params }),
  createBed: (data) => api.post(`${ROOT}/beds`, data),
  updateBed: (id, data) => api.put(`${ROOT}/beds/${id}`, data),

  getStays: (params = {}) => api.get(`${ROOT}/stays`, { params }),
  getStay: (id) => api.get(`${ROOT}/stays/${id}`),
  createStay: (data) => api.post(`${ROOT}/stays`, data),
  updateStay: (id, data) => api.put(`${ROOT}/stays/${id}`, data),
  dischargeStay: (id, data = {}) =>
    api.patch(`${ROOT}/stays/${id}/discharge`, data),

  getObservations: (stayId) => api.get(`${ROOT}/stays/${stayId}/observations`),
  createObservation: (data) => api.post(`${ROOT}/observations`, data),
  updateObservation: (id, data) => api.put(`${ROOT}/observations/${id}`, data),
  deleteObservation: (id) => api.delete(`${ROOT}/observations/${id}`),

  getNotes: (stayId) => api.get(`${ROOT}/stays/${stayId}/notes`),
  createNote: (data) => api.post(`${ROOT}/notes`, data),
  updateNote: (id, data) => api.put(`${ROOT}/notes/${id}`, data),
  deleteNote: (id) => api.delete(`${ROOT}/notes/${id}`),

  getTransfers: () => api.get(`${ROOT}/transfers`),
  createTransfer: (data) => api.post(`${ROOT}/transfers`, data),
};

export default icuService;

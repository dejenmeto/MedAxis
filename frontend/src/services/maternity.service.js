import api from "./api";

const ROOT = "/maternity";

const maternityService = {
  getSummary: () => api.get(`${ROOT}/summary`),

  getRecords: (resource, params = {}) =>
    api.get(`${ROOT}/${resource}`, { params }),

  createRecord: (resource, data) => api.post(`${ROOT}/${resource}`, data),

  updateRecord: (resource, id, data) =>
    api.put(`${ROOT}/${resource}/${id}`, data),

  deleteRecord: (resource, id) => api.delete(`${ROOT}/${resource}/${id}`),
};

export default maternityService;

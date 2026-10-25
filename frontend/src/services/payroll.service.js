import api from "./api";

const ROOT = "/payroll";

const payrollService = {
  getSummary: () => api.get(`${ROOT}/summary`),

  getRecords: (resource, params = {}) =>
    api.get(`${ROOT}/${resource}`, { params }),

  createRecord: (resource, data) => api.post(`${ROOT}/${resource}`, data),

  processPeriod: (id) => api.post(`${ROOT}/periods/${id}/process`),

  approveRecord: (id) => api.put(`${ROOT}/records/${id}/approve`),

  recordPayment: (id, data) => api.post(`${ROOT}/records/${id}/payments`, data),
};

export default payrollService;

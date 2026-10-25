import api from "./api";

const ROOT = "/audit-compliance";

const auditComplianceService = {
  getSummary: () => api.get(`${ROOT}/summary`),

  getLogs: (params = {}) => api.get(`${ROOT}/logs`, { params }),

  getChecks: (params = {}) => api.get(`${ROOT}/checks`, { params }),

  createCheck: (data) => api.post(`${ROOT}/checks`, data),

  updateCheck: (id, data) => api.put(`${ROOT}/checks/${id}`, data),

  deleteCheck: (id) => api.delete(`${ROOT}/checks/${id}`),
};

export default auditComplianceService;

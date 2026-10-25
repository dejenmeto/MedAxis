import api from "./api";

const queueService = {
  getAll: (params = {}) => api.get("/queue", { params }),

  getDashboard: (params = {}) => api.get("/queue/dashboard", { params }),

  create: (payload) => api.post("/queue", payload),

  update: (id, payload, params = {}) =>
    api.put(`/queue/${id}`, payload, { params }),

  updateStatus: (id, status, params = {}) =>
    api.patch(`/queue/${id}/status`, { status }, { params }),

  cancel: (id, params = {}) => api.delete(`/queue/${id}`, { params }),
};

export default queueService;

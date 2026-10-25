import api from "./api";

const appointmentsService = {
  async list(params = {}) {
    const response = await api.get("/appointments", { params });
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/appointments/${id}`);
    return response.data;
  },

  async create(payload) {
    const response = await api.post("/appointments", payload);
    return response.data;
  },

  async update(id, payload) {
    const response = await api.patch(`/appointments/${id}`, payload);
    return response.data;
  },

  async cancel(id, reason = "") {
    const response = await api.patch(`/appointments/${id}/cancel`, {
      reason,
    });
    return response.data;
  },

  async changeStatus(id, status, reason = "") {
    const response = await api.patch(`/appointments/${id}/status`, {
      status,
      reason,
    });
    return response.data;
  },
};

export default appointmentsService;

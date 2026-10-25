import api from "./api";

const patientsService = {
  async list(params = {}) {
    const response = await api.get("/patients", { params });
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  async create(payload) {
    const response = await api.post("/patients", payload);
    return response.data;
  },

  async update(id, payload) {
    const response = await api.put(`/patients/${id}`, payload);
    return response.data;
  },

  async deactivate(id) {
    const response = await api.patch(`/patients/${id}/deactivate`);
    return response.data;
  },
};

export default patientsService;
